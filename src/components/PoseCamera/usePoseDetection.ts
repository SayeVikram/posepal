import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { drawSkeleton } from './drawUtils';

type PoseResult = {
  label: string;
  confidence: number;
  expectedConfidence: number | null;
  meanKeypointScore: number;
  isPoseVisible: boolean;
};

type HookResult = {
  loading: boolean;
  error: string | null;
  result: PoseResult | null;
};

// ---------------------------------------------------------------------------
// Exponential moving average alpha (weight for the current frame).
// Lower = more smoothing but more lag; 0.35 is a good balance for ~30 fps.
// ---------------------------------------------------------------------------
const EMA_ALPHA = 0.35;

function normalizeBaseUrl(base: string): string {
  if (!base) return '/';
  return base.endsWith('/') ? base : `${base}/`;
}

function modelCandidates(): string[] {
  const configured = (import.meta.env.VITE_TFJS_MODEL_URL as string | undefined)?.trim();
  const baseUrl = normalizeBaseUrl(import.meta.env.BASE_URL ?? '/');
  const fromBase = `${baseUrl}models/tfjs_model/model.json`;
  const fallbackAbsolute = '/models/tfjs_model/model.json';
  const seen = new Set<string>();
  const candidates = [configured, fromBase, fallbackAbsolute].filter(
    (v): v is string => Boolean(v),
  );
  return candidates.filter((c) => {
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });
}

async function validateModelArtifacts(modelUrl: string): Promise<void> {
  const modelResp = await fetch(modelUrl, { cache: 'no-store' });
  if (!modelResp.ok) {
    throw new Error(`model.json returned HTTP ${modelResp.status}`);
  }
  const contentType = modelResp.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json') && !contentType.includes('text/plain')) {
    throw new Error(`model.json content-type is ${contentType || 'unknown'} (expected JSON)`);
  }

  const modelJson = (await modelResp.json()) as {
    weightsManifest?: Array<{ paths?: string[] }>;
  };
  const paths = modelJson.weightsManifest?.flatMap((w) => w.paths ?? []) ?? [];
  const base = modelUrl.slice(0, modelUrl.lastIndexOf('/') + 1);
  for (const rel of paths) {
    const shardUrl = `${base}${rel}`;
    const shardResp = await fetch(shardUrl, { cache: 'no-store' });
    if (!shardResp.ok) {
      throw new Error(`${rel} returned HTTP ${shardResp.status}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Patch Keras 3 model.json: rename batch_shape → batch_input_shape on
// InputLayer configs so that TF.js's own loader can parse the topology.
// ---------------------------------------------------------------------------
function patchInputLayerConfig(modelJson: Record<string, unknown>): void {
  const topology = modelJson.modelTopology as Record<string, unknown> | undefined;
  const modelConfig = topology?.model_config as Record<string, unknown> | undefined;
  const config = modelConfig?.config as Record<string, unknown> | undefined;
  const layers = config?.layers as Array<Record<string, unknown>> | undefined;
  if (!layers) return;

  for (const layer of layers) {
    if (layer.class_name !== 'InputLayer') continue;
    const layerCfg = layer.config as Record<string, unknown> | undefined;
    if (!layerCfg) continue;
    if (!('batch_input_shape' in layerCfg) && 'batch_shape' in layerCfg) {
      layerCfg.batch_input_shape = layerCfg.batch_shape;
    }
  }
}

// ---------------------------------------------------------------------------
// Decode float32 weights from a concatenated binary buffer, following the
// order and shapes declared in the weights manifest.  This is used instead
// of relying on TF.js name-matching, which breaks for Keras 3 exports whose
// weight names include the model-name prefix (e.g. "sequential/dense_2/kernel"
// vs the TF.js variable path "dense_2/kernel").
// ---------------------------------------------------------------------------
function decodeWeightsFromBuffer(
  data: ArrayBuffer,
  specs: tf.io.WeightsManifestEntry[],
): tf.Tensor[] {
  const tensors: tf.Tensor[] = [];
  let byteOffset = 0;
  for (const spec of specs) {
    const numElements = spec.shape.reduce((a, b) => a * b, 1);
    const numBytes = numElements * 4; // float32 = 4 bytes
    tensors.push(tf.tensor(new Float32Array(data.slice(byteOffset, byteOffset + numBytes)), spec.shape, 'float32'));
    byteOffset += numBytes;
  }
  return tensors;
}

function concatArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const total = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    merged.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return merged.buffer;
}

// ---------------------------------------------------------------------------
// Load the model by:
//   1. Fetching + patching model.json (Keras 3 compat fix)
//   2. Building the model architecture from topology (no weights yet)
//   3. Fetching weight shards and decoding by position via setWeights()
//
// Using setWeights() instead of tf.io.fromMemory() with weightSpecs avoids
// the TF.js name-matching step that fails for Keras 3 exports, where weight
// names include the model-name prefix (e.g. "sequential/dense_2/kernel").
// ---------------------------------------------------------------------------
async function loadPatchedLayersModel(modelUrl: string): Promise<tf.LayersModel> {
  const modelResp = await fetch(modelUrl, { cache: 'no-store' });
  if (!modelResp.ok) throw new Error(`model.json returned HTTP ${modelResp.status}`);
  const modelJson = (await modelResp.json()) as Record<string, unknown>;

  // Fix Keras 3 batch_shape → batch_input_shape before handing to TF.js
  patchInputLayerConfig(modelJson);

  const weightsManifest =
    (modelJson.weightsManifest as Array<Record<string, unknown>> | undefined) ?? [];
  const base = modelUrl.slice(0, modelUrl.lastIndexOf('/') + 1);

  const shardPaths = weightsManifest.flatMap(
    (group) => (group.paths as string[] | undefined) ?? [],
  );
  const weightSpecs = weightsManifest.flatMap(
    (group) => (group.weights as tf.io.WeightsManifestEntry[] | undefined) ?? [],
  );

  const shardBuffers = await Promise.all(
    shardPaths.map(async (relPath) => {
      const resp = await fetch(`${base}${relPath}`, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`${relPath} returned HTTP ${resp.status}`);
      return resp.arrayBuffer();
    }),
  );

  // Build model architecture from topology.  TF.js initialises weights via
  // the layer initializers; we replace them immediately via setWeights().
  const model = await tf.loadLayersModel(
    tf.io.fromMemory({
      modelTopology: modelJson.modelTopology as object,
      format: modelJson.format as string | undefined,
      generatedBy: modelJson.generatedBy as string | undefined,
      convertedBy: modelJson.convertedBy as string | undefined,
    }),
  );

  // Decode weights by position (layer order matches manifest order) and inject.
  const tensors = decodeWeightsFromBuffer(concatArrayBuffers(shardBuffers), weightSpecs);
  model.setWeights(tensors);
  tensors.forEach((t) => t.dispose());

  return model;
}

function getClassNames(): string[] {
  const raw = import.meta.env.VITE_POSE_CLASS_NAMES as string | undefined;
  if (!raw) return [];
  return raw.split(',').map((v) => v.trim()).filter(Boolean);
}

function visibilityFactor(meanKeypointScore: number): number {
  // Soft gating: never fully zero out score, just dampen low-visibility frames.
  const minFactor = 0.65;
  const soft = 0.12;
  const strong = 0.35;
  if (meanKeypointScore <= soft) return minFactor;
  if (meanKeypointScore >= strong) return 1;
  const t = (meanKeypointScore - soft) / (strong - soft);
  return minFactor + t * (1 - minFactor);
}

export function usePoseDetection(
  videoRef: RefObject<HTMLVideoElement>,
  canvasRef: RefObject<HTMLCanvasElement>,
  expectedPoseClass?: string,
): HookResult {
  const candidates = useMemo(() => modelCandidates(), []);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const classifierRef = useRef<tf.LayersModel | null>(null);
  const rafRef = useRef<number | null>(null);
  // Smoothed softmax probabilities carried across frames for EMA
  const smoothedProbsRef = useRef<number[] | null>(null);
  const classNames = useMemo(() => getClassNames(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PoseResult | null>(null);

  // -------------------------------------------------------------------------
  // Model loading
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        await tf.setBackend('webgl');
        await tf.ready();

        // Use SINGLEPOSE_THUNDER for better keypoint accuracy over LIGHTNING.
        // Thunder (~100 ms/frame on GPU) is more accurate than Lightning
        // (~50 ms/frame) for fine-grained joints (wrists, ankles) that matter
        // most for pose classification.
        detectorRef.current = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          { modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER },
        );

        let loadedModel: tf.LayersModel | null = null;
        let lastLoadError = '';
        for (const path of candidates) {
          try {
            await validateModelArtifacts(path);
            loadedModel = await loadPatchedLayersModel(path);
            break;
          } catch (err) {
            lastLoadError = err instanceof Error ? err.message : String(err);
          }
        }

        if (!loadedModel) {
          throw new Error(
            `TF.js model failed to load. Tried: ${candidates.join(', ')}. Last error: ${lastLoadError || 'unknown'}`,
          );
        }
        classifierRef.current = loadedModel;

        if (!cancelled) setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setLoading(false);
          setError(e instanceof Error ? e.message : 'Failed to load pose models');
        }
      }
    }

    loadModels();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      detectorRef.current?.dispose();
      detectorRef.current = null;
      classifierRef.current?.dispose();
      classifierRef.current = null;
    };
  }, [candidates]);

  // -------------------------------------------------------------------------
  // Inference loop
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (loading || error) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !detectorRef.current || !classifierRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset EMA state when the detection loop restarts (e.g. component remounts)
    smoothedProbsRef.current = null;

    const run = async () => {
      try {
        if (
          video.readyState >= 2 &&
          video.videoWidth > 0 &&
          video.videoHeight > 0 &&
          detectorRef.current &&
          classifierRef.current
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const poses = await detectorRef.current.estimatePoses(video);
          if (poses.length > 0) {
            const keypoints = poses[0].keypoints;
            drawSkeleton(ctx, keypoints);

            // ---------------------------------------------------------------
            // Build the 51-element feature vector.
            //
            // Format: [x0/W, y0/H, score0,  x1/W, y1/H, score1,  ...]
            //
            // This matches extract_features.py exactly:
            //   features.extend([x_norm_orig, y_norm_orig, float(score)])
            //
            // MoveNet outputs keypoints in pixel space for the original video
            // frame (the @tensorflow-models/pose-detection library inverts the
            // resize_with_pad padding internally).  We normalise by the canvas
            // dimensions which equal video.videoWidth / video.videoHeight.
            // ---------------------------------------------------------------
            const keypointScores = keypoints
              .map((k) => k.score ?? 0)
              .filter((s) => Number.isFinite(s));
            const meanKeypointScore =
              keypointScores.length > 0
                ? keypointScores.reduce((a, b) => a + b, 0) / keypointScores.length
                : 0;
            const isPoseVisible = meanKeypointScore >= 0.2;
            const visFactor = visibilityFactor(meanKeypointScore);

            const features = keypoints.flatMap((k) => [
              (k.x ?? 0) / canvas.width,
              (k.y ?? 0) / canvas.height,
              k.score ?? 0,
            ]);

            const inputTensor = tf.tensor2d([features], [1, 51]);
            const outputTensor = classifierRef.current.predict(inputTensor) as tf.Tensor;
            const rawProbs = Array.from(await outputTensor.data());
            inputTensor.dispose();
            outputTensor.dispose();

            // ---------------------------------------------------------------
            // Exponential moving average across frames.
            // Smooths frame-to-frame jitter without adding significant latency.
            // α = EMA_ALPHA (weight on current frame), (1 - α) on history.
            // We smooth BEFORE argmax so the predicted label is stable.
            // ---------------------------------------------------------------
            const prev = smoothedProbsRef.current;
            const smoothed = rawProbs.map((p, i) =>
              prev !== null
                ? EMA_ALPHA * p + (1 - EMA_ALPHA) * prev[i]
                : p,
            );
            smoothedProbsRef.current = smoothed;

            // Find the highest-probability class from smoothed distribution
            let bestIdx = 0;
            let bestProb = -1;
            for (let i = 0; i < smoothed.length; i += 1) {
              if (smoothed[i] > bestProb) {
                bestProb = smoothed[i];
                bestIdx = i;
              }
            }

            const label = classNames[bestIdx] ?? `class_${bestIdx}`;

            let expectedConfidence: number | null = null;
            if (expectedPoseClass) {
              const expectedIdx = classNames.findIndex(
                (name) => name.toLowerCase() === expectedPoseClass.toLowerCase(),
              );
              if (expectedIdx >= 0) {
                expectedConfidence = smoothed[expectedIdx] ?? 0;
              }
            }

            // Softly downweight low-visibility frames for the displayed score,
            // but keep the label driven by the smoothed probabilities.
            const gatedTop = bestProb * visFactor;
            const gatedExpected =
              expectedConfidence === null ? null : expectedConfidence * visFactor;

            setResult({
              label,
              confidence: gatedTop,
              expectedConfidence: gatedExpected,
              meanKeypointScore,
              isPoseVisible,
            });
          }
        }
      } catch {
        // Keep loop alive even if one frame fails.
      } finally {
        rafRef.current = requestAnimationFrame(run);
      }
    };

    rafRef.current = requestAnimationFrame(run);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [loading, error, videoRef, canvasRef, classNames, expectedPoseClass]);

  return { loading, error, result };
}

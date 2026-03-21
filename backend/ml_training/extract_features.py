"""
Extract MoveNet Thunder keypoints from a labeled dataset directory.

This script uses the SAME keypoint detector (MoveNet Thunder) and SAME feature
format as the browser's usePoseDetection.ts hook, ensuring training/inference
consistency.

Feature vector per frame: 51 floats interleaved as
    [x0/W, y0/H, score0,  x1/W, y1/H, score1,  ...,  x16/W, y16/H, score16]
which exactly matches:
    keypoints.flatMap(k => [k.x / canvas.width, k.y / canvas.height, k.score])

Expected dataset layout:
  data/
    correct_posture/
      video1.mp4
      ...
    incorrect_posture/
      video2.mp4
      ...

Outputs:
  ml_training/data/features.npy   shape (N, 51)
  ml_training/data/labels.npy     shape (N,)

Install training deps (separate from production requirements):
  pip install tensorflow tensorflow-hub
"""

import argparse
import os
import numpy as np
import cv2
from pathlib import Path

try:
    import tensorflow as tf
    import tensorflow_hub as hub
except ImportError as exc:
    raise ImportError(
        "tensorflow and tensorflow-hub are required for training.\n"
        "Run: pip install tensorflow tensorflow-hub"
    ) from exc

# MoveNet Thunder — matches usePoseDetection.ts (SINGLEPOSE_THUNDER)
# Lightning URL: https://tfhub.dev/google/movenet/singlepose/lightning/4
MOVENET_URL = "https://tfhub.dev/google/movenet/singlepose/thunder/4"
INPUT_SIZE = 256  # Thunder expects 256×256; Lightning uses 192

# Sample every Nth frame to avoid redundant near-identical frames
FRAME_INTERVAL = 5

_movenet_fn = None


def _get_movenet():
    """Lazy-load MoveNet Thunder (cached globally)."""
    global _movenet_fn
    if _movenet_fn is None:
        print(f"Loading MoveNet Thunder from TF Hub ({MOVENET_URL}) …")
        model = hub.load(MOVENET_URL)
        _movenet_fn = model.signatures["serving_default"]
        print("MoveNet loaded.")
    return _movenet_fn


def extract_keypoints_from_frame(frame_bgr: np.ndarray) -> np.ndarray | None:
    """
    Run MoveNet Thunder on one BGR frame and return a (51,) feature vector.

    Coordinate mapping mirrors what @tensorflow-models/pose-detection does
    internally in the browser:
      1. resize_with_pad to INPUT_SIZE × INPUT_SIZE
      2. run inference  → keypoints in padded-image space [0, 1]
      3. invert the padding offset
      4. normalise by the original frame dimensions (= k.x / canvas.width)

    Returns None if MoveNet finds no person (all scores < 0.1).
    """
    movenet = _get_movenet()
    H, W = frame_bgr.shape[:2]

    # BGR → RGB, add batch dim
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    img = tf.image.resize_with_pad(
        tf.expand_dims(tf.cast(frame_rgb, tf.int32), axis=0),
        INPUT_SIZE, INPUT_SIZE,
    )
    img = tf.cast(img, tf.int32)

    # Shape: [1, 1, 17, 3]  —  last dim = [y_norm_padded, x_norm_padded, score]
    kps = _movenet_fn(input=img)["output_0"].numpy()[0, 0]

    # Reject frames where MoveNet cannot locate a person
    if float(kps[:, 2].max()) < 0.1:
        return None

    # Compute the padding that resize_with_pad applied so we can invert it.
    # This reconstructs the pixel coords in the original frame, then normalises
    # by (W, H) — exactly what the browser does with k.x / canvas.width.
    scale = INPUT_SIZE / max(H, W)
    new_H = round(H * scale)
    new_W = round(W * scale)
    pad_top = (INPUT_SIZE - new_H) // 2
    pad_left = (INPUT_SIZE - new_W) // 2

    features: list[float] = []
    for y_norm, x_norm, score in kps:
        # Invert resize_with_pad to recover original-frame pixel coordinates
        x_px = x_norm * INPUT_SIZE - pad_left
        y_px = y_norm * INPUT_SIZE - pad_top
        # Normalise by original frame size (matches browser: k.x / canvas.width)
        x_norm_orig = float(np.clip(x_px / W, 0.0, 1.0))
        y_norm_orig = float(np.clip(y_px / H, 0.0, 1.0))
        features.extend([x_norm_orig, y_norm_orig, float(score)])

    return np.array(features, dtype=np.float32)  # shape (51,)


def extract_from_video(path: str) -> list[np.ndarray]:
    """Extract feature vectors from every FRAME_INTERVAL-th frame of a video."""
    cap = cv2.VideoCapture(path)
    features: list[np.ndarray] = []
    idx = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if idx % FRAME_INTERVAL == 0:
            vec = extract_keypoints_from_frame(frame)
            if vec is not None:
                features.append(vec)
        idx += 1
    cap.release()
    return features


def main(data_dir: str, out_dir: str) -> None:
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    all_features: list[np.ndarray] = []
    all_labels: list[str] = []

    for label in sorted(os.listdir(data_dir)):
        class_dir = os.path.join(data_dir, label)
        if not os.path.isdir(class_dir):
            continue
        for video_file in sorted(os.listdir(class_dir)):
            if not video_file.lower().endswith((".mp4", ".avi", ".mov")):
                continue
            video_path = os.path.join(class_dir, video_file)
            print(f"Processing {video_path}")
            feats = extract_from_video(video_path)
            all_features.extend(feats)
            all_labels.extend([label] * len(feats))
            print(f"  → {len(feats)} frames extracted")

    if not all_features:
        print("No frames extracted — check your data directory and video files.")
        return

    np.save(out_path / "features.npy", np.array(all_features, dtype=np.float32))
    np.save(out_path / "labels.npy", np.array(all_labels))
    print(f"\nSaved {len(all_features)} samples to {out_dir}")
    print("Feature shape:", np.array(all_features).shape)
    print("Label counts:", {
        lbl: all_labels.count(lbl) for lbl in sorted(set(all_labels))
    })


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract MoveNet Thunder keypoint features from labeled video files."
    )
    parser.add_argument(
        "--data", default="ml_training/data/raw",
        help="Root directory containing one sub-folder per pose class"
    )
    parser.add_argument(
        "--out", default="ml_training/data",
        help="Output directory for features.npy and labels.npy"
    )
    args = parser.parse_args()
    main(args.data, args.out)

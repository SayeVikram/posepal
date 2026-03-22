import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Square, Upload, RotateCcw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePoseDetection } from '@/components/PoseCamera/usePoseDetection';

type Phase = 'preview' | 'countdown' | 'recording' | 'review' | 'uploading' | 'done';

/** One sampled frame captured during live recording. */
interface LiveFrameAnalysis {
  ts: number;          // seconds since recording started
  score: number;       // blended live score (shown in the UI)
  is_correct: boolean; // true when label matches expected pose and score >= 0.5
  label: string;       // top predicted pose class
}

const ScoreRing = ({ score }: { score: number }) => {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? '#22c55e' : pct >= 45 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
        <circle
          cx="32" cy="32" r="26"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 26}`}
          strokeDashoffset={`${2 * Math.PI * 26 * (1 - score)}`}
          transform="rotate(-90 32 32)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="32" y="37" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{pct}%</text>
      </svg>
      <span className="mt-1 text-xs font-medium text-white/80">Live score</span>
    </div>
  );
};

const RecordSessionPage = () => {
  const { assignmentId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scoreHistoryRef = useRef<number[]>([]);

  // Collected per-frame accuracy data from the live TF.js model.
  // Sent alongside the video so post-session analysis matches what the user saw.
  const frameAnalysesRef = useRef<LiveFrameAnalysis[]>([]);
  // Wall-clock ms at which recording started — used to compute frame timestamps.
  const recordingStartMsRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>('preview');
  const [countdown, setCountdown] = useState(3);
  const [timer, setTimer] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [liveScore, setLiveScore] = useState<number | null>(null);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const timerRef = useRef<number>();

  const { data: assignment } = useQuery({
    queryKey: ['assignment', assignmentId, token],
    queryFn: () => api.getAssignment(token!, Number(assignmentId)),
    enabled: !!token && !!assignmentId,
  });
  const expectedPoseClass = assignment?.pose?.expectedPoseClass;
  const { result: poseResult, loading: poseLoading, error: poseError } = usePoseDetection(
    videoRef,
    overlayCanvasRef,
    expectedPoseClass,
  );

  // Start camera
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false })
      .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
      .catch(() => {});
    return () => {
      (videoRef.current?.srcObject as MediaStream | null)?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Collect live accuracy data and update live score display during recording.
  useEffect(() => {
    if (phase !== 'recording' || !poseResult) return;

    const expected = poseResult.expectedConfidence;
    let score = poseResult.confidence;
    let is_correct = false;

    if (expected !== null) {
      const targetMatch =
        !!expectedPoseClass &&
        poseResult.label.toLowerCase() === expectedPoseClass.toLowerCase();
      // Blended display score — same formula as before.
      score = targetMatch
        ? Math.max(expected, poseResult.confidence)
        : Math.max(expected * 0.75, poseResult.confidence * 0.25);
      // A frame is correct only when the right pose is predicted with confidence.
      is_correct = targetMatch && expected >= 0.5;
    } else {
      // No expected class configured — fall back to raw confidence.
      is_correct = poseResult.confidence >= 0.5;
    }

    const ts = (Date.now() - recordingStartMsRef.current) / 1000;
    frameAnalysesRef.current.push({ ts, score, is_correct, label: poseResult.label });

    scoreHistoryRef.current.push(score);
    setLiveScore(score);
    const avg = scoreHistoryRef.current.reduce((a, b) => a + b, 0) / scoreHistoryRef.current.length;
    setAvgScore(avg);
  }, [phase, poseResult, expectedPoseClass]);

  const startCountdown = () => {
    setPhase('countdown');
    setCountdown(3);
    let c = 3;
    const interval = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) { clearInterval(interval); startRecording(); }
    }, 1000);
  };

  const startRecording = () => {
    setPhase('recording');
    setTimer(0);
    setLiveScore(null);
    setAvgScore(null);
    scoreHistoryRef.current = [];
    frameAnalysesRef.current = [];
    recordingStartMsRef.current = Date.now();
    chunksRef.current = [];
    const stream = videoRef.current?.srcObject as MediaStream;
    if (!stream) return;
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setRecordedUrl(URL.createObjectURL(blob));
      setPhase('review');
    };
    mr.start();
    mediaRecorderRef.current = mr;
    timerRef.current = window.setInterval(() => setTimer(t => t + 1), 1000);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleUpload = async () => {
    if (!recordedBlob || !token || !assignmentId) return;
    setPhase('uploading');
    setUploadError(null);
    try {
      const session = await api.uploadSession(
        token,
        Number(assignmentId),
        recordedBlob,
        'session.webm',
        frameAnalysesRef.current,
      );
      setSessionId(session.id);
      setPhase('done');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      setPhase('review');
    }
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold">{assignment?.pose?.poseName || 'Record Session'}</h1>

      {assignment?.pose?.instructions && (
        <Card className="border-primary/20 bg-primary/5 shadow-card">
          <CardContent className="p-3 text-sm text-secondary-foreground">
            {assignment.pose.instructions}
          </CardContent>
        </Card>
      )}

      {uploadError && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{uploadError}</p>
      )}

      <div className="relative mx-auto aspect-[4/3] max-w-lg overflow-hidden rounded-2xl bg-foreground/5">
        {phase !== 'review' && phase !== 'done' ? (
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
        ) : recordedUrl ? (
          <video src={recordedUrl} controls className="h-full w-full object-cover" />
        ) : null}
        {phase !== 'review' && phase !== 'done' && (
          <canvas
            ref={overlayCanvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ transform: 'scaleX(-1)' }}
          />
        )}

        <AnimatePresence>
          {phase === 'countdown' && (
            <motion.div
              key="countdown"
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-foreground/40"
            >
              <span className="font-display text-7xl font-bold text-primary-foreground">{countdown}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recording indicator */}
        {phase === 'recording' && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive-foreground" />
            REC {formatTime(timer)}
          </div>
        )}

        {/* Live score overlay */}
        {phase === 'recording' && liveScore !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute right-3 top-3"
          >
            <ScoreRing score={liveScore} />
          </motion.div>
        )}

        {/* Score bar at bottom during recording */}
        {phase === 'recording' && liveScore !== null && (
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/30">
            <motion.div
              className="h-full"
              style={{
                width: `${Math.round(liveScore * 100)}%`,
                backgroundColor: liveScore >= 0.7 ? '#22c55e' : liveScore >= 0.45 ? '#f59e0b' : '#ef4444',
                transition: 'width 0.6s ease, background-color 0.3s ease',
              }}
            />
          </div>
        )}

        {phase === 'uploading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/60 text-primary-foreground">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="mt-3 font-medium">Uploading & analyzing…</p>
          </div>
        )}
      </div>

      {poseError && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          Real-time model error: {poseError}
        </p>
      )}
      {poseLoading && (
        <p className="text-center text-sm text-muted-foreground">Loading on-device pose models…</p>
      )}
      {phase === 'recording' && poseResult && (
        <p className="text-center text-xs text-muted-foreground">
          Predicted: {poseResult.label}
          {expectedPoseClass ? ` | Target: ${expectedPoseClass}` : ''}
          {` | Visibility: ${(poseResult.meanKeypointScore * 100).toFixed(0)}%`}
        </p>
      )}

      {/* Avg score shown in review */}
      {phase === 'review' && avgScore !== null && (
        <Card className="border-primary/20 bg-primary/5 shadow-card">
          <CardContent className="flex items-center gap-3 p-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: avgScore >= 0.7 ? '#22c55e' : avgScore >= 0.45 ? '#f59e0b' : '#ef4444' }}
            >
              {Math.round(avgScore * 100)}%
            </div>
            <div>
              <p className="text-sm font-medium">Session average</p>
              <p className="text-xs text-muted-foreground">Based on {scoreHistoryRef.current.length} samples</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center gap-3">
        {phase === 'preview' && (
          <Button onClick={startCountdown} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            <Camera className="mr-2 h-4 w-4" />
            Start Recording
          </Button>
        )}
        {phase === 'recording' && (
          <Button onClick={stopRecording} variant="destructive" size="lg" className="rounded-full px-6">
            <Square className="mr-2 h-4 w-4" />
            Stop
          </Button>
        )}
        {phase === 'review' && (
          <>
            <Button variant="outline" onClick={() => { setRecordedBlob(null); setRecordedUrl(null); setLiveScore(null); setAvgScore(null); setPhase('preview'); }}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Retake
            </Button>
            <Button onClick={handleUpload} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
              <Upload className="mr-2 h-4 w-4" />
              Upload & Analyze
            </Button>
          </>
        )}
        {phase === 'done' && sessionId && (
          <Button onClick={() => navigate(`/session/${sessionId}`)} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            View Results
          </Button>
        )}
      </div>
    </div>
  );
};

export default RecordSessionPage;

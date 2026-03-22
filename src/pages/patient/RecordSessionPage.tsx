import { useState, useRef, useEffect, useCallback } from 'react';
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

/** One sampled data point collected from the live TF.js model during recording. */
interface FrameSample {
  ts: number;    // seconds since recording started
  score: number; // probability [0-1] that the correct pose is happening
}

const ScoreRing = ({ score }: { score: number }) => {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? 'hsl(var(--success))' : pct >= 45 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';
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

  // Per-frame accuracy samples collected from the live TF.js model.
  // Sent to the backend on upload — post-session scores come from here directly.
  const frameSamplesRef = useRef<FrameSample[]>([]);
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

  const { data: todayCount = 0 } = useQuery({
    queryKey: ['today-count', assignmentId, token],
    queryFn: () => api.getTodaySessionCount(token!, Number(assignmentId)),
    enabled: !!token && !!assignmentId && !!assignment?.maxSessionsPerDay,
  });

  const dailyLimitReached =
    !!assignment?.maxSessionsPerDay && todayCount >= assignment.maxSessionsPerDay;

  const startCamera = useCallback(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false })
      .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
      .catch(() => {});
  }, []);

  const stopCamera = useCallback(() => {
    (videoRef.current?.srcObject as MediaStream | null)?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Cleanup only — camera starts when the user clicks "Start Recording"
  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stopCamera]);

  // Collect per-frame accuracy from the live TF.js model during recording.
  // Score = probability that the CORRECT pose is happening right now.
  // This is the single source of truth — post-session analysis uses this array.
  useEffect(() => {
    if (phase !== 'recording' || !poseResult) return;

    // expectedConfidence = model's softmax probability for the assigned pose class.
    // This is the most direct measure of "is the patient doing the right pose?"
    // Falls back to 0 when the expected class isn't found in VITE_POSE_CLASS_NAMES
    // (conservative — unknown config should not inflate accuracy).
    const score = expectedPoseClass
      ? (poseResult.expectedConfidence ?? 0)
      : poseResult.confidence;

    // Debug: log every 30th sample so you can see data flowing in DevTools.
    if (frameSamplesRef.current.length % 30 === 0) {
      console.log(
        `[PosePal] Frame #${frameSamplesRef.current.length}: label=${poseResult.label} score=${score.toFixed(3)} expectedClass=${expectedPoseClass ?? 'none'} expectedConf=${poseResult.expectedConfidence?.toFixed(3) ?? 'null'}`,
      );
    }

    const ts = (Date.now() - recordingStartMsRef.current) / 1000;
    frameSamplesRef.current.push({ ts, score });
    scoreHistoryRef.current.push(score);
    setLiveScore(score);
    const avg = scoreHistoryRef.current.reduce((a, b) => a + b, 0) / scoreHistoryRef.current.length;
    setAvgScore(avg);
  }, [phase, poseResult, expectedPoseClass]);

  const startCountdown = () => {
    startCamera();
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
    frameSamplesRef.current = [];
    recordingStartMsRef.current = Date.now();
    chunksRef.current = [];
    const stream = videoRef.current?.srcObject as MediaStream;
    if (!stream) return;
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      stopCamera();
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
      const samples = frameSamplesRef.current;
      console.log(
        `[PosePal] Uploading session: ${samples.length} frame samples collected.`,
        samples.length > 0
          ? `First: ts=${samples[0].ts.toFixed(2)}s score=${samples[0].score.toFixed(3)} | Last: ts=${samples[samples.length - 1].ts.toFixed(2)}s score=${samples[samples.length - 1].score.toFixed(3)}`
          : 'NO SAMPLES — TF.js model may not have run during recording.',
      );
      const session = await api.uploadSession(
        token,
        Number(assignmentId),
        recordedBlob,
        'session.webm',
        samples,
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

      {(assignment?.demoImageUrl || assignment?.demoVideoUrl || assignment?.pose?.instructions) && (
        <Card className="border-primary/20 bg-primary/5 shadow-card">
          <CardContent className="p-3 space-y-3">
            {assignment.demoImageUrl && (
              <img
                src={assignment.demoImageUrl}
                alt="Demo"
                className="w-full rounded-lg object-cover max-h-48"
              />
            )}
            {assignment.demoVideoUrl && (
              <video
                src={assignment.demoVideoUrl}
                controls
                className="w-full rounded-lg max-h-48"
              />
            )}
            {assignment.pose?.instructions && (
              <p className="text-sm text-secondary-foreground">{assignment.pose.instructions}</p>
            )}
          </CardContent>
        </Card>
      )}

      {uploadError && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{uploadError}</p>
      )}

      <div className="relative mx-auto aspect-[4/3] max-w-lg overflow-hidden rounded-lg bg-foreground/5">
        {phase === 'preview' ? (
          <div className="flex h-full items-center justify-center">
            <Camera className="h-16 w-16 text-muted-foreground/20" />
          </div>
        ) : phase !== 'review' && phase !== 'done' ? (
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

        {phase === 'recording' && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive-foreground" />
            REC {formatTime(timer)}
          </div>
        )}

        {phase === 'recording' && liveScore !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute right-3 top-3"
          >
            <ScoreRing score={liveScore} />
          </motion.div>
        )}

        {phase === 'recording' && liveScore !== null && (
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/30">
            <motion.div
              className="h-full"
              style={{
                width: `${Math.round(liveScore * 100)}%`,
                backgroundColor: liveScore >= 0.7 ? 'hsl(var(--success))' : liveScore >= 0.45 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))',
                transition: 'width 0.6s ease, background-color 0.3s ease',
              }}
            />
          </div>
        )}

        {phase === 'uploading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/60 text-primary-foreground">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="mt-3 font-medium">Uploading…</p>
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

      {phase === 'review' && avgScore !== null && (
        <Card className="border-primary/20 bg-primary/5 shadow-card">
          <CardContent className="flex items-center gap-3 p-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${avgScore >= 0.7 ? 'bg-success text-success-foreground' : avgScore >= 0.45 ? 'bg-warning text-warning-foreground' : 'bg-destructive text-destructive-foreground'}`}
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

      {dailyLimitReached && phase === 'preview' && (
        <p className="rounded-lg bg-warning/10 p-3 text-sm text-warning font-medium text-center">
          Daily limit reached — your therapist allows {assignment!.maxSessionsPerDay} session
          {assignment!.maxSessionsPerDay !== 1 ? 's' : ''} per day for this exercise.
          Come back tomorrow!
        </p>
      )}

      <div className="flex justify-center gap-3">
        {phase === 'preview' && (
          <Button
            onClick={startCountdown}
            disabled={dailyLimitReached}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
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
            <Button variant="outline" onClick={() => { setRecordedBlob(null); setRecordedUrl(null); setLiveScore(null); setAvgScore(null); startCamera(); setPhase('preview'); }}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Retake
            </Button>
            <Button onClick={handleUpload} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Upload className="mr-2 h-4 w-4" />
              Upload & Analyze
            </Button>
          </>
        )}
        {phase === 'done' && sessionId && (
          <Button onClick={() => navigate(`/session/${sessionId}`)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            View Results
          </Button>
        )}
      </div>
    </div>
  );
};

export default RecordSessionPage;

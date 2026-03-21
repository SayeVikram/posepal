import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api, mockAssignments } from '@/services/mockData';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Square, Upload, RotateCcw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Phase = 'preview' | 'countdown' | 'recording' | 'review' | 'uploading' | 'done';

const RecordSessionPage = () => {
  const { assignmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [phase, setPhase] = useState<Phase>('preview');
  const [countdown, setCountdown] = useState(3);
  const [timer, setTimer] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const timerRef = useRef<number>();

  const assignment = mockAssignments.find(a => a.id === assignmentId);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {});
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCountdown = () => {
    setPhase('countdown');
    setCountdown(3);
    let c = 3;
    const interval = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(interval);
        startRecording();
      }
    }, 1000);
  };

  const startRecording = () => {
    setPhase('recording');
    setTimer(0);
    chunksRef.current = [];
    const stream = videoRef.current?.srcObject as MediaStream;
    if (!stream) return;

    const mr = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
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

  const handleUpload = () => {
    setPhase('uploading');
    setTimeout(() => {
      const session = api.uploadSession(user!.id, assignmentId!);
      setSessionId(session.id);
      setPhase('done');
    }, 2500);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold">{assignment?.pose?.poseName || 'Record Session'}</h1>
      {assignment?.pose?.instructions && (
        <Card className="border-primary/20 bg-primary/5 shadow-card">
          <CardContent className="p-3 text-sm text-secondary-foreground">{assignment.pose.instructions}</CardContent>
        </Card>
      )}

      <div className="relative mx-auto aspect-[4/3] max-w-lg overflow-hidden rounded-2xl bg-foreground/5">
        {phase !== 'review' && phase !== 'done' ? (
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
        ) : recordedUrl ? (
          <video src={recordedUrl} controls className="h-full w-full object-cover" />
        ) : null}

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

        {phase === 'uploading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/60 text-primary-foreground">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="mt-3 font-medium">Analyzing pose...</p>
          </div>
        )}
      </div>

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
            <Button variant="outline" onClick={() => { setRecordedUrl(null); setPhase('preview'); }}>
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

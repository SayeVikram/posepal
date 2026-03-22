import { useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api, TimelineEntry } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
const scoreColor = (s: number) => s >= 0.8 ? 'text-success' : s >= 0.6 ? 'text-warning' : 'text-destructive';
import CorrectnessTimeline from '@/components/CorrectnessTimeline';
import SessionVideoPlayer, { VideoPlayerHandle } from '@/components/SessionVideoPlayer';
import { AlertTriangle, CheckCircle2, BarChart3, Loader2, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const severityColor = {
  low:      'bg-warning/10 text-warning border-warning/20',
  moderate: 'bg-warning/15 text-warning border-warning/30',
  high:     'bg-destructive/10 text-destructive border-destructive/20',
};

interface LowAccuracySegment { start: number; end: number; }

function getLowAccuracySegments(timeline: TimelineEntry[], minDuration = 0.1): LowAccuracySegment[] {
  const segments: LowAccuracySegment[] = [];
  let start: number | null = null;
  let prevTs = 0;
  for (const entry of timeline) {
    if (!entry.isCorrect) {
      if (start === null) start = entry.timestamp;
    } else {
      if (start !== null) {
        if (prevTs - start >= minDuration) segments.push({ start, end: prevTs });
        start = null;
      }
    }
    prevTs = entry.timestamp;
  }
  if (start !== null && prevTs - start >= minDuration) segments.push({ start, end: prevTs });
  return segments;
}

function fmt(s: number): string { return `${s.toFixed(1)}s`; }

const SessionDetailPage = () => {
  const { sessionId } = useParams();
  const { token, isTherapist } = useAuth();
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', sessionId, token, isTherapist],
    queryFn: () => isTherapist
      ? api.getTherapistSession(token!, Number(sessionId))
      : api.getSession(token!, Number(sessionId)),
    enabled: !!token && !!sessionId,
  });

  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['session-analysis', sessionId, token, isTherapist],
    queryFn: () => isTherapist
      ? api.getTherapistSessionAnalysis(token!, Number(sessionId))
      : api.getSessionAnalysis(token!, Number(sessionId)),
    enabled: !!token && !!sessionId && !!session?.processed,
  });

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) return <p className="py-12 text-center text-muted-foreground">Session not found.</p>;

  if (!session.processed) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">{session.poseName ?? 'Session'}</h1>
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-3 p-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <div>
              <p className="font-semibold">Processing video…</p>
              <p className="text-sm text-muted-foreground">Analysis will appear here once complete.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session.processingError) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">{session.poseName ?? 'Session'}</h1>
        <p className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{session.processingError}</p>
      </div>
    );
  }

  if (analysisLoading || !analysis) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const lowAccuracySegments = getLowAccuracySegments(analysis.timeline);

  return (
    <div className="space-y-6">
      {/* Hero score */}
      <div className="border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Session Result</p>
        <div className="mt-1 flex items-end gap-4">
          <p className={`font-display text-8xl font-bold leading-none tracking-tight ${scoreColor(analysis.overallCorrectness)}`}>
            {Math.round(analysis.overallCorrectness * 100)}%
          </p>
          <div className="mb-1">
            <h1 className="font-display text-2xl font-bold text-foreground leading-tight">{session.poseName}</h1>
            <p className="text-xs text-muted-foreground">{new Date(session.recordedAt).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Video */}
      {session.videoUrl && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <SessionVideoPlayer ref={videoPlayerRef} url={session.videoUrl} />
        </motion.div>
      )}

      {/* Summary */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <BarChart3 className="h-4 w-4 text-primary" />
              Session Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex divide-x divide-border border border-border rounded-md overflow-hidden">
              {[
                { label: 'Total',     value: analysis.totalFrames,                          cls: 'text-foreground' },
                { label: 'Correct',   value: analysis.correctFrames,                         cls: 'text-success'    },
                { label: 'Incorrect', value: analysis.totalFrames - analysis.correctFrames,  cls: 'text-destructive'},
              ].map(s => (
                <div key={s.label} className="flex-1 p-4">
                  <p className={`font-display text-4xl font-bold leading-none tracking-tight ${s.cls}`}>{s.value}</p>
                  <p className="mt-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {analysis.timeline.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Correctness Timeline
                </p>
                <CorrectnessTimeline timeline={analysis.timeline} />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>0s</span>
                  <span>{analysis.timeline[analysis.timeline.length - 1]?.timestamp.toFixed(0)}s</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Low-accuracy segments */}
      {lowAccuracySegments.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-destructive/20 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Clock className="h-4 w-4 text-destructive" />
                Low-Accuracy Moments
                <Badge variant="outline" className="ml-auto border-destructive/30 text-xs text-destructive">
                  {lowAccuracySegments.length} segment{lowAccuracySegments.length > 1 ? 's' : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Click a timestamp to jump to that moment.</p>
              <div className="flex flex-wrap gap-2">
                {lowAccuracySegments.map((seg, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 font-mono text-xs text-destructive hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => videoPlayerRef.current?.seekTo(seg.start)}
                    disabled={!session.videoUrl}
                  >
                    {fmt(seg.start)}{seg.end > seg.start + 0.1 ? ` – ${fmt(seg.end)}` : ''}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Areas of concern */}
      {analysis.areasOfConcern.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-border/50 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Areas of Concern
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.areasOfConcern.map((concern, i) => (
                <div key={i} className={`rounded-md border p-3 ${severityColor[concern.severity]}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{concern.bodyPart}</span>
                    <Badge variant="outline" className="text-xs capitalize">{concern.severity}</Badge>
                  </div>
                  <p className="mt-1 text-sm opacity-80">{concern.issue}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {concern.timestamps.map((t, j) => (
                      <Button
                        key={j}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 font-mono text-xs opacity-70 hover:opacity-100"
                        onClick={() => videoPlayerRef.current?.seekTo(t)}
                        disabled={!session.videoUrl}
                      >
                        {fmt(t)}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Success */}
      {analysis.overallCorrectness >= 0.8 && (
        <Card className="border-success/20 bg-success/5 shadow-card">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <span className="font-semibold text-success">Great job! Your form is looking excellent.</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SessionDetailPage;

import { useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api, TimelineEntry } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ScoreBadge from '@/components/ScoreBadge';
import CorrectnessTimeline from '@/components/CorrectnessTimeline';
import SessionVideoPlayer, { VideoPlayerHandle } from '@/components/SessionVideoPlayer';
import { AlertTriangle, CheckCircle2, BarChart3, Loader2, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const severityColor = {
  low: 'bg-warning/10 text-warning border-warning/20',
  moderate: 'bg-warning/15 text-warning border-warning/30',
  high: 'bg-destructive/10 text-destructive border-destructive/20',
};

interface LowAccuracySegment {
  start: number;
  end: number;
}

/**
 * Groups consecutive incorrect frames into contiguous segments.
 * Segments shorter than `minDuration` seconds are filtered out to reduce noise.
 */
function getLowAccuracySegments(
  timeline: TimelineEntry[],
  minDuration = 0.1,
): LowAccuracySegment[] {
  const segments: LowAccuracySegment[] = [];
  let start: number | null = null;
  let prevTs = 0;

  for (const entry of timeline) {
    if (!entry.isCorrect) {
      if (start === null) start = entry.timestamp;
    } else {
      if (start !== null) {
        if (prevTs - start >= minDuration) {
          segments.push({ start, end: prevTs });
        }
        start = null;
      }
    }
    prevTs = entry.timestamp;
  }

  // Close any open segment at the end of the timeline
  if (start !== null && prevTs - start >= minDuration) {
    segments.push({ start, end: prevTs });
  }

  return segments;
}

function fmt(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SessionDetailPage = () => {
  const { sessionId } = useParams();
  const { token, isTherapist } = useAuth();
  const videoPlayerRef = useRef<VideoPlayerHandle>(null);

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', sessionId, token, isTherapist],
    queryFn: () =>
      isTherapist
        ? api.getTherapistSession(token!, Number(sessionId))
        : api.getSession(token!, Number(sessionId)),
    enabled: !!token && !!sessionId,
  });

  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['session-analysis', sessionId, token, isTherapist],
    queryFn: () =>
      isTherapist
        ? api.getTherapistSessionAnalysis(token!, Number(sessionId))
        : api.getSessionAnalysis(token!, Number(sessionId)),
    enabled: !!token && !!sessionId && !!session?.processed,
  });

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <p className="py-12 text-center text-muted-foreground">Session not found.</p>;
  }

  if (!session.processed) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-bold">{session.poseName ?? 'Session'}</h1>
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-3 p-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <div>
              <p className="font-medium">Processing video…</p>
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
        <h1 className="font-display text-xl font-bold">{session.poseName ?? 'Session'}</h1>
        <p className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{session.processingError}</p>
      </div>
    );
  }

  if (analysisLoading || !analysis) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const lowAccuracySegments = getLowAccuracySegments(analysis.timeline);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <ScoreBadge score={analysis.overallCorrectness} size="lg" />
        <div>
          <h1 className="font-display text-2xl font-bold">{session.poseName}</h1>
          <p className="text-sm text-muted-foreground">{new Date(session.recordedAt).toLocaleString()}</p>
        </div>
      </div>

      {/* Video player */}
      {session.videoUrl && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <SessionVideoPlayer ref={videoPlayerRef} url={session.videoUrl} />
        </motion.div>
      )}

      {/* Session summary */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Session Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-2xl font-bold">{analysis.totalFrames}</p>
                <p className="text-xs text-muted-foreground">Total Frames</p>
              </div>
              <div className="rounded-lg bg-success/10 p-3 text-center">
                <p className="text-2xl font-bold text-success">{analysis.correctFrames}</p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
              <div className="rounded-lg bg-destructive/10 p-3 text-center">
                <p className="text-2xl font-bold text-destructive">{analysis.totalFrames - analysis.correctFrames}</p>
                <p className="text-xs text-muted-foreground">Incorrect</p>
              </div>
            </div>

            {analysis.timeline.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">Correctness Timeline</p>
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

      {/* Low-accuracy segments — clickable timestamps */}
      {lowAccuracySegments.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-card border-destructive/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-destructive" />
                Low-Accuracy Moments
                <Badge variant="outline" className="ml-auto text-xs text-destructive border-destructive/30">
                  {lowAccuracySegments.length} segment{lowAccuracySegments.length > 1 ? 's' : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                Click a timestamp to jump to that moment in the video.
              </p>
              <div className="flex flex-wrap gap-2">
                {lowAccuracySegments.map((seg, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive font-mono text-xs"
                    onClick={() => videoPlayerRef.current?.seekTo(seg.start)}
                    disabled={!session.videoUrl}
                  >
                    {fmt(seg.start)}
                    {seg.end > seg.start + 0.1 ? ` – ${fmt(seg.end)}` : ''}
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
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Areas of Concern
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.areasOfConcern.map((concern, i) => (
                <div key={i} className={`rounded-lg border p-3 ${severityColor[concern.severity]}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{concern.bodyPart}</span>
                    <Badge variant="outline" className="text-xs capitalize">{concern.severity}</Badge>
                  </div>
                  <p className="mt-1 text-sm opacity-80">{concern.issue}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {concern.timestamps.map((t, j) => (
                      <Button
                        key={j}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs font-mono opacity-70 hover:opacity-100"
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

      {/* Success message */}
      {analysis.overallCorrectness >= 0.8 && (
        <Card className="border-success/20 bg-success/5 shadow-card">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <span className="font-medium text-success">Great job! Your form is looking excellent.</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SessionDetailPage;

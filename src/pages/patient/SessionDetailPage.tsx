import { useParams } from 'react-router-dom';
import { api } from '@/services/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ScoreBadge from '@/components/ScoreBadge';
import CorrectnessTimeline from '@/components/CorrectnessTimeline';
import { AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

const severityColor = {
  low: 'bg-warning/10 text-warning border-warning/20',
  moderate: 'bg-warning/15 text-warning border-warning/30',
  high: 'bg-destructive/10 text-destructive border-destructive/20',
};

const SessionDetailPage = () => {
  const { sessionId } = useParams();
  const session = api.getSessionAnalysis(sessionId!);

  if (!session || !session.analysis) {
    return <p className="py-12 text-center text-muted-foreground">Session not found.</p>;
  }

  const { analysis } = session;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <ScoreBadge score={analysis.overallCorrectness} size="lg" />
        <div>
          <h1 className="font-display text-2xl font-bold">{session.poseName}</h1>
          <p className="text-sm text-muted-foreground">{new Date(session.recordedAt).toLocaleString()}</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
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

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Correctness Timeline</p>
              <CorrectnessTimeline timeline={analysis.timeline} />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>0s</span>
                <span>{analysis.timeline[analysis.timeline.length - 1]?.timestamp.toFixed(0)}s</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {analysis.areasOfConcern.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
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
                  <p className="mt-1 text-xs opacity-60">
                    At: {concern.timestamps.map(t => `${t.toFixed(1)}s`).join(', ')}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

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

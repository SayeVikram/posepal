import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import ScoreBadge from '@/components/ScoreBadge';
import { motion } from 'framer-motion';

const SessionHistoryPage = () => {
  const { user } = useAuth();
  const sessions = api.getSessions(user!.id).slice().reverse();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Session History</h1>
      <div className="space-y-3">
        {sessions.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={`/session/${s.id}`}>
              <Card className="shadow-card transition-shadow hover:shadow-elevated">
                <CardContent className="flex items-center gap-4 p-4">
                  <ScoreBadge score={s.analysis?.overallCorrectness || 0} />
                  <div className="flex-1">
                    <p className="font-display font-semibold">{s.poseName}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(s.recordedAt).toLocaleDateString()} · {s.analysis?.totalFrames} frames analyzed
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
        {!sessions.length && (
          <p className="py-12 text-center text-muted-foreground">No sessions yet. Record your first exercise session!</p>
        )}
      </div>
    </div>
  );
};

export default SessionHistoryPage;

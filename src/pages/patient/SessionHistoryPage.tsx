import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import ScoreBadge from '@/components/ScoreBadge';
import { TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const SessionHistoryPage = () => {
  const { token } = useAuth();

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', token],
    queryFn: () => api.getSessions(token!),
    enabled: !!token,
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Session History</h1>
      <div className="space-y-3">
        {sessions.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={`/session/${s.id}`}>
              <Card className="shadow-card transition-shadow hover:shadow-elevated">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1">
                    <p className="font-display font-semibold">{s.poseName ?? 'Session'}</p>
                    <p className="text-sm text-muted-foreground">{new Date(s.recordedAt).toLocaleDateString()}</p>
                  </div>
                  {s.processed && <TrendingUp className="h-4 w-4 text-success" />}
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

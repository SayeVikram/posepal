import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import ScoreBadge from '@/components/ScoreBadge';
import { motion } from 'framer-motion';

const PatientDashboard = () => {
  const { user, token } = useAuth();

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', token],
    queryFn: () => api.getAssignments(token!),
    enabled: !!token,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', token],
    queryFn: () => api.getSessions(token!),
    enabled: !!token,
  });

  const pending = assignments.filter(a => a.status === 'pending').length;
  const completed = assignments.filter(a => a.status === 'completed').length;
  const recentSessions = sessions.slice(0, 3);

  const stats = [
    { label: 'Pending', value: pending, icon: Clock, color: 'text-warning' },
    { label: 'Completed', value: completed, icon: CheckCircle2, color: 'text-success' },
    { label: 'Total Exercises', value: assignments.length, icon: ClipboardList, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Welcome back, {user?.name?.split(' ')[0]}</h1>
        <p className="text-muted-foreground">Here's your therapy overview</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="shadow-card">
              <CardContent className="flex flex-col items-center p-4">
                <s.icon className={`h-5 w-5 ${s.color}`} />
                <span className="mt-1 text-2xl font-bold">{s.value}</span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {recentSessions.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-lg font-semibold">Recent Sessions</h2>
          <div className="space-y-3">
            {recentSessions.map(s => (
              <Link key={s.id} to={`/session/${s.id}`}>
                <Card className="shadow-card transition-shadow hover:shadow-elevated">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1">
                      <p className="font-medium">{s.poseName ?? 'Session'}</p>
                      <p className="text-xs text-muted-foreground">{new Date(s.recordedAt).toLocaleDateString()}</p>
                    </div>
                    {s.processed && <TrendingUp className="h-4 w-4 text-success" />}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {pending > 0 && (
        <Link to="/assignments">
          <Card className="cursor-pointer border-primary/20 bg-primary/5 shadow-card transition-shadow hover:shadow-elevated">
            <CardContent className="flex items-center gap-3 p-4">
              <ClipboardList className="h-5 w-5 text-primary" />
              <span className="font-medium text-primary">You have {pending} pending assignment{pending !== 1 ? 's' : ''}</span>
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
};

export default PatientDashboard;

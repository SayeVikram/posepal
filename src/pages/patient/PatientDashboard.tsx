import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useCountUp } from '@/hooks/useCountUp';
import { ClipboardList, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
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

  const pending   = assignments.filter(a => a.status === 'pending').length;
  const completed = assignments.filter(a => a.status === 'completed').length;
  const recentSessions = sessions.slice(0, 3);

  const pendingCount   = useCountUp(pending, 700);
  const completedCount = useCountUp(completed, 800);
  const totalCount     = useCountUp(assignments.length, 900);

  const stats = [
    { label: 'Pending',   value: pendingCount,    color: 'text-warning' },
    { label: 'Completed', value: completedCount,  color: 'text-success' },
    { label: 'Total',     value: totalCount,       color: 'text-foreground' },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Overview</p>
        <h1 className="mt-2 font-display text-6xl font-bold text-foreground leading-none tracking-tight">
          Hey, {user?.name?.split(' ')[0]}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Here's your therapy progress</p>
      </div>

      {/* Stats strip */}
      <div className="flex divide-x divide-border border-y border-border py-6">
        {stats.map(s => (
          <div key={s.label} className="flex-1 px-5 first:pl-0 last:pr-0">
            <p className={`font-display text-7xl font-bold leading-none tracking-tight ${s.color}`}>{s.value}</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pending call-to-action */}
      {pending > 0 && (
        <Link to="/assignments">
          <div className="group flex items-center gap-4 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/40">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
              <ClipboardList className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary">
                {pending} pending assignment{pending !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-muted-foreground">Tap to view and start your exercises</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      )}

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-xl font-bold">Recent Sessions</h2>
            <Link to="/history" className="text-xs text-primary hover:text-primary/80 transition-colors">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-border rounded-md border border-border">
            {recentSessions.map((s, i) => (
              <Link key={s.id} to={`/session/${s.id}`}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="group flex items-center gap-4 p-4 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{s.poseName ?? 'Session'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.recordedAt).toLocaleDateString()}</p>
                  </div>
                  {s.processed && <TrendingUp className="h-3.5 w-3.5 text-success" />}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;

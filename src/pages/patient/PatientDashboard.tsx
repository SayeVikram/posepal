import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useCountUp } from '@/hooks/useCountUp';
import { ClipboardList, TrendingUp, ArrowRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import SectionHeader from '@/components/SectionHeader';

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
      <PageHeader
        eyebrow="Overview"
        title={`Hey, ${user?.name?.split(' ')[0]}`}
        subtitle="Here's your therapy progress"
        size="lg"
      />

      {/* Stats strip */}
      <div className="flex divide-x divide-border border-y border-border py-6">
        {stats.map(s => (
          <div key={s.label} className="flex-1 px-5 first:pl-0 last:pr-0">
            <p className={`font-display text-7xl font-bold leading-none tracking-tight ${s.color}`}>{s.value}</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* First-time empty state — no assignments at all */}
      {assignments.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-md border border-border"
        >
          <div className="flex items-start gap-4 p-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Waiting for your first assignment</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your therapist will assign exercises to you shortly. Once assigned, they'll appear here and on the Assignments page — ready to record whenever you are.
              </p>
            </div>
          </div>
        </motion.div>
      )}

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
          <SectionHeader title="Recent Sessions" href="/history" />
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

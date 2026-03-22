import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList, CheckCircle2, Clock, TrendingUp, ArrowRight } from 'lucide-react';
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

  const stats = [
    { label: 'Pending',   value: pending,              icon: Clock,          color: 'text-warning',  bg: 'bg-warning/10' },
    { label: 'Completed', value: completed,             icon: CheckCircle2,   color: 'text-success',  bg: 'bg-success/10' },
    { label: 'Total',     value: assignments.length,   icon: ClipboardList,  color: 'text-primary',  bg: 'bg-primary/10' },
  ];

  return (
    <div className="space-y-10">
      {/* Hero greeting */}
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Overview</p>
        <h1 className="mt-1 font-display text-4xl font-bold text-foreground">
          Hey, {user?.name?.split(' ')[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">Here's your therapy progress</p>
      </div>

      {/* Pending call-to-action */}
      {pending > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/assignments">
            <div className="group flex items-center gap-4 rounded-md border border-border bg-card p-5 transition-colors hover:border-primary/40">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold text-primary">
                    {pending} pending assignment{pending !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">Tap to view and start your exercises</p>
                </div>
                <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="border-border/50 shadow-card">
              <CardContent className="flex flex-col items-center gap-2 p-5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.bg}`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <span className="font-display text-3xl font-black">{s.value}</span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Recent Sessions</h2>
            <Link to="/history" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {recentSessions.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={`/session/${s.id}`}>
                  <Card className="group border-border/50 shadow-card transition-all hover:border-border hover:shadow-elevated">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex-1">
                        <p className="font-semibold">{s.poseName ?? 'Session'}</p>
                        <p className="text-xs text-muted-foreground">{new Date(s.recordedAt).toLocaleDateString()}</p>
                      </div>
                      {s.processed && <TrendingUp className="h-4 w-4 text-success" />}
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;

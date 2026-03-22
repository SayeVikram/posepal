import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Activity, ClipboardCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const TherapistDashboard = () => {
  const { user, token } = useAuth();

  const { data: patients = [] } = useQuery({
    queryKey: ['therapist-patients', token],
    queryFn: () => api.getPatients(token!),
    enabled: !!token,
  });

  const { data: poses = [] } = useQuery({
    queryKey: ['poses', token],
    queryFn: () => api.getPoses(token!),
    enabled: !!token,
  });

  const stats = [
    { label: 'Patients',       value: patients.length, icon: Users,         color: 'text-primary',  accent: 'border-t-primary' },
    { label: 'Pose Templates', value: poses.length,    icon: Activity,      color: 'text-accent',   accent: 'border-t-accent'  },
    { label: 'Sessions',       value: '—',             icon: ClipboardCheck,color: 'text-success',  accent: 'border-t-success' },
  ];

  return (
    <div className="space-y-10">
      {/* Hero greeting */}
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Practice Overview</p>
        <h1 className="mt-1 font-display text-4xl font-bold text-foreground">
          Welcome, {user?.name?.split(' ')[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">Manage your patients and exercises</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className={`border-border/50 shadow-card border-t-2 ${s.accent} overflow-hidden`}>
              <CardContent className="flex flex-col items-center gap-1.5 p-4">
                <span className={`font-display text-3xl font-bold ${s.color}`}>{s.value}</span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Patients preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Patients</h2>
          <Link to="/patients" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
            View all →
          </Link>
        </div>
        <div className="space-y-2">
          {patients.slice(0, 4).map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/patient/${p.id}`}>
                <Card className="group border-border/50 shadow-card transition-all hover:border-border hover:shadow-elevated">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-secondary font-display text-sm font-bold text-foreground">
                      {p.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.email}</p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
          {!patients.length && (
            <p className="rounded-xl border border-border/40 py-10 text-center text-sm text-muted-foreground">
              No patients yet. Assign a pose to get started.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TherapistDashboard;

import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
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
    { label: 'Patients',       value: patients.length, color: 'text-primary'    },
    { label: 'Pose Templates', value: poses.length,    color: 'text-accent'     },
    { label: 'Sessions',       value: '—',             color: 'text-foreground' },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Practice Overview</p>
        <h1 className="mt-2 font-display text-5xl font-bold text-foreground leading-none">
          Welcome, {user?.name?.split(' ')[0]}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage your patients and exercises</p>
      </div>

      {/* Stats strip */}
      <div className="flex divide-x divide-border border-y border-border py-5">
        {stats.map(s => (
          <div key={s.label} className="flex-1 px-5 first:pl-0 last:pr-0">
            <p className={`font-display text-4xl font-bold leading-none ${s.color}`}>{s.value}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Patients */}
      <div>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">Patients</h2>
          <Link to="/patients" className="text-xs text-primary hover:text-primary/80 transition-colors">
            View all →
          </Link>
        </div>
        {patients.length > 0 ? (
          <div className="divide-y divide-border rounded-md border border-border">
            {patients.slice(0, 4).map((p, i) => (
              <Link key={p.id} to={`/patient/${p.id}`}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="group flex items-center gap-3 p-4 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary font-display text-xs font-bold text-foreground">
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </motion.div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-border py-10 text-center text-sm text-muted-foreground">
            No patients yet. Assign a pose to get started.
          </p>
        )}
      </div>
    </div>
  );
};

export default TherapistDashboard;

import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Activity, ClipboardCheck } from 'lucide-react';
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
    { label: 'Patients', value: patients.length, icon: Users, color: 'text-primary' },
    { label: 'Pose Templates', value: poses.length, icon: Activity, color: 'text-accent' },
    { label: 'Sessions', value: '—', icon: ClipboardCheck, color: 'text-success' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Welcome, {user?.name}</h1>
        <p className="text-muted-foreground">Your practice overview</p>
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

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Patients</h2>
          <Link to="/patients" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        <div className="space-y-3">
          {patients.slice(0, 3).map(p => (
            <Link key={p.id} to={`/patient/${p.id}`}>
              <Card className="shadow-card transition-shadow hover:shadow-elevated">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-display font-bold text-primary">
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {!patients.length && (
            <p className="py-8 text-center text-muted-foreground text-sm">No patients yet. Assign a pose to get started.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TherapistDashboard;

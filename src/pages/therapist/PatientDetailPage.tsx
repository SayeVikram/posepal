import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import CorrectnessTimeline from '@/components/CorrectnessTimeline';
import { Loader2, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const PatientDetailPage = () => {
  const { patientId } = useParams();
  const { token } = useAuth();

  const { data: allPatients = [], isLoading } = useQuery({
    queryKey: ['all-patients', token],
    queryFn: () => api.getAllPatients(token!),
    enabled: !!token,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['patient-sessions', patientId, token],
    queryFn: () => api.getPatientSessions(token!, Number(patientId)),
    enabled: !!token && !!patientId,
  });

  const patient = allPatients.find(u => u.id === Number(patientId));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!patient) return <p className="py-12 text-center text-muted-foreground">Patient not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 font-display text-xl font-bold text-primary">
          {patient.name.charAt(0)}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">{patient.name}</h1>
          <p className="text-sm text-muted-foreground">{patient.email}</p>
        </div>
      </div>

      <h2 className="font-display text-lg font-semibold">Sessions ({sessions.length})</h2>
      <div className="space-y-3">
        {sessions.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={`/session/${s.id}`}>
              <Card className="shadow-card transition-shadow hover:shadow-elevated">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1">
                    <p className="font-display font-semibold">{s.poseName ?? 'Session'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.recordedAt).toLocaleString()}</p>
                  </div>
                  {s.processed && <TrendingUp className="h-4 w-4 text-success" />}
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
        {!sessions.length && <p className="py-8 text-center text-muted-foreground">No sessions recorded yet.</p>}
      </div>
    </div>
  );
};

export default PatientDetailPage;

import { useParams } from 'react-router-dom';
import { api, mockUsers } from '@/services/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import ScoreBadge from '@/components/ScoreBadge';
import CorrectnessTimeline from '@/components/CorrectnessTimeline';
import { motion } from 'framer-motion';

const PatientDetailPage = () => {
  const { patientId } = useParams();
  const patient = mockUsers.find(u => u.id === patientId);
  const sessions = api.getPatientSessions(patientId!).slice().reverse();

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
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center gap-4">
                    <ScoreBadge score={s.analysis?.overallCorrectness || 0} />
                    <div className="flex-1">
                      <p className="font-display font-semibold">{s.poseName}</p>
                      <p className="text-xs text-muted-foreground">{new Date(s.recordedAt).toLocaleString()}</p>
                    </div>
                  </div>
                  {s.analysis && (
                    <>
                      <CorrectnessTimeline timeline={s.analysis.timeline} />
                      {s.analysis.areasOfConcern.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {s.analysis.areasOfConcern.map((c, j) => (
                            <span key={j} className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">{c.bodyPart}</span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
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

import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Activity, ClipboardCheck, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import ScoreBadge from '@/components/ScoreBadge';
import { motion } from 'framer-motion';

const TherapistDashboard = () => {
  const { user } = useAuth();
  const patients = api.getPatients();
  const poses = api.getTherapistPoses(user!.id);

  const allSessions = patients.flatMap(p => api.getPatientSessions(p.id));
  const avgScore = allSessions.length
    ? allSessions.reduce((s, ses) => s + (ses.analysis?.overallCorrectness || 0), 0) / allSessions.length
    : 0;

  const stats = [
    { label: 'Patients', value: patients.length, icon: Users, color: 'text-primary' },
    { label: 'Pose Templates', value: poses.length, icon: Activity, color: 'text-accent' },
    { label: 'Sessions', value: allSessions.length, icon: ClipboardCheck, color: 'text-success' },
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

      {avgScore > 0 && (
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <ScoreBadge score={avgScore} size="lg" />
            <div>
              <p className="font-display font-semibold">Patient Avg. Score</p>
              <p className="text-sm text-muted-foreground">Across all sessions</p>
            </div>
            <TrendingUp className="ml-auto h-5 w-5 text-success" />
          </CardContent>
        </Card>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent Patient Activity</h2>
          <Link to="/patients" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        <div className="space-y-3">
          {patients.slice(0, 3).map(p => {
            const pSessions = api.getPatientSessions(p.id);
            const latest = pSessions[pSessions.length - 1];
            return (
              <Link key={p.id} to={`/patient/${p.id}`}>
                <Card className="shadow-card transition-shadow hover:shadow-elevated">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-display font-bold text-primary">
                      {p.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {pSessions.length} session{pSessions.length !== 1 ? 's' : ''}
                        {latest?.analysis ? ` · Last score: ${Math.round(latest.analysis.overallCorrectness * 100)}%` : ''}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TherapistDashboard;

import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, AlertCircle, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const AssignmentsPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', token],
    queryFn: () => api.getAssignments(token!),
    enabled: !!token,
  });

  const active = assignments.filter(a => a.status === 'pending' || a.status === 'overdue');
  const done = assignments.filter(a => a.status === 'completed');

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold">Assigned Exercises</h1>

      {/* Active / Overdue */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Active
          </h2>
          {active.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={`shadow-card ${a.status === 'overdue' ? 'border-destructive/30' : ''}`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-base font-bold leading-tight">{a.pose?.poseName}</h3>
                      {a.dueDate && (
                        <p className={`mt-0.5 text-xs font-medium flex items-center gap-1 ${a.status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {a.status === 'overdue'
                            ? <AlertCircle className="h-3 w-3" />
                            : <Clock className="h-3 w-3" />}
                          {a.status === 'overdue' ? 'Overdue · ' : 'Due '}
                          {new Date(a.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  {a.maxSessionsPerDay != null && (
                    <p className="text-xs text-muted-foreground">
                      Max {a.maxSessionsPerDay} session{a.maxSessionsPerDay !== 1 ? 's' : ''} per day
                    </p>
                  )}
                  {a.pose?.instructions && (
                    <p className="text-sm text-muted-foreground leading-relaxed border-t pt-3">
                      {a.pose.instructions}
                    </p>
                  )}
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => navigate(`/record/${a.id}`)}
                  >
                    <Video className="mr-2 h-4 w-4" />
                    Start Session
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </section>
      )}

      {/* Completed */}
      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Completed
          </h2>
          {done.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="shadow-card border-success/20 bg-success/5">
                <CardContent className="flex items-center gap-4 p-4">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-foreground/80">{a.pose?.poseName}</p>
                    {a.dueDate && (
                      <p className="text-xs text-muted-foreground">
                        Due {new Date(a.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </section>
      )}

      {!assignments.length && (
        <p className="py-16 text-center text-muted-foreground">
          No assignments yet. Your therapist will assign exercises soon.
        </p>
      )}
    </div>
  );
};

export default AssignmentsPage;

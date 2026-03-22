import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api, User } from '@/lib/api';
import { useQuery, useQueries } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

  const therapistIds = useMemo(
    () => [...new Set(assignments.map(a => a.therapistId).filter(Boolean))],
    [assignments],
  );

  const therapistQueries = useQueries({
    queries: therapistIds.map(id => ({
      queryKey: ['user', id, token],
      queryFn: () => api.getUserById(token!, id),
      enabled: !!token,
    })),
  });

  const therapistMap = useMemo(() => {
    const map: Record<number, User> = {};
    therapistQueries.forEach((q, i) => { if (q.data) map[therapistIds[i]] = q.data; });
    return map;
  }, [therapistQueries, therapistIds]);

  const active = assignments.filter(a => a.status === 'pending' || a.status === 'overdue');
  const done   = assignments.filter(a => a.status === 'completed');

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Your Exercises</p>
        <h1 className="mt-2 font-display text-5xl font-bold leading-none text-foreground">Assignments</h1>
      </div>

      {/* Active */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-warning">Active</h2>
          {active.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={`shadow-card overflow-hidden border-l-[3px] ${
                  a.status === 'overdue'
                    ? 'border-l-destructive border-destructive/20'
                    : 'border-l-warning border-border/50'
                }`}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-lg font-bold leading-tight">{a.pose?.poseName}</h3>
                      {a.dueDate && (
                        <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                          a.status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'
                        }`}>
                          {a.status === 'overdue'
                            ? <AlertCircle className="h-3 w-3" />
                            : <Clock className="h-3 w-3" />}
                          {a.status === 'overdue' ? 'Overdue · ' : 'Due '}
                          {new Date(a.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {therapistMap[a.therapistId] && (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5 border border-border">
                        <AvatarImage src={therapistMap[a.therapistId].avatar} alt={therapistMap[a.therapistId].name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
                          {therapistMap[a.therapistId].name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        Assigned by {therapistMap[a.therapistId].name}
                      </span>
                    </div>
                  )}

                  {a.maxSessionsPerDay != null && (
                    <p className="text-xs text-muted-foreground">
                      Max {a.maxSessionsPerDay} session{a.maxSessionsPerDay !== 1 ? 's' : ''} per day
                    </p>
                  )}

                  {a.pose?.instructions && (
                    <p className="border-t border-border/50 pt-3 text-sm leading-relaxed text-muted-foreground">
                      {a.pose.instructions}
                    </p>
                  )}

                  <Button className="w-full" onClick={() => navigate(`/record/${a.id}`)}>
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
          <h2 className="text-xs font-bold uppercase tracking-widest text-success">Completed</h2>
          {done.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="border-success/15 bg-success/5 shadow-card">
                <CardContent className="flex items-center gap-4 p-4">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground/80">{a.pose?.poseName}</p>
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
        <p className="rounded-md border border-border py-16 text-center text-sm text-muted-foreground">
          No assignments yet. Your therapist will assign exercises soon.
        </p>
      )}
    </div>
  );
};

export default AssignmentsPage;

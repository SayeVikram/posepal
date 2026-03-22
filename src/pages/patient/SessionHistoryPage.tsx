import { useAuth } from '@/contexts/AuthContext';
import { api, Session } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Link } from 'react-router-dom';
import { TrendingUp, Trash2, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const SessionHistoryPage = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', token],
    queryFn: () => api.getSessions(token!),
    enabled: !!token,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', token],
    queryFn: () => api.getAssignments(token!),
    enabled: !!token,
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: number) => api.deleteSession(token!, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', token] });
      queryClient.invalidateQueries({ queryKey: ['assignments', token] });
      toast.success('Session deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignmentMap = new Map(assignments.map(a => [a.id, a]));
  const grouped = new Map<number, Session[]>();
  for (const s of sessions) {
    const list = grouped.get(s.assignmentId) ?? [];
    list.push(s);
    grouped.set(s.assignmentId, list);
  }
  const groups = [...grouped.entries()].sort(
    (a, b) => new Date(b[1][0].recordedAt).getTime() - new Date(a[1][0].recordedAt).getTime(),
  );

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Your Progress</p>
        <h1 className="mt-1 font-display text-4xl font-bold text-foreground">History</h1>
      </div>

      {groups.length === 0 && (
        <p className="rounded-xl border border-border/40 py-20 text-center text-muted-foreground">
          No sessions yet. Record your first exercise session!
        </p>
      )}

      {groups.map(([assignmentId, groupSessions], gi) => {
        const assignment = assignmentMap.get(assignmentId);
        const poseName = assignment?.pose?.poseName ?? groupSessions[0].poseName ?? 'Exercise';
        const isCompleted = assignment?.status === 'completed';

        return (
          <motion.section
            key={assignmentId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.06 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2 px-1">
              {isCompleted && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
              <h2 className="font-display font-bold">{poseName}</h2>
              <span className="text-xs text-muted-foreground">
                · {groupSessions.length} session{groupSessions.length !== 1 ? 's' : ''}
              </span>
              {assignment?.dueDate && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Due {new Date(assignment.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>

            <div className={`space-y-1.5 border-l-2 ml-2 pl-3 ${isCompleted ? 'border-success/40' : 'border-primary/30'}`}>
              {groupSessions.map(s => (
                <Card key={s.id} className="border-border/50 shadow-card">
                  <CardContent className="flex items-center gap-3 p-3">
                    <Link to={`/session/${s.id}`} className="group flex flex-1 items-center gap-3 min-w-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">
                          {new Date(s.recordedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.recordedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {s.processed && <TrendingUp className="h-4 w-4 shrink-0 text-success" />}
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-border/60 bg-card">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-display font-bold">Delete session?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the session and its analysis. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteMutation.mutate(s.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
};

export default SessionHistoryPage;

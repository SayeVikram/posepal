import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const AssignmentsPage = () => {
  const { user } = useAuth();
  const assignments = api.getAssignments(user!.id);
  const navigate = useNavigate();

  const statusConfig = {
    pending: { label: 'Pending', variant: 'outline' as const, icon: Clock },
    completed: { label: 'Completed', variant: 'secondary' as const, icon: CheckCircle2 },
    overdue: { label: 'Overdue', variant: 'destructive' as const, icon: Clock },
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Assigned Exercises</h1>
      <div className="space-y-3">
        {assignments.map((a, i) => {
          const st = statusConfig[a.status];
          return (
            <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-semibold">{a.pose?.poseName}</h3>
                        <Badge variant={st.variant} className="text-xs">
                          <st.icon className="mr-1 h-3 w-3" />
                          {st.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{a.pose?.instructions}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>By {a.therapist?.name}</span>
                        <span>Due {new Date(a.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  {a.status === 'pending' && (
                    <Button
                      className="mt-3 w-full bg-gradient-primary text-primary-foreground hover:opacity-90"
                      onClick={() => navigate(`/record/${a.id}`)}
                    >
                      <Video className="mr-2 h-4 w-4" />
                      Start Session
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
        {!assignments.length && (
          <p className="py-12 text-center text-muted-foreground">No assignments yet. Your therapist will assign exercises soon.</p>
        )}
      </div>
    </div>
  );
};

export default AssignmentsPage;

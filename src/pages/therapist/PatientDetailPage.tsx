import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api, Assignment } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Pencil, Trash2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const CORRECTNESS_THRESHOLD = 0.5;

function qualifyingDays(assignment: Assignment): number {
  if (!assignment.sessions) return 0;
  const dates = new Set<string>();
  for (const s of assignment.sessions) {
    if (s.processed && (s.overallCorrectness ?? 0) >= CORRECTNESS_THRESHOLD && s.recordedAt) {
      dates.add(s.recordedAt.slice(0, 10));
    }
  }
  return dates.size;
}

const statusMeta: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending:   { label: 'Pending',   icon: <Clock className="h-3 w-3" />,        variant: 'secondary' },
  completed: { label: 'Completed', icon: <CheckCircle2 className="h-3 w-3" />, variant: 'default' },
  overdue:   { label: 'Overdue',   icon: <AlertCircle className="h-3 w-3" />,  variant: 'destructive' },
};

const PatientDetailPage = () => {
  const { patientId } = useParams();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editRequiredDays, setEditRequiredDays] = useState('');
  const [editMaxPerDay, setEditMaxPerDay] = useState('');

  const { data: allPatients = [], isLoading } = useQuery({
    queryKey: ['all-patients', token],
    queryFn: () => api.getAllPatients(token!),
    enabled: !!token,
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['patient-assignments', patientId, token],
    queryFn: () => api.getPatientAssignments(token!, Number(patientId)),
    enabled: !!token && !!patientId,
  });

  const deleteMutation = useMutation({
    mutationFn: (assignmentId: number) => api.deleteAssignment(token!, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-assignments', patientId, token] });
      toast.success('Assignment deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { status?: string; notes?: string; due_date?: string; required_days?: number }) =>
      api.updateAssignment(token!, editAssignment!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-assignments', patientId, token] });
      setEditAssignment(null);
      toast.success('Assignment updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEdit = (a: Assignment) => {
    setEditAssignment(a);
    setEditStatus(a.status);
    setEditNotes(a.notes ?? '');
    setEditDueDate(a.dueDate ? a.dueDate.slice(0, 10) : '');
    setEditRequiredDays(a.requiredDays != null ? String(a.requiredDays) : '');
    setEditMaxPerDay(a.maxSessionsPerDay != null ? String(a.maxSessionsPerDay) : '');
  };

  const handleSave = () => {
    if (!editAssignment) return;
    updateMutation.mutate({
      status: editStatus || undefined,
      notes: editNotes || undefined,
      due_date: editDueDate || undefined,
      required_days: editRequiredDays ? Number(editRequiredDays) : undefined,
      max_sessions_per_day: editMaxPerDay ? Number(editMaxPerDay) : undefined,
    });
  };

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
      {/* Patient header */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 font-display text-xl font-bold text-primary">
          {patient.name.charAt(0)}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">{patient.name}</h1>
          <p className="text-sm text-muted-foreground">{patient.email}</p>
        </div>
      </div>

      {/* Assignments */}
      <h2 className="font-display text-lg font-semibold">
        Assignments ({assignments.length})
      </h2>

      {assignmentsLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a, i) => {
            const meta = statusMeta[a.status] ?? statusMeta.pending;
            const days = qualifyingDays(a);
            const totalSessions = a.sessions?.length ?? 0;
            const pct = a.requiredDays ? Math.min(100, Math.round((days / a.requiredDays) * 100)) : null;

            return (
              <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="shadow-card">
                  <CardContent className="p-4 space-y-3">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold truncate">{a.pose?.poseName ?? 'Assignment'}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                          {a.dueDate && (
                            <span>Due {new Date(a.dueDate).toLocaleDateString()}</span>
                          )}
                          {a.requiredDays != null && (
                            <span>{days}/{a.requiredDays} qualifying days</span>
                          )}
                          {!a.requiredDays && (
                            <span>{totalSessions} session{totalSessions !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant={meta.variant} className="flex items-center gap-1">
                          {meta.icon}
                          {meta.label}
                        </Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete assignment?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the assignment and all its recorded sessions.
                                This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteMutation.mutate(a.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {pct !== null && (
                      <div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 100 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#94a3b8',
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {a.notes && (
                      <p className="text-xs text-muted-foreground italic border-t pt-2">{a.notes}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          {!assignments.length && (
            <p className="py-8 text-center text-muted-foreground">No assignments for this patient yet.</p>
          )}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editAssignment} onOpenChange={open => !open && setEditAssignment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Assignment — {editAssignment?.pose?.poseName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Required Days</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 5"
                  value={editRequiredDays}
                  onChange={e => setEditRequiredDays(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Sessions / Day</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 2"
                  value={editMaxPerDay}
                  onChange={e => setEditMaxPerDay(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Add notes for the patient…"
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientDetailPage;

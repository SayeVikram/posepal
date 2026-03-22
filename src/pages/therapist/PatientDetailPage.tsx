import { useState, useRef } from 'react';
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Pencil, Trash2, CheckCircle2, Clock, AlertCircle, Paperclip, X, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import SessionVideoPlayer from '@/components/SessionVideoPlayer';

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
  pending:   { label: 'Pending',   icon: <Clock className="h-3 w-3" />,        variant: 'secondary'   },
  completed: { label: 'Completed', icon: <CheckCircle2 className="h-3 w-3" />, variant: 'default'     },
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
  const [editDemoFile, setEditDemoFile] = useState<File | null>(null);
  const [uploadingDemo, setUploadingDemo] = useState(false);
  const editDemoFileRef = useRef<HTMLInputElement>(null);
  const [expandedAssignment, setExpandedAssignment] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

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

  const { data: selectedSession, isLoading: sessionLoading } = useQuery({
    queryKey: ['therapist-session', selectedSessionId, token],
    queryFn: () => api.getTherapistSession(token!, selectedSessionId!),
    enabled: !!token && !!selectedSessionId,
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
    setEditDemoFile(null);
  };

  const handleSave = async () => {
    if (!editAssignment) return;
    updateMutation.mutate({
      status: editStatus || undefined,
      notes: editNotes || undefined,
      due_date: editDueDate || undefined,
      required_days: editRequiredDays ? Number(editRequiredDays) : undefined,
      max_sessions_per_day: editMaxPerDay ? Number(editMaxPerDay) : undefined,
    });
    if (editDemoFile && token) {
      setUploadingDemo(true);
      try {
        await api.uploadAssignmentDemoMedia(token, editAssignment.id, editDemoFile);
        queryClient.invalidateQueries({ queryKey: ['patient-assignments', patientId, token] });
      } catch { toast.error('Demo media upload failed'); }
      finally { setUploadingDemo(false); setEditDemoFile(null); }
    }
  };

  const patient = allPatients.find(u => u.id === Number(patientId));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!patient) return <p className="py-12 text-center text-muted-foreground">Patient not found.</p>;

  return (
    <div className="space-y-8">
      {/* Patient header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border-2 border-border">
          <AvatarImage src={patient.avatar} alt={patient.name} />
          <AvatarFallback className="bg-secondary font-display text-2xl font-bold text-foreground">
            {patient.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground truncate">{patient.name}</h1>
          <p className="text-sm text-muted-foreground">{patient.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <h2 className="font-display text-lg font-bold">Assignments</h2>
        <span className="text-sm text-muted-foreground">({assignments.length})</span>
      </div>

      {assignmentsLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a, i) => {
            const meta = statusMeta[a.status] ?? statusMeta.pending;
            const days = qualifyingDays(a);
            const totalSessions = a.sessions?.length ?? 0;
            const pct = a.requiredDays ? Math.min(100, Math.round((days / a.requiredDays) * 100)) : null;

            return (
              <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                <Card className="border-border/50 shadow-card">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-bold truncate">{a.pose?.poseName ?? 'Assignment'}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {a.dueDate && <span>Due {new Date(a.dueDate).toLocaleDateString()}</span>}
                          {a.requiredDays != null
                            ? <span>{days}/{a.requiredDays} qualifying days</span>
                            : <span>{totalSessions} session{totalSessions !== 1 ? 's' : ''}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant={meta.variant} className="flex items-center gap-1 text-xs">
                          {meta.icon}{meta.label}
                        </Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(a)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="border-border/60 bg-card">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-display font-bold">Delete assignment?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete the assignment and all its sessions. This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(a.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {pct !== null && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-success' : pct >= 60 ? 'bg-warning' : 'bg-muted-foreground'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}

                    {a.notes && <p className="border-t border-border/50 pt-2 text-xs italic text-muted-foreground">{a.notes}</p>}

                    {/* Sessions list */}
                    {(a.sessions?.length ?? 0) > 0 && (
                      <div className="border-t border-border/50 pt-2">
                        <button
                          className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setExpandedAssignment(expandedAssignment === a.id ? null : a.id)}
                        >
                          <span>{a.sessions!.length} session{a.sessions!.length !== 1 ? 's' : ''} recorded</span>
                          {expandedAssignment === a.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        {expandedAssignment === a.id && (
                          <div className="mt-2 space-y-1">
                            {a.sessions!.map(s => (
                              <button
                                key={s.id}
                                className="flex w-full items-center justify-between rounded-md border border-border/50 bg-secondary/30 px-3 py-2 text-xs hover:bg-secondary/60 transition-colors"
                                onClick={() => setSelectedSessionId(s.id)}
                              >
                                <div className="flex items-center gap-2">
                                  <Play className="h-3 w-3 text-primary" />
                                  <span>{new Date(s.recordedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                {s.processed && s.overallCorrectness != null && (
                                  <span className={`font-medium ${s.overallCorrectness >= CORRECTNESS_THRESHOLD ? 'text-success' : 'text-destructive'}`}>
                                    {Math.round(s.overallCorrectness * 100)}%
                                  </span>
                                )}
                                {!s.processed && <span className="text-muted-foreground">Processing…</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          {!assignments.length && (
            <p className="rounded-md border border-border py-10 text-center text-sm text-muted-foreground">
              No assignments for this patient yet.
            </p>
          )}
        </div>
      )}

      {/* Session video dialog */}
      <Dialog open={!!selectedSessionId} onOpenChange={open => !open && setSelectedSessionId(null)}>
        <DialogContent className="max-w-2xl border-border/60 bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">Session Recording</DialogTitle>
          </DialogHeader>
          {sessionLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedSession?.videoUrl ? (
            <div className="space-y-3">
              <SessionVideoPlayer url={selectedSession.videoUrl} />
              <p className="text-sm text-muted-foreground">
                {selectedSession.recordedAt ? new Date(selectedSession.recordedAt).toLocaleString() : ''}
              </p>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {selectedSession && !selectedSession.videoUrl ? 'No video available for this session.' : 'Failed to load session.'}
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editAssignment} onOpenChange={open => !open && setEditAssignment(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border/60 bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">
              Edit — {editAssignment?.pose?.poseName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
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
                <Input type="number" min="1" placeholder="e.g. 5" value={editRequiredDays} onChange={e => setEditRequiredDays(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Max Sessions / Day</Label>
                <Input type="number" min="1" placeholder="e.g. 2" value={editMaxPerDay} onChange={e => setEditMaxPerDay(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Add notes for the patient…" value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2 border-t border-border pt-3">
              <Label>Demo Media <span className="font-normal text-muted-foreground">(optional)</span></Label>
              {(editAssignment?.demoVideoUrl || editAssignment?.demoImageUrl) && !editDemoFile && (
                <p className="text-xs text-muted-foreground">Current: {editAssignment.demoVideoUrl ? 'Video' : 'Image'} attached.</p>
              )}
              <input ref={editDemoFileRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => setEditDemoFile(e.target.files?.[0] ?? null)} />
              {editDemoFile ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm">
                  <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{editDemoFile.name}</span>
                  <button onClick={() => { setEditDemoFile(null); if (editDemoFileRef.current) editDemoFileRef.current.value = ''; }}>
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => editDemoFileRef.current?.click()}>
                  <Paperclip className="mr-2 h-4 w-4" />
                  Attach image or video
                </Button>
              )}
            </div>
            <Button onClick={handleSave} disabled={updateMutation.isPending || uploadingDemo} className="w-full">
              {(updateMutation.isPending || uploadingDemo) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientDetailPage;

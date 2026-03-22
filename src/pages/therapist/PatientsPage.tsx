import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { Send, Loader2, Paperclip, X, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';

const PatientsPage = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedPose, setSelectedPose] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [requiredDays, setRequiredDays] = useState('');
  const [maxSessionsPerDay, setMaxSessionsPerDay] = useState('');
  const [demoFile, setDemoFile] = useState<File | null>(null);
  const demoFileRef = useRef<HTMLInputElement>(null);

  const { data: patients = [] } = useQuery({
    queryKey: ['therapist-patients', token],
    queryFn: () => api.getPatients(token!),
    enabled: !!token,
  });

  const { data: allPatients = [] } = useQuery({
    queryKey: ['all-patients', token],
    queryFn: () => api.getAllPatients(token!),
    enabled: !!token && assignOpen,
  });

  const { data: poses = [] } = useQuery({
    queryKey: ['poses', token],
    queryFn: () => api.getPoses(token!),
    enabled: !!token,
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      api.assign(token!, {
        patient_id: Number(selectedPatient),
        pose_template_id: Number(selectedPose),
        due_date: dueDate || undefined,
        required_days: requiredDays ? Number(requiredDays) : undefined,
        max_sessions_per_day: maxSessionsPerDay ? Number(maxSessionsPerDay) : undefined,
      }),
    onSuccess: async (assignment) => {
      if (demoFile && token) {
        try {
          await api.uploadAssignmentDemoMedia(token, assignment.id, demoFile);
        } catch {
          toast.error('Assignment created but demo media upload failed');
        }
      }
      queryClient.invalidateQueries({ queryKey: ['therapist-patients', token] });
      setAssignOpen(false);
      setSelectedPatient(''); setSelectedPose(''); setDueDate('');
      setRequiredDays(''); setMaxSessionsPerDay(''); setDemoFile(null);
      toast.success('Pose assigned successfully!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <PageHeader eyebrow="Manage" title="Patients" />
        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogTrigger asChild>
            <Button>
              <Send className="mr-2 h-4 w-4" />
              Assign Pose
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto border-border/60 bg-card">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold">Assign Pose to Patient</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="space-y-2">
                <Label>Patient</Label>
                <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                  <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>
                    {allPatients.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pose Template</Label>
                <Select value={selectedPose} onValueChange={setSelectedPose}>
                  <SelectTrigger><SelectValue placeholder="Select pose" /></SelectTrigger>
                  <SelectContent>
                    {poses.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.poseName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Required Days</Label>
                  <Input type="number" min="1" placeholder="e.g. 5" value={requiredDays} onChange={e => setRequiredDays(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Max Sessions / Day</Label>
                  <Input type="number" min="1" placeholder="e.g. 2" value={maxSessionsPerDay} onChange={e => setMaxSessionsPerDay(e.target.value)} />
                </div>
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <Label>Demo Media <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <input ref={demoFileRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => setDemoFile(e.target.files?.[0] ?? null)} />
                {demoFile ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm">
                    <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{demoFile.name}</span>
                    <button onClick={() => { setDemoFile(null); if (demoFileRef.current) demoFileRef.current.value = ''; }}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => demoFileRef.current?.click()}>
                    <Paperclip className="mr-2 h-4 w-4" />
                    Attach image or video
                  </Button>
                )}
              </div>
              <Button
                onClick={() => { if (!selectedPatient || !selectedPose) return; assignMutation.mutate(); }}
                disabled={assignMutation.isPending || !selectedPatient || !selectedPose}
                className="w-full"
              >
                {assignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {patients.length > 0 ? (
        <div className="divide-y divide-border rounded-md border border-border">
          {patients.map((p, i) => (
            <Link key={p.id} to={`/patient/${p.id}`}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="group flex items-center gap-3 p-4 transition-colors hover:bg-secondary/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-secondary font-display text-sm font-bold text-foreground">
                  {p.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </motion.div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No patients yet"
          description="Patients appear here once you assign them a pose. Use the Assign Pose button above — just make sure the patient has already registered an account."
          action={{
            label: poses.length === 0 ? 'Create a pose template first' : 'Assign your first pose →',
            onClick: () => setAssignOpen(true),
            disabled: poses.length === 0,
          }}
        />
      )}
    </div>
  );
};

export default PatientsPage;

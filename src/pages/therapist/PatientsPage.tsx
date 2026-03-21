import { useState } from 'react';
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
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const PatientsPage = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedPose, setSelectedPose] = useState('');
  const [dueDate, setDueDate] = useState('');

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
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['therapist-patients', token] });
      setAssignOpen(false);
      setSelectedPatient('');
      setSelectedPose('');
      setDueDate('');
      toast.success('Pose assigned successfully!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleAssign = () => {
    if (!selectedPatient || !selectedPose) return;
    assignMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Patients</h1>
        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90">
              <Send className="mr-2 h-4 w-4" />
              Assign Pose
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Assign Pose to Patient</DialogTitle></DialogHeader>
            <div className="space-y-4">
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
              <Button
                onClick={handleAssign}
                disabled={assignMutation.isPending || !selectedPatient || !selectedPose}
                className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90"
              >
                {assignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {patients.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={`/patient/${p.id}`}>
              <Card className="shadow-card transition-shadow hover:shadow-elevated">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-display text-lg font-bold text-primary">
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-display font-semibold">{p.name}</p>
                    <p className="text-sm text-muted-foreground">{p.email}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
        {!patients.length && (
          <p className="py-12 text-center text-muted-foreground">No patients yet. Assign a pose to add a patient.</p>
        )}
      </div>
    </div>
  );
};

export default PatientsPage;

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const PatientsPage = () => {
  const { user } = useAuth();
  const patients = api.getPatients();
  const poses = api.getTherapistPoses(user!.id);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedPose, setSelectedPose] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleAssign = () => {
    if (!selectedPatient || !selectedPose || !dueDate) return;
    api.assignPose(user!.id, selectedPatient, selectedPose, dueDate);
    setAssignOpen(false);
    toast.success('Pose assigned successfully!');
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
                    {patients.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pose Template</Label>
                <Select value={selectedPose} onValueChange={setSelectedPose}>
                  <SelectTrigger><SelectValue placeholder="Select pose" /></SelectTrigger>
                  <SelectContent>
                    {poses.map(p => <SelectItem key={p.id} value={p.id}>{p.poseName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <Button onClick={handleAssign} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90">Assign</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {patients.map((p, i) => {
          const sessions = api.getPatientSessions(p.id);
          const assignments = api.getAssignments(p.id);
          return (
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
                      <p className="text-xs text-muted-foreground">
                        {assignments.length} assignment{assignments.length !== 1 ? 's' : ''} · {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default PatientsPage;

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const PosesPage = () => {
  const { user } = useAuth();
  const [poses, setPoses] = useState(api.getTherapistPoses(user!.id));
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [poseClass, setPoseClass] = useState('0');

  const handleCreate = () => {
    if (!name.trim()) return;
    api.createPose({ therapistId: user!.id, poseName: name, expectedPoseClass: Number(poseClass), instructions });
    setPoses(api.getTherapistPoses(user!.id));
    setName('');
    setInstructions('');
    setOpen(false);
    toast.success('Pose template created!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Pose Templates</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90">
              <Plus className="mr-2 h-4 w-4" />
              New Pose
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Pose Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pose Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standing Forward Bend" />
              </div>
              <div className="space-y-2">
                <Label>Pose Class</Label>
                <Select value={poseClass} onValueChange={setPoseClass}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Pose 1 — Forward Bend</SelectItem>
                    <SelectItem value="1">Pose 2 — Warrior</SelectItem>
                    <SelectItem value="2">Pose 3 — Tree</SelectItem>
                    <SelectItem value="3">Pose 4 — Bridge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Instructions</Label>
                <Textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Step-by-step instructions for the patient..." rows={4} />
              </div>
              <Button onClick={handleCreate} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90">Create Template</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {poses.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-display font-semibold">{p.poseName}</p>
                    <p className="text-xs text-muted-foreground">Class {p.expectedPoseClass + 1}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.instructions}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default PosesPage;

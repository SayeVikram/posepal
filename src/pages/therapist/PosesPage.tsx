import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Activity, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';

const PosesPage = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [poseClass, setPoseClass] = useState('');

  const { data: poses = [] } = useQuery({
    queryKey: ['poses', token],
    queryFn: () => api.getPoses(token!),
    enabled: !!token,
  });

  const { data: poseClassOptions = [] } = useQuery({
    queryKey: ['pose-classes'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/pose-classes`);
      const json = await res.json();
      return (json.classes as string[]) ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.createPose(token!, { name, pose_class: poseClass, instructions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poses', token] });
      setName(''); setInstructions(''); setPoseClass(''); setOpen(false);
      toast.success('Pose template created!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <PageHeader eyebrow="Library" title="Pose Templates" />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Pose
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border/60 bg-card">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold">Create Pose Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="space-y-2">
                <Label>Pose Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standing Forward Bend" />
              </div>
              <div className="space-y-2">
                <Label>Pose Class</Label>
                <Select value={poseClass} onValueChange={setPoseClass}>
                  <SelectTrigger><SelectValue placeholder="Select pose class" /></SelectTrigger>
                  <SelectContent>
                    {poseClassOptions.length > 0
                      ? poseClassOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)
                      : ['forward_bend', 'warrior', 'tree', 'bridge'].map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))
                    }
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Instructions</Label>
                <Textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Step-by-step instructions for the patient…" rows={4} />
              </div>
              <Button onClick={() => { if (!name.trim() || !poseClass) return; createMutation.mutate(); }} disabled={createMutation.isPending || !name.trim() || !poseClass} className="w-full">
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {poses.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border/50 shadow-card transition-all hover:border-border hover:shadow-elevated">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-bold">{p.poseName}</p>
                    <p className="text-xs text-muted-foreground">{p.expectedPoseClass}</p>
                  </div>
                </div>
                {p.instructions && (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground line-clamp-2">{p.instructions}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {!poses.length && (
          <EmptyState
            className="col-span-2"
            icon={Activity}
            title="No pose templates yet"
            description="A pose template defines the exercise — the AI class to detect, the name patients see, and step-by-step instructions."
            action={{ label: 'Create your first pose →', onClick: () => setOpen(true) }}
          />
        )}
      </div>
    </div>
  );
};

export default PosesPage;

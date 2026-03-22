import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api, Relationship } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
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
import { Camera, Check, Loader2, Link2, Link2Off, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const ProfilePage = () => {
  const { user, token, setUser } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPatient = user?.role === 'patient';

  // --- Relationships (patient only) ---
  const { data: relationships = [], isLoading: loadingRels } = useQuery<Relationship[]>({
    queryKey: ['relationships', token],
    queryFn: () => api.getRelationships(token!),
    enabled: !!token && isPatient,
  });

  const activeRelationships = relationships.filter(r => r.status === 'ACTIVE');

  const submitCodeMutation = useMutation({
    mutationFn: (code: string) => api.submitPairingCode(token!, code),
    onSuccess: () => {
      toast.success('Paired successfully! Your therapist can now assign exercises.');
      setPairingCode('');
      queryClient.invalidateQueries({ queryKey: ['relationships', token] });
    },
    onError: (err: Error) => {
      toast.error(err.message.includes('invalid') || err.message.includes('expired')
        ? 'Code is invalid or has expired. Ask your therapist for a new one.'
        : 'Failed to pair. Please try again.');
    },
  });

  const unpairMutation = useMutation({
    mutationFn: (relationshipId: number) => api.unpair(token!, relationshipId),
    onSuccess: () => {
      toast.success('Unregistered from therapist.');
      queryClient.invalidateQueries({ queryKey: ['relationships', token] });
    },
    onError: () => toast.error('Failed to unregister. Please try again.'),
  });

  const handleSubmitCode = () => {
    const trimmed = pairingCode.trim().toUpperCase().replace(/\s/g, '');
    if (trimmed.length !== 6) {
      toast.error('Enter the full 6-character code from your therapist.');
      return;
    }
    submitCodeMutation.mutate(trimmed);
  };

  const initials = (user?.name ?? '?')
    .split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);

  const handleSaveName = async () => {
    if (!token || !name.trim() || name === user?.name) return;
    setSavingName(true);
    try {
      const updated = await api.updateProfile(token, { name: name.trim() });
      setUser(updated);
      toast.success('Name updated');
    } catch { toast.error('Failed to update name'); }
    finally { setSavingName(false); }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploadingAvatar(true);
    try {
      const updated = await api.uploadAvatar(token, file);
      setUser(updated);
      toast.success('Avatar updated');
    } catch { toast.error('Failed to upload avatar'); }
    finally { setUploadingAvatar(false); e.target.value = ''; }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email);
      if (error) throw error;
      toast.success('Password reset email sent');
    } catch { toast.error('Failed to send reset email'); }
    finally { setSendingReset(false); }
  };

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader eyebrow="Account" title="Profile" />

      {/* Avatar + identity */}
      <Card className="border-border/50 shadow-card">
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <div className="relative">
            <Avatar className="h-24 w-24 border-2 border-border">
              <AvatarImage src={user?.avatar} alt={user?.name} />
              <AvatarFallback className="bg-secondary font-display text-xl font-bold text-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary text-foreground shadow-lg transition hover:bg-muted disabled:opacity-60"
            >
              {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div className="text-center">
            <p className="font-display text-xl font-bold">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <Badge variant="secondary" className="mt-2 capitalize">{user?.role}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Name */}
      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">Display name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); }} className="h-11" />
          </div>
          <Button onClick={handleSaveName} disabled={savingName || !name.trim() || name === user?.name}>
            {savingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </CardContent>
      </Card>

      {/* Account */}
      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <p className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
              {user?.email}
            </p>
          </div>
          <Separator className="bg-border/50" />
          <div className="space-y-2">
            <p className="text-sm font-semibold">Password</p>
            <p className="text-xs text-muted-foreground">We'll send a reset link to your email address.</p>
            <Button variant="outline" onClick={handlePasswordReset} disabled={sendingReset}>
              {sendingReset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send password reset email
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Therapist pairing — patient only */}
      {isPatient && (
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">My Therapists</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Active relationships */}
            {loadingRels ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : activeRelationships.length > 0 ? (
              <div className="divide-y divide-border rounded-md border border-border">
                {activeRelationships.map(rel => (
                  <div key={rel.id} className="flex items-center gap-3 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
                      <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {rel.therapist?.name ?? `Therapist #${rel.therapistId}`}
                      </p>
                      {rel.therapist?.email && (
                        <p className="truncate text-xs text-muted-foreground">{rel.therapist.email}</p>
                      )}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground hover:text-destructive">
                          <Link2Off className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-border/60 bg-card">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Unregister from therapist?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {rel.therapist?.name ?? 'This therapist'} will immediately lose access to your sessions and assignments. This action cannot be undone — you'll need a new pairing code to reconnect.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => unpairMutation.mutate(rel.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Unregister
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You haven't paired with a therapist yet.
              </p>
            )}

            <Separator className="bg-border/50" />

            {/* Pair with a new therapist */}
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Pair with therapist</p>
                <p className="text-xs text-muted-foreground">
                  Ask your therapist for a 6-character code and enter it below.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="A3B7K2"
                  value={pairingCode}
                  onChange={e => setPairingCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter') handleSubmitCode(); }}
                  maxLength={6}
                  className="h-11 font-mono tracking-widest uppercase"
                  spellCheck={false}
                />
                <Button
                  onClick={handleSubmitCode}
                  disabled={submitCodeMutation.isPending || pairingCode.replace(/\s/g, '').length < 6}
                  className="shrink-0"
                >
                  {submitCodeMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Link2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProfilePage;

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Camera, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import PageHeader from '@/components/PageHeader';

const ProfilePage = () => {
  const { user, token, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    </div>
  );
};

export default ProfilePage;

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode, Copy, Check, Loader2, Clock, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const GeneratePairingCodeDialog = () => {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.generatePairingCode(token!),
    onError: () => toast.error('Failed to generate code. Please try again.'),
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setCopied(false);
      mutation.mutate();
    } else {
      mutation.reset();
    }
  };

  const handleCopy = async () => {
    if (!mutation.data?.code) return;
    await navigator.clipboard.writeText(mutation.data.code);
    setCopied(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied(false), 2500);
  };

  // Format as "A3B · 7K2" for readability
  const display = mutation.data?.code
    ? `${mutation.data.code.slice(0, 3)} · ${mutation.data.code.slice(3)}`
    : '';

  const expiryLabel = mutation.data?.expiresAt
    ? `Expires ${new Date(mutation.data.expiresAt).toLocaleString([], {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })}`
    : '';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="mr-2 h-4 w-4" />
          Generate Pairing Code
        </Button>
      </DialogTrigger>

      <DialogContent className="border-border/60 bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold">Patient Pairing Code</DialogTitle>
        </DialogHeader>

        {/* Loading */}
        {mutation.isPending && (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error */}
        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Could not generate a code. Please close and try again.
          </div>
        )}

        {/* Code display */}
        {mutation.data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-5"
          >
            {/* The code itself */}
            <div className="rounded-md border border-border bg-secondary/40 py-8 text-center">
              <p className="font-mono text-5xl font-bold tracking-[0.25em] text-foreground tabular-nums select-all">
                {display}
              </p>
            </div>

            {/* Copy */}
            <Button className="w-full" variant="outline" onClick={handleCopy}>
              {copied
                ? <><Check className="mr-2 h-4 w-4 text-success" />Copied!</>
                : <><Copy className="mr-2 h-4 w-4" />Copy code</>}
            </Button>

            {/* Expiry */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{expiryLabel} · single use · 24 h window</span>
            </div>

            {/* Instructions */}
            <div className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground">How to share</p>
              <p>
                Tell your patient this code verbally, by text, or write it down. They enter it under{' '}
                <span className="font-medium text-foreground">Profile → Pair with therapist</span>.
              </p>
              <p className="text-xs">
                This code is shown once and is never stored. Generate a new one if needed.
              </p>
            </div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GeneratePairingCodeDialog;

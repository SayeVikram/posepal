import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useCountUp } from '@/hooks/useCountUp';
import { ArrowRight, Activity, Send, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageHeader from '@/components/PageHeader';
import SectionHeader from '@/components/SectionHeader';
import GeneratePairingCodeDialog from '@/components/GeneratePairingCodeDialog';

const TherapistDashboard = () => {
  const { user, token } = useAuth();

  const { data: patients = [] } = useQuery({
    queryKey: ['therapist-patients', token],
    queryFn: () => api.getPatients(token!),
    enabled: !!token,
  });

  const { data: poses = [] } = useQuery({
    queryKey: ['poses', token],
    queryFn: () => api.getPoses(token!),
    enabled: !!token,
  });

  const patientCount = useCountUp(patients.length, 700);
  const poseCount    = useCountUp(poses.length, 800);

  const stats = [
    { label: 'Patients',       value: patientCount, color: 'text-primary'    },
    { label: 'Pose Templates', value: poseCount,    color: 'text-accent'     },
    { label: 'Sessions',       value: '—',          color: 'text-foreground' },
  ];

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="flex items-end justify-between gap-4">
        <PageHeader
          eyebrow="Practice Overview"
          title={`Welcome, ${user?.name?.split(' ')[0]}`}
          subtitle="Manage your patients and exercises"
          size="lg"
        />
        <div className="shrink-0 pb-1">
          <GeneratePairingCodeDialog />
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex divide-x divide-border border-y border-border py-6">
        {stats.map(s => (
          <div key={s.label} className="flex-1 px-5 first:pl-0 last:pr-0">
            <p className={`font-display text-7xl font-bold leading-none tracking-tight ${s.color}`}>{s.value}</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Get started guide — only shown when account is brand new */}
      {poses.length === 0 && patients.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-md border border-border"
        >
          <div className="border-b border-border px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Getting Started</p>
            <p className="mt-1 font-display text-lg font-bold text-foreground">Three steps to your first session</p>
          </div>
          <div className="divide-y divide-border">
            {[
              {
                n: '01',
                icon: Activity,
                title: 'Create a pose template',
                desc: 'Define the exercise — name it, pick the AI pose class, and write patient instructions.',
                href: '/poses',
                cta: 'Go to Pose Templates →',
              },
              {
                n: '02',
                icon: Send,
                title: 'Assign it to a patient',
                desc: 'Choose a registered patient, select your pose, and set a due date.',
                href: '/patients',
                cta: 'Go to Patients →',
              },
              {
                n: '03',
                icon: BarChart3,
                title: 'Review their results',
                desc: "After the patient records a session, you'll see a frame-by-frame accuracy report here.",
                href: null,
                cta: null,
              },
            ].map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.07 }}
                className="flex items-start gap-4 px-5 py-4"
              >
                <span className="font-display text-3xl font-bold leading-none text-border tabular-nums">{step.n}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.desc}</p>
                  {step.href && (
                    <Link to={step.href} className="mt-2 inline-block text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                      {step.cta}
                    </Link>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Patients */}
      {patients.length > 0 && (
        <div>
          <SectionHeader title="Patients" href="/patients" />
          <div className="divide-y divide-border rounded-md border border-border">
            {patients.slice(0, 4).map((p, i) => (
              <Link key={p.id} to={`/patient/${p.id}`}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="group flex items-center gap-3 p-4 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-secondary font-display text-xs font-bold text-foreground">
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TherapistDashboard;

import { cn } from '@/lib/utils';

interface Props {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ScoreBadge = ({ score, size = 'md', className }: Props) => {
  const pct = Math.round(score * 100);
  const color = score >= 0.8 ? 'text-success' : score >= 0.6 ? 'text-warning' : 'text-destructive';
  const bg    = score >= 0.8 ? 'bg-success/10 border-success/40' : score >= 0.6 ? 'bg-warning/10 border-warning/40' : 'bg-destructive/10 border-destructive/40';
  const sizes = { sm: 'h-10 w-10 text-xs border', md: 'h-14 w-14 text-sm border', lg: 'h-20 w-20 text-xl border-2' };

  return (
    <div className={cn(
      'flex items-center justify-center rounded-full font-display font-bold',
      sizes[size], bg, color, className,
    )}>
      {pct}%
    </div>
  );
};

export default ScoreBadge;

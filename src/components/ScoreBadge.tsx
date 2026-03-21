import { cn } from '@/lib/utils';

interface Props {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ScoreBadge = ({ score, size = 'md', className }: Props) => {
  const pct = Math.round(score * 100);
  const color = score >= 0.8 ? 'text-success' : score >= 0.6 ? 'text-warning' : 'text-destructive';
  const bg = score >= 0.8 ? 'bg-success/10' : score >= 0.6 ? 'bg-warning/10' : 'bg-destructive/10';
  const sizes = { sm: 'h-10 w-10 text-xs', md: 'h-14 w-14 text-sm', lg: 'h-20 w-20 text-lg' };

  return (
    <div className={cn('flex items-center justify-center rounded-full font-bold', sizes[size], bg, color, className)}>
      {pct}%
    </div>
  );
};

export default ScoreBadge;

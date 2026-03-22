import { cn } from '@/lib/utils';

interface PageHeaderProps {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  /** 'md' = text-5xl (section pages), 'lg' = text-6xl (dashboard) */
  size?: 'md' | 'lg';
  className?: string;
}

const PageHeader = ({ eyebrow, title, subtitle, size = 'md', className }: PageHeaderProps) => (
  <div className={className}>
    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
    <h1
      className={cn(
        'mt-2 font-display font-bold leading-none text-foreground',
        size === 'lg' ? 'text-6xl tracking-tight' : 'text-5xl',
      )}
    >
      {title}
    </h1>
    {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
  </div>
);

export default PageHeader;

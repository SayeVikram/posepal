import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: EmptyStateAction;
  className?: string;
}

const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => (
  <div className={cn('rounded-md border border-border p-8 text-center', className)}>
    {Icon && (
      <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-secondary">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
    )}
    <p className="font-semibold text-foreground">{title}</p>
    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    {action && (
      action.href ? (
        <Link
          to={action.href}
          className="mt-4 inline-block text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {action.label}
        </Link>
      ) : (
        <button
          onClick={action.onClick}
          disabled={action.disabled}
          className="mt-4 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:pointer-events-none disabled:opacity-40"
        >
          {action.label}
        </button>
      )
    )}
  </div>
);

export default EmptyState;

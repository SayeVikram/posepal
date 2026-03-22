import { Link } from 'react-router-dom';

interface SectionHeaderProps {
  title: string;
  href?: string;
  linkText?: string;
  className?: string;
}

const SectionHeader = ({ title, href, linkText = 'View all →', className }: SectionHeaderProps) => (
  <div className={`mb-4 flex items-baseline justify-between ${className ?? ''}`}>
    <h2 className="font-display text-xl font-bold">{title}</h2>
    {href && (
      <Link to={href} className="text-xs text-primary hover:text-primary/80 transition-colors">
        {linkText}
      </Link>
    )}
  </div>
);

export default SectionHeader;

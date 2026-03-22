import { useAuth } from '@/contexts/AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ClipboardList, Home, LogOut, Users, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, isTherapist, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const therapistLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: Home },
    { to: '/poses',     label: 'Poses',     icon: Activity },
    { to: '/patients',  label: 'Patients',  icon: Users },
  ];

  const patientLinks = [
    { to: '/dashboard',   label: 'Dashboard',  icon: Home },
    { to: '/assignments', label: 'Assignments', icon: ClipboardList },
    { to: '/history',     label: 'History',     icon: History },
  ];

  const links = isTherapist ? therapistLinks : patientLinks;

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-secondary">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <span className="font-display text-sm font-bold tracking-tight text-foreground">
              PosePal
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {links.map(l => {
              const active = location.pathname === l.to;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <l.icon className="h-4 w-4" />
                  {l.label}
                  {active && (
                    <span className="absolute inset-x-2 bottom-0.5 h-px rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-1">
            <Link
              to="/profile"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary"
            >
              <Avatar className="h-7 w-7 border border-border">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="bg-secondary text-xs font-bold text-foreground">
                  {(user?.name ?? '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm text-muted-foreground sm:block">{user?.name}</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="Sign out"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-around py-2">
          {links.map(l => {
            const active = location.pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`flex flex-col items-center gap-1 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <l.icon className="h-5 w-5" />
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="container max-w-2xl pb-24 pt-10 md:pb-12 md:pt-12">{children}</main>
    </div>
  );
};

export default AppLayout;

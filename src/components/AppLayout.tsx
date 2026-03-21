import { useAuth } from '@/contexts/AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ClipboardList, Home, LogOut, Plus, Users, Video, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, isTherapist, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const therapistLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: Home },
    { to: '/poses', label: 'Poses', icon: Activity },
    { to: '/patients', label: 'Patients', icon: Users },
  ];

  const patientLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: Home },
    { to: '/assignments', label: 'Assignments', icon: ClipboardList },
    { to: '/history', label: 'History', icon: History },
  ];

  const links = isTherapist ? therapistLinks : patientLinks;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">PoseTherapy</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map(l => (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  location.pathname === l.to ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/profile" className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-accent">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {(user?.name ?? '?').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm text-muted-foreground sm:block">{user?.name}</span>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md md:hidden">
        <div className="flex items-center justify-around py-2">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                location.pathname === l.to ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <l.icon className="h-5 w-5" />
              {l.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="container pb-24 pt-6 md:pb-8">{children}</main>
    </div>
  );
};

export default AppLayout;

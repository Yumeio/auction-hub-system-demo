import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  LayoutDashboard, 
  Gavel, 
  Package, 
  CreditCard, 
  User, 
  LogOut
} from 'lucide-react';
import { useEffect } from 'react';

export default function Dashboard() {
  const location = useLocation();
    const navigate = useNavigate();
  const { user, isLoading, isAuthenticated, logout } = useAuth();

  const navigation = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard, end: true },
    { name: 'My Bids', href: '/dashboard/bids', icon: Gavel },
    { name: 'My Products', href: '/dashboard/products', icon: Package },
    { name: 'Payments', href: '/dashboard/payments', icon: CreditCard },
    { name: 'Profile', href: '/dashboard/profile', icon: User },
    { name: "Logout", href: "/logout", icon: LogOut },
  ];

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

  const isActive = (href: string, end?: boolean) => {
    if (end) return location.pathname === href;
    return location.pathname.startsWith(href);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <MainLayout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user?.firstName}!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="p-4 lg:col-span-1">
            <nav className="space-y-2">
              {navigation.map((item) => (
                <Button
                  key={item.name}
                  variant={
                    item.name === 'Logout' 
                      ? 'destructive' 
                      : isActive(item.href, item.end) 
                      ? 'secondary' 
                      : 'ghost'
                  }
                  className={`w-full justify-start ${
                    item.name === 'Logout' ? 'mt-8' : ''
                  }`}
                  asChild={item.name !== 'Logout'}
                  onClick={item.name === 'Logout' ? () => handleLogout() : undefined}
                >
                  {item.name === 'Logout' ? (
                    <>
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.name}
                    </>
                  ) : (
                    <Link to={item.href}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.name}
                    </Link>
                  )}
                </Button>
              ))}
            </nav>
          </Card>

          <div className="lg:col-span-3">
            <Outlet />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
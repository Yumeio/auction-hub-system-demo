import { Outlet, Link, useLocation, Navigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  CheckSquare, 
  Gavel, 
  CreditCard, 
  Users 
} from 'lucide-react';

export default function Admin() {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  const navigation = [
    { name: 'Product Approvals', href: '/admin', icon: CheckSquare, end: true },
    { name: 'Auctions', href: '/admin/auctions', icon: Gavel },
    { name: 'Payments', href: '/admin/payments', icon: CreditCard },
    { name: 'Users', href: '/admin/users', icon: Users },
  ];

  const isActive = (href: string, end?: boolean) => {
    if (end) return location.pathname === href;
    return location.pathname.startsWith(href);
  };

  if (isLoading) {
    return <MainLayout><div className="container py-8">Loading...</div></MainLayout>;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <MainLayout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground mt-1">
            Manage platform operations
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="p-4 lg:col-span-1">
            <nav className="space-y-2">
              {navigation.map((item) => (
                <Button
                  key={item.name}
                  variant={isActive(item.href, item.end) ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  asChild
                >
                  <Link to={item.href}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </Link>
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
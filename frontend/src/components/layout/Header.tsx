import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Gavel, 
  Bell, 
  Menu, 
  User, 
  LogOut, 
  LayoutDashboard, 
  Shield, 
  Package,
  Search,
  Plus,
  Wallet,
  HelpCircle,
  TrendingUp,
  X
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { UserRole, type Notification } from '@/api/types';
import { apiClient } from '@/api';

export function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  // Real-time notification count via SSE
  useEffect(() => {
    if (!isAuthenticated) return;

    const eventSource = apiClient.sse.subscribeToNotifications((data) => {
      setNotifications(data);
    });

    return () => {
      eventSource.close();
    };
  }, [isAuthenticated]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getInitials = () => {
    if (!user) return 'U';
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U';
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/auctions?search=${encodeURIComponent(searchQuery)}`);
      setShowSearch(false);
      setSearchQuery('');
    }
  };

  const navLinks = [
    { to: '/', label: 'Home', icon: LayoutDashboard },
    { to: '/auctions', label: 'Auctions', icon: Gavel },
    { to: '/bids', label: 'Live Bids', icon: TrendingUp },
    { to: '/how-it-works', label: 'How It Works', icon: HelpCircle },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo & Navigation */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <Gavel className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">AuctionHub</span>
          </Link>
          
          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground flex items-center gap-2"
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          {/* Search Bar - Desktop */}
          {!showSearch ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden md:flex"
              onClick={() => setShowSearch(true)}
            >
              <Search className="h-5 w-5" />
            </Button>
          ) : (
            <form onSubmit={handleSearch} className="hidden md:flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search auctions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          {isAuthenticated ? (
            <>
              {/* Create Dropdown - FIXED */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="hidden md:inline-flex"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate('/dashboard/products/new')}>
                    <Package className="mr-2 h-4 w-4" />
                    Add Product
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/auctions')}>
                    <Gavel className="mr-2 h-4 w-4" />
                    Browse Auctions
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/dashboard/bids')}>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    My Bids
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Notifications with Badge */}
              <Button 
                variant="ghost" 
                size="icon" 
                className="hidden md:flex relative" 
                asChild
              >
                <Link to="/notifications">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </Link>
              </Button>
              
              {/* User Dropdown - FIXED */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full p-0"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <div className="flex items-center gap-3 p-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-1 flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user?.email}
                      </p>
                      <Badge variant="outline" className="w-fit text-xs">
                        {user?.role}
                      </Badge>
                    </div>
                  </div>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuLabel>Dashboard</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => navigate('/dashboard')}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Overview
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/dashboard/bids')}>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    My Bids
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/dashboard/products')}>
                    <Package className="mr-2 h-4 w-4" />
                    My Products
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/dashboard/payments')}>
                    <Wallet className="mr-2 h-4 w-4" />
                    Payments
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => navigate('/dashboard/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    Profile Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/notifications')}>
                    <Bell className="mr-2 h-4 w-4" />
                    Notifications
                    {unreadCount > 0 && (
                      <Badge variant="destructive" className="ml-auto text-xs">
                        {unreadCount}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                  
                  {user?.role === UserRole.ADMIN && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Admin</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => navigate('/admin')}>
                        <Shield className="mr-2 h-4 w-4" />
                        Admin Panel
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onSelect={() => navigate('/how-it-works')}>
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Help & Support
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={() => navigate('/login')}>
                Sign In
              </Button>
              <Button type="button" onClick={() => navigate('/register')}>
                Get Started
              </Button>
            </div>
          )}

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button type="button" variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              {/* Mobile Search */}
              <form onSubmit={handleSearch} className="mt-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search auctions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </form>

              <nav className="flex flex-col gap-4 mt-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="text-lg font-medium flex items-center gap-3"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <link.icon className="h-5 w-5" />
                    {link.label}
                  </Link>
                ))}

                {isAuthenticated ? (
                  <>
                    <div className="border-t pt-4 mt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</p>
                      <Link
                        to="/dashboard/products/new"
                        className="text-base font-medium flex items-center gap-3 py-2"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Plus className="h-5 w-5" />
                        Add Product
                      </Link>
                      <Link
                        to="/notifications"
                        className="text-base font-medium flex items-center gap-3 py-2"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Bell className="h-5 w-5" />
                        Notifications
                        {unreadCount > 0 && (
                          <Badge variant="destructive" className="ml-auto">
                            {unreadCount}
                          </Badge>
                        )}
                      </Link>
                    </div>

                    <div className="border-t pt-4 mt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-3">Account</p>
                      <Link
                        to="/dashboard"
                        className="text-base font-medium flex items-center gap-3 py-2"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <LayoutDashboard className="h-5 w-5" />
                        Dashboard
                      </Link>
                      <Link
                        to="/dashboard/profile"
                        className="text-base font-medium flex items-center gap-3 py-2"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <User className="h-5 w-5" />
                        Profile
                      </Link>
                      {user?.role === UserRole.ADMIN && (
                        <Link
                          to="/admin"
                          className="text-base font-medium flex items-center gap-3 py-2"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Shield className="h-5 w-5" />
                          Admin Panel
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          handleLogout();
                          setMobileMenuOpen(false);
                        }}
                        className="w-full text-left text-base font-medium flex items-center gap-3 py-2 text-destructive"
                      >
                        <LogOut className="h-5 w-5" />
                        Log out
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 mt-4 border-t pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        navigate('/login');
                        setMobileMenuOpen(false);
                      }}
                    >
                      Sign In
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        navigate('/register');
                        setMobileMenuOpen(false);
                      }}
                    >
                      Get Started
                    </Button>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
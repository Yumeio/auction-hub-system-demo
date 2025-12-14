import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/api';
import type { Notification } from '@/api/types';
import { 
  Bell, 
  BellOff, 
  Check, 
  Gavel, 
  Receipt, 
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Notifications() {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Subscribe to real-time notifications via SSE
    const eventSource = apiClient.sse.subscribeToNotifications((data) => {
      setNotifications(data);
    });

    setIsLoading(false);

    return () => {
      eventSource.close();
    };
  }, [isAuthenticated]);

  const markAsRead = (notificationId: number) => {
    setNotifications(notifications.map(n => 
      n.notification_id === notificationId ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'bid':
      case 'outbid':
        return Gavel;
      case 'auction_won':
      case 'auction_end':
        return CheckCircle;
      case 'payment':
        return Receipt;
      case 'product':
        return Package;
      default:
        return Bell;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'auction_won':
        return 'text-green-600 bg-green-50 dark:bg-green-950';
      case 'outbid':
        return 'text-orange-600 bg-orange-50 dark:bg-orange-950';
      case 'payment':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-950';
      case 'product':
        return 'text-purple-600 bg-purple-50 dark:bg-purple-950';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read);

  const renderNotificationList = (notifList: Notification[]) => {
    if (notifList.length === 0) {
      return (
        <div className="text-center py-16">
          <BellOff className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="text-lg font-medium mb-2">No notifications</h3>
          <p className="text-sm text-muted-foreground">
            You're all caught up!
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {notifList.map((notification) => {
          const Icon = getNotificationIcon(notification.type);
          const colorClass = getNotificationColor(notification.type);
          
          return (
            <Card 
              key={notification.notification_id}
              className={`hover:shadow-md transition-shadow ${!notification.read ? 'border-primary/50' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className={`p-3 rounded-full ${colorClass} shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold">
                        {notification.title}
                        {!notification.read && (
                          <Badge variant="default" className="ml-2 text-xs">New</Badge>
                        )}
                      </h3>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      {notification.related_auction_id && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/auctions/${notification.related_auction_id}`}>
                            View Auction
                          </Link>
                        </Button>
                      )}
                      
                      {!notification.read && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => markAsRead(notification.notification_id)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Mark as read
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <MainLayout>
        <div className="container py-16">
          <Card>
            <CardContent className="py-16 text-center">
              <Bell className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
              <h3 className="text-lg font-medium mb-2">Login Required</h3>
              <p className="text-sm text-muted-foreground mb-6">
                You need to be logged in to view notifications
              </p>
              <Button asChild>
                <Link to="/login">Login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="text-muted-foreground mt-1">
              Stay updated with your auction activity
            </p>
          </div>
          
          {unreadNotifications.length > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark all as read
            </Button>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{notifications.length}</p>
                </div>
                <Bell className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unread</p>
                  <p className="text-2xl font-bold text-primary">{unreadNotifications.length}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Read</p>
                  <p className="text-2xl font-bold text-green-600">{readNotifications.length}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">
                All <span className="ml-1 text-xs">({notifications.length})</span>
              </TabsTrigger>
              <TabsTrigger value="unread">
                Unread <span className="ml-1 text-xs">({unreadNotifications.length})</span>
              </TabsTrigger>
              <TabsTrigger value="read">
                Read <span className="ml-1 text-xs">({readNotifications.length})</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              {renderNotificationList(notifications)}
            </TabsContent>

            <TabsContent value="unread" className="mt-6">
              {renderNotificationList(unreadNotifications)}
            </TabsContent>

            <TabsContent value="read" className="mt-6">
              {renderNotificationList(readNotifications)}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Package, Gavel, DollarSign, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotificationsSSE } from '@/hooks/use-sse';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { apiClient } from '@/api';
import type { Notification } from '@/api/types';

export function NotificationsDropdown() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const handleNotificationsUpdate = useCallback((data: Notification[]) => {
    setNotifications(data);
  }, []);

  useNotificationsSSE(handleNotificationsUpdate);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (notificationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.notifications.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => 
          n.notification_id === notificationId ? { ...n, read: true } : n
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiClient.notifications.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      try {
        await apiClient.notification.markAsRead(notification.notification_id);
        setNotifications(prev => 
          prev.map(n => 
            n.notification_id === notification.notification_id ? { ...n, read: true } : n
          )
        );
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }

    // Navigate based on notification type
    if (notification.related_auction_id) {
      navigate(`/auctions/${notification.related_auction_id}`);
    } else if (notification.related_payment_id) {
      navigate('/dashboard/payments');
    }
    
    setIsOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'outbid':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'won':
        return <Gavel className="h-4 w-4 text-primary" />;
      case 'auction_ending':
        return <Gavel className="h-4 w-4 text-orange-500" />;
      case 'payment':
        return <DollarSign className="h-4 w-4 text-primary" />;
      case 'product_approved':
        return <Package className="h-4 w-4 text-primary" />;
      case 'product_rejected':
        return <Package className="h-4 w-4 text-destructive" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Just now';
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-popover">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllAsRead}
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/70">
                You'll see auction updates here
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.notification_id}
                className={`flex items-start gap-3 p-3 cursor-pointer ${
                  !notification.read ? 'bg-muted/50' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-tight">
                    {notification.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    {formatTime(notification.created_at)}
                  </p>
                </div>
                {!notification.read && (
                  <button
                    className="flex-shrink-0 hover:bg-muted rounded p-1"
                    onClick={(e) => handleMarkAsRead(notification.notification_id, e)}
                    title="Mark as read"
                  >
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </button>
                )}
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Bell, Mail, Trophy, Gavel } from 'lucide-react';

interface NotificationSettings {
  auctionUpdates: boolean;
  outbidAlerts: boolean;
  winNotifications: boolean;
  auctionReminders: boolean;
}

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
    address: user?.address || '',
  });

  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [notifications, setNotifications] = useState<NotificationSettings>({
    auctionUpdates: true,
    outbidAlerts: true,
    winNotifications: true,
    auctionReminders: true,
  });

  // Load notification settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      try {
        setNotifications(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Failed to parse notification settings:', e);
      }
    }
  }, []);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  const handleNotificationChange = (key: keyof NotificationSettings) => {
    const newSettings = { ...notifications, [key]: !notifications[key] };
    setNotifications(newSettings);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      await apiClient.accounts.updateProfile({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
        phoneNumber: profileData.phoneNumber || null,
        address: profileData.address || null,
      });

      await refreshUser();

      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error.response?.data?.detail || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure your new passwords match.',
        variant: 'destructive',
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      await apiClient.accounts.changePassword(
        passwordData.oldPassword,
        passwordData.newPassword
      );

      toast({
        title: 'Password changed',
        description: 'Your password has been changed successfully.',
      });

      setPasswordData({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      toast({
        title: 'Password change failed',
        description: error.response?.data?.detail || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true);
    try {
      // Save to localStorage for now (can be extended to API call)
      localStorage.setItem('notificationSettings', JSON.stringify(notifications));
      
      // If API endpoint exists, call it here
      // await apiClient.accounts.updateNotificationSettings(notifications);

      toast({
        title: 'Notification preferences saved',
        description: 'Your email notification settings have been updated.',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to save preferences',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingNotifications(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={profileData.firstName}
                  onChange={handleProfileChange}
                  disabled={isUpdating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={profileData.lastName}
                  onChange={handleProfileChange}
                  disabled={isUpdating}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={profileData.email}
                onChange={handleProfileChange}
                disabled={isUpdating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={profileData.phoneNumber}
                onChange={handleProfileChange}
                disabled={isUpdating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                value={profileData.address}
                onChange={handleProfileChange}
                disabled={isUpdating}
              />
            </div>

            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Email Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Choose which email notifications you'd like to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-0.5">
                  <Label htmlFor="auctionUpdates" className="font-medium">
                    Auction Updates
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about auction status changes and important updates
                  </p>
                </div>
              </div>
              <Switch
                id="auctionUpdates"
                checked={notifications.auctionUpdates}
                onCheckedChange={() => handleNotificationChange('auctionUpdates')}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Gavel className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-0.5">
                  <Label htmlFor="outbidAlerts" className="font-medium">
                    Outbid Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive immediate alerts when someone outbids you
                  </p>
                </div>
              </div>
              <Switch
                id="outbidAlerts"
                checked={notifications.outbidAlerts}
                onCheckedChange={() => handleNotificationChange('outbidAlerts')}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Trophy className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-0.5">
                  <Label htmlFor="winNotifications" className="font-medium">
                    Win Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when you win an auction
                  </p>
                </div>
              </div>
              <Switch
                id="winNotifications"
                checked={notifications.winNotifications}
                onCheckedChange={() => handleNotificationChange('winNotifications')}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-0.5">
                  <Label htmlFor="auctionReminders" className="font-medium">
                    Auction Reminders
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Receive reminders before auctions you're participating in end
                  </p>
                </div>
              </div>
              <Switch
                id="auctionReminders"
                checked={notifications.auctionReminders}
                onCheckedChange={() => handleNotificationChange('auctionReminders')}
              />
            </div>
          </div>

          <Button onClick={handleSaveNotifications} disabled={isSavingNotifications}>
            {isSavingNotifications ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Notification Preferences'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">Current Password</Label>
              <Input
                id="oldPassword"
                name="oldPassword"
                type="password"
                value={passwordData.oldPassword}
                onChange={handlePasswordChange}
                disabled={isChangingPassword}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                disabled={isChangingPassword}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                disabled={isChangingPassword}
              />
            </div>

            <Button type="submit" disabled={isChangingPassword}>
              {isChangingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                'Change Password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Username</span>
            <span className="font-medium">{user?.username}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Account Status</span>
            <span className="font-medium capitalize">{user?.status}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium capitalize">{user?.role}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

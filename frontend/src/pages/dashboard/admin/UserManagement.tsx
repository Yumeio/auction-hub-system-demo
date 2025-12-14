import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiClient } from '@/api';
import { useToast } from '@/hooks/use-toast';
import type { UserResponse } from '@/api/types';
import { Loader2, Users, Search, Shield, User, Ban, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

// Note: This would require admin-specific endpoints in the backend
// Using mock data structure for now

interface AdminUserResponse extends UserResponse {
  totalBids?: number;
  totalProducts?: number;
}

export default function UserManagement() {
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUserResponse | null>(null);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; action: string }>({ open: false, action: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // In real implementation, this would fetch from admin endpoint
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        // Simulating admin user list - backend would provide this
        // const response = await apiClient.admin.listUsers({ limit: 100 });
        // setUsers(response.items);
        
        // For now, just show loading state then empty
        setTimeout(() => {
          setUsers([]);
          setIsLoading(false);
        }, 500);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [statusFilter]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/10 text-green-600',
      inactive: 'bg-muted text-muted-foreground',
      suspended: 'bg-destructive/10 text-destructive',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const getRoleColor = (role: string) => {
    return role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground';
  };

  const handleAction = async () => {
    if (!selectedUser) return;
    setIsProcessing(true);
    
    try {
      // These would call admin endpoints
      toast({ title: `User ${actionDialog.action}ed successfully` });
      setActionDialog({ open: false, action: '' });
    } catch (error: any) {
      toast({ title: 'Action failed', description: error.response?.data?.detail, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchQuery === '' || 
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="flex gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">
              {users.length === 0 
                ? 'User management requires admin API endpoints. Connect your backend to see users.'
                : 'No users found matching your criteria'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.accountID}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.firstName} {user.lastName}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRoleColor(user.role)}>
                      {user.role === 'admin' ? <Shield className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(user.status)}>{user.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {/* Would show created date */}
                    -
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.lastLoginAt ? format(new Date(user.lastLoginAt), 'PP') : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {user.status === 'active' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setSelectedUser(user); setActionDialog({ open: true, action: 'suspend' }); }}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                      {user.status === 'suspended' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setSelectedUser(user); setActionDialog({ open: true, action: 'activate' }); }}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ open, action: open ? actionDialog.action : '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.action === 'suspend' && 'Suspend User'}
              {actionDialog.action === 'activate' && 'Activate User'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.action === 'suspend' && `Are you sure you want to suspend ${selectedUser?.firstName} ${selectedUser?.lastName}? They will not be able to log in.`}
              {actionDialog.action === 'activate' && `Are you sure you want to reactivate ${selectedUser?.firstName} ${selectedUser?.lastName}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, action: '' })}>Cancel</Button>
            <Button
              variant={actionDialog.action === 'suspend' ? 'destructive' : 'default'}
              onClick={handleAction}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

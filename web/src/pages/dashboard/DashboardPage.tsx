import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { groupsApi, notificationsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { formatCurrency, getStatusColor, formatDate } from '@/lib/utils';
import {
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Bell,
  TrendingUp,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await groupsApi.list();
      return response.data;
    },
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: async () => {
      const response = await notificationsApi.list(1);
      return response.data.notifications.slice(0, 5);
    },
  });

  const savingsGroups = groups?.filter((g: any) => g.type === 'SAVINGS') || [];
  const totalBalance = savingsGroups.reduce(
    (sum: number, g: any) => sum + parseFloat(g.myBalance || '0'),
    0
  );
  const totalContributions = savingsGroups.reduce(
    (sum: number, g: any) => sum + parseFloat(g.totalContributions || '0'),
    0
  );

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-muted-foreground">
            Here's an overview of your savings groups
          </p>
        </div>
        <Button asChild>
          <Link to="/groups/create">
            <Plus className="w-4 h-4 mr-2" />
            Create Group
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {savingsGroups.length} group(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Contributed
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalContributions)}
            </div>
            <p className="text-xs text-muted-foreground">Your total contributions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Groups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{savingsGroups.length}</div>
            <p className="text-xs text-muted-foreground">
              Savings groups you're part of
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12.5%</div>
            <p className="text-xs text-muted-foreground">From last month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Groups */}
        <Card>
          <CardHeader>
            <CardTitle>Your Groups</CardTitle>
            <CardDescription>
              Quick access to your savings groups
            </CardDescription>
          </CardHeader>
          <CardContent>
            {groupsLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : savingsGroups.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  You're not part of any savings groups yet
                </p>
                <Button asChild>
                  <Link to="/groups/create">Create Your First Group</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {savingsGroups.slice(0, 5).map((group: any) => (
                  <Link
                    key={group.id}
                    to={`/groups/${group.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <h4 className="font-medium">{group.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {group.memberCount} members
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatCurrency(group.myBalance || 0)}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(
                          group.status
                        )}`}
                      >
                        {group.status}
                      </span>
                    </div>
                  </Link>
                ))}
                {savingsGroups.length > 5 && (
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/groups">View All Groups</Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Notifications</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/notifications">
                  <Bell className="w-4 h-4 mr-1" />
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {notifications?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No notifications yet
              </p>
            ) : (
              <div className="space-y-4">
                {notifications?.map((notification: any) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border ${
                      !notification.readAt ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                  >
                    <h4 className="font-medium text-sm">{notification.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.body}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

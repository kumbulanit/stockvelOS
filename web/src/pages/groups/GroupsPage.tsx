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
import { groupsApi } from '@/lib/api';
import { formatCurrency, getStatusColor, getRoleColor } from '@/lib/utils';
import { Plus, Users, Calendar, ChevronRight } from 'lucide-react';

export default function GroupsPage() {
  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await groupsApi.list();
      return response.data;
    },
  });

  const savingsGroups = groups?.filter((g: any) => g.type === 'SAVINGS') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Savings Groups</h1>
          <p className="text-muted-foreground">
            Manage your savings group memberships
          </p>
        </div>
        <Button asChild>
          <Link to="/groups/create">
            <Plus className="w-4 h-4 mr-2" />
            Create Group
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-48" />
            </Card>
          ))}
        </div>
      ) : savingsGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Groups Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              You're not part of any savings groups. Create one to get started!
            </p>
            <Button asChild>
              <Link to="/groups/create">Create Your First Group</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {savingsGroups.map((group: any) => (
            <Card key={group.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {group.description || 'No description'}
                    </CardDescription>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
                      group.status
                    )}`}
                  >
                    {group.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <Users className="w-4 h-4 mr-1" />
                    {group.memberCount} members
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${getRoleColor(
                      group.myRole
                    )}`}
                  >
                    {group.myRole}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">My Balance</p>
                    <p className="font-semibold">
                      {formatCurrency(group.myBalance || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Monthly Contribution
                    </p>
                    <p className="font-semibold">
                      {formatCurrency(group.savingsRule?.contributionAmount || 0)}
                    </p>
                  </div>
                </div>

                {group.savingsRule?.contributionDay && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-2" />
                    Due on day {group.savingsRule.contributionDay} of each month
                  </div>
                )}

                <Button asChild className="w-full" variant="outline">
                  <Link to={`/groups/${group.id}`}>
                    View Details
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

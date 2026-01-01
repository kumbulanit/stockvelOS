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
import { groupsApi, contributionsApi } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { Plus, Wallet, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function ContributionsPage() {
  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await groupsApi.list();
      return response.data.filter((g: any) => g.type === 'SAVINGS');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contributions</h1>
          <p className="text-muted-foreground">
            Manage your contributions across all groups
          </p>
        </div>
      </div>

      {/* Group Contribution Cards */}
      {groups?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Groups</h3>
            <p className="text-muted-foreground text-center mb-4">
              Join a savings group to start making contributions
            </p>
            <Button asChild>
              <Link to="/groups">View Groups</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups?.map((group: any) => (
            <GroupContributions key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupContributions({ group }: { group: any }) {
  const { data: contributions, isLoading } = useQuery({
    queryKey: ['contributions', group.id, 'my'],
    queryFn: async () => {
      const response = await contributionsApi.getMy(group.id);
      return response.data;
    },
  });

  const pendingCount = contributions?.contributions?.filter(
    (c: any) => c.status === 'PENDING'
  ).length || 0;
  const approvedCount = contributions?.contributions?.filter(
    (c: any) => c.status === 'APPROVED'
  ).length || 0;
  const totalContributed = contributions?.contributions
    ?.filter((c: any) => c.status === 'APPROVED')
    .reduce((sum: number, c: any) => sum + parseFloat(c.amount), 0) || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{group.name}</CardTitle>
            <CardDescription>
              Monthly contribution: {formatCurrency(group.savingsRule?.contributionAmount || 0)}
            </CardDescription>
          </div>
          <Button asChild size="sm">
            <Link to={`/groups/${group.id}`}>
              <Plus className="w-4 h-4 mr-2" />
              Contribute
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <CheckCircle className="w-5 h-5 mx-auto text-green-600 mb-1" />
            <p className="text-lg font-semibold">{approvedCount}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <Clock className="w-5 h-5 mx-auto text-yellow-600 mb-1" />
            <p className="text-lg font-semibold">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <Wallet className="w-5 h-5 mx-auto text-blue-600 mb-1" />
            <p className="text-lg font-semibold">{formatCurrency(totalContributed)}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>

        {/* Recent Contributions */}
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded" />
            ))}
          </div>
        ) : contributions?.contributions?.length === 0 ? (
          <p className="text-center py-4 text-muted-foreground">
            No contributions yet
          </p>
        ) : (
          <div className="space-y-2">
            {contributions?.contributions?.slice(0, 5).map((c: any) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  {c.status === 'APPROVED' && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  {c.status === 'PENDING' && (
                    <Clock className="w-5 h-5 text-yellow-600" />
                  )}
                  {c.status === 'REJECTED' && (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <div>
                    <p className="font-medium">{c.contributionPeriod}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(c.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCurrency(c.amount)}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(
                      c.status
                    )}`}
                  >
                    {c.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

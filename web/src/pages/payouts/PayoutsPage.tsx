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
import { groupsApi, payoutsApi } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { CreditCard, Clock, CheckCircle, Calendar } from 'lucide-react';

export default function PayoutsPage() {
  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await groupsApi.list();
      return response.data.filter((g: any) => g.type === 'SAVINGS');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payouts</h1>
        <p className="text-muted-foreground">
          View and manage payouts across all your groups
        </p>
      </div>

      {groups?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Groups</h3>
            <p className="text-muted-foreground text-center mb-4">
              Join a savings group to receive payouts
            </p>
            <Button asChild>
              <Link to="/groups">View Groups</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups?.map((group: any) => (
            <GroupPayouts key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupPayouts({ group }: { group: any }) {
  const { data: payouts, isLoading } = useQuery({
    queryKey: ['payouts', group.id],
    queryFn: async () => {
      const response = await payoutsApi.getForGroup(group.id);
      return response.data;
    },
  });

  const isLeader = ['CHAIRPERSON', 'TREASURER'].includes(group.myRole);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{group.name}</CardTitle>
            <CardDescription>
              Payout schedule and history
            </CardDescription>
          </div>
          {isLeader && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/groups/${group.id}`}>
                Manage Payouts
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded" />
            ))}
          </div>
        ) : payouts?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No payouts scheduled yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payouts?.map((payout: any) => (
              <div
                key={payout.id}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  {payout.status === 'COMPLETED' && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  {payout.status === 'PENDING' && (
                    <Clock className="w-5 h-5 text-yellow-600" />
                  )}
                  {payout.status === 'APPROVED' && (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  )}
                  <div>
                    <p className="font-medium">
                      {payout.recipient?.user?.firstName}{' '}
                      {payout.recipient?.user?.lastName}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {formatDate(payout.scheduledDate)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-lg">
                    {formatCurrency(payout.amount)}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(
                      payout.status
                    )}`}
                  >
                    {payout.status}
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

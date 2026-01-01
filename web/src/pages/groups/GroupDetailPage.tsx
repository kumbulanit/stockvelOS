import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { savingsApi, contributionsApi, groupsApi } from '@/lib/api';
import {
  formatCurrency,
  formatDate,
  getStatusColor,
  getRoleColor,
  getInitials,
} from '@/lib/utils';
import {
  Users,
  Wallet,
  Calendar,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Clock,
  FileText,
} from 'lucide-react';

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const queryClient = useQueryClient();
  const [showContributeForm, setShowContributeForm] = useState(false);

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const response = await savingsApi.get(groupId!);
      return response.data;
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['group', groupId, 'summary'],
    queryFn: async () => {
      const response = await savingsApi.getSummary(groupId!);
      return response.data;
    },
  });

  const { data: myContributions } = useQuery({
    queryKey: ['contributions', groupId, 'my'],
    queryFn: async () => {
      const response = await contributionsApi.getMy(groupId!);
      return response.data;
    },
  });

  const { data: statement } = useQuery({
    queryKey: ['group', groupId, 'statement'],
    queryFn: async () => {
      const response = await savingsApi.getStatement(groupId!);
      return response.data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ['group', groupId, 'members'],
    queryFn: async () => {
      const response = await groupsApi.getMembers(groupId!);
      return response.data;
    },
  });

  if (groupLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const isLeader = ['CHAIRPERSON', 'TREASURER'].includes(group?.myRole);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{group?.name}</h1>
          <p className="text-muted-foreground">
            {group?.description || 'Savings group'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
                group?.status
              )}`}
            >
              {group?.status}
            </span>
            <span
              className={`text-xs px-2 py-1 rounded-full ${getRoleColor(
                group?.myRole
              )}`}
            >
              {group?.myRole}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {isLeader && (
            <Button asChild variant="outline">
              <Link to={`/contributions/review/${groupId}`}>
                <FileText className="w-4 h-4 mr-2" />
                Review Contributions
              </Link>
            </Button>
          )}
          <Button onClick={() => setShowContributeForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Contribute
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Group Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.groupBalance || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              My Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.myBalance || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.memberCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Contribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(group?.savingsRule?.contributionAmount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Due on day {group?.savingsRule?.contributionDay}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* My Contributions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">My Contributions</CardTitle>
            <CardDescription>
              Your contribution history for this group
            </CardDescription>
          </CardHeader>
          <CardContent>
            {myContributions?.contributions?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No contributions yet
              </p>
            ) : (
              <div className="space-y-3">
                {myContributions?.contributions?.slice(0, 5).map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      {c.status === 'APPROVED' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <Clock className="w-5 h-5 text-yellow-600" />
                      )}
                      <div>
                        <p className="font-medium">
                          {formatCurrency(c.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.contributionPeriod}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
                        c.status
                      )}`}
                    >
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Members</CardTitle>
            <CardDescription>
              Group members and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members?.map((member: any) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={member.user?.avatarUrl} />
                      <AvatarFallback>
                        {getInitials(
                          member.user?.firstName || '',
                          member.user?.lastName || ''
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {member.user?.firstName} {member.user?.lastName}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${getRoleColor(
                          member.role
                        )}`}
                      >
                        {member.role}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatCurrency(member.totalContributed || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">contributed</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ledger Statement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transaction History</CardTitle>
          <CardDescription>
            Complete ledger of group transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statement?.entries?.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-2">
              {statement?.entries?.slice(0, 10).map((entry: any) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {entry.direction === 'CREDIT' ? (
                      <ArrowUpRight className="w-5 h-5 text-green-600" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 text-red-600" />
                    )}
                    <div>
                      <p className="font-medium">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-medium ${
                        entry.direction === 'CREDIT'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {entry.direction === 'CREDIT' ? '+' : '-'}
                      {formatCurrency(Math.abs(parseFloat(entry.amount)))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Balance: {formatCurrency(entry.balanceAfter)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

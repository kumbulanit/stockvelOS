import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { contributionsApi, savingsApi, documentsApi } from '@/lib/api';
import {
  formatCurrency,
  formatDate,
  getStatusColor,
} from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  ExternalLink,
  Loader2,
} from 'lucide-react';

export default function ContributionReviewPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedContribution, setSelectedContribution] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');

  const { data: group } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const response = await savingsApi.get(groupId!);
      return response.data;
    },
  });

  const { data: contributions, isLoading } = useQuery({
    queryKey: ['contributions', groupId, 'pending'],
    queryFn: async () => {
      const response = await contributionsApi.getForGroup(groupId!, {
        status: 'PENDING',
      });
      return response.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return contributionsApi.approve(id, notes);
    },
    onSuccess: () => {
      toast({
        title: 'Contribution approved',
        description: 'The contribution has been approved and credited.',
      });
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
      setSelectedContribution(null);
      setApprovalNotes('');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to approve',
        description: error.response?.data?.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return contributionsApi.reject(id, reason);
    },
    onSuccess: () => {
      toast({
        title: 'Contribution rejected',
        description: 'The contribution has been rejected.',
      });
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
      setSelectedContribution(null);
      setRejectReason('');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to reject',
        description: error.response?.data?.message || 'Something went wrong',
        variant: 'destructive',
      });
    },
  });

  const handleApprove = () => {
    if (selectedContribution) {
      approveMutation.mutate({
        id: selectedContribution.id,
        notes: approvalNotes || undefined,
      });
    }
  };

  const handleReject = () => {
    if (selectedContribution && rejectReason) {
      rejectMutation.mutate({
        id: selectedContribution.id,
        reason: rejectReason,
      });
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to {group?.name}
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Review Contributions</h1>
        <p className="text-muted-foreground">
          Review and approve pending contributions for {group?.name}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Contributions List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Contributions</CardTitle>
            <CardDescription>
              {contributions?.contributions?.length || 0} contributions awaiting
              review
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-100 rounded" />
                ))}
              </div>
            ) : contributions?.contributions?.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">
                  All contributions have been reviewed!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {contributions?.contributions?.map((c: any) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedContribution(c)}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedContribution?.id === c.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {c.member?.user?.firstName} {c.member?.user?.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {c.contributionPeriod}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(c.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(c.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contribution Details & Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contribution Details</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedContribution ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a contribution to view details</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Details */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Member</span>
                    <span className="font-medium">
                      {selectedContribution.member?.user?.firstName}{' '}
                      {selectedContribution.member?.user?.lastName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">
                      {formatCurrency(selectedContribution.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Period</span>
                    <span>{selectedContribution.contributionPeriod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Method</span>
                    <span>{selectedContribution.paymentMethod}</span>
                  </div>
                  {selectedContribution.externalReference && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reference</span>
                      <span>{selectedContribution.externalReference}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Submitted</span>
                    <span>{formatDate(selectedContribution.createdAt)}</span>
                  </div>
                </div>

                {/* Proof of Payment */}
                {selectedContribution.popDocumentId && (
                  <div className="pt-4 border-t">
                    <Label className="mb-2 block">Proof of Payment</Label>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={async () => {
                        const res = await documentsApi.getDownloadUrl(
                          selectedContribution.popDocumentId
                        );
                        window.open(res.data.url, '_blank');
                      }}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Document
                    </Button>
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t space-y-4">
                  <div className="space-y-2">
                    <Label>Approval Notes (optional)</Label>
                    <Input
                      placeholder="Add notes..."
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleApprove}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Approve Contribution
                  </Button>

                  <div className="space-y-2">
                    <Label>Rejection Reason</Label>
                    <Input
                      placeholder="Reason for rejection..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={handleReject}
                    disabled={!rejectReason || rejectMutation.isPending}
                  >
                    {rejectMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-2" />
                    )}
                    Reject Contribution
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

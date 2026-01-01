import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
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
import { savingsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';

const createGroupSchema = z.object({
  name: z.string().min(3, 'Group name must be at least 3 characters'),
  description: z.string().optional(),
  contributionAmount: z.coerce.number().min(1, 'Contribution must be at least R1'),
  contributionFrequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']),
  contributionDay: z.coerce.number().min(1).max(31),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  latePaymentPenaltyPercent: z.coerce.number().min(0).max(100).optional(),
  minApprovalsForPayout: z.coerce.number().min(1).optional(),
});

type CreateGroupFormData = z.infer<typeof createGroupSchema>;

export default function CreateGroupPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<CreateGroupFormData>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: {
      contributionFrequency: 'MONTHLY',
      contributionDay: 1,
      minApprovalsForPayout: 2,
      latePaymentPenaltyPercent: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateGroupFormData) => {
      const response = await savingsApi.create({
        ...data,
        type: 'SAVINGS',
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Group created!',
        description: 'Your savings group has been created successfully.',
      });
      navigate(`/groups/${data.id}`);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create group');
    },
  });

  const onSubmit = (data: CreateGroupFormData) => {
    setError(null);
    createMutation.mutate(data);
  };

  const frequency = watch('contributionFrequency');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create Savings Group</CardTitle>
          <CardDescription>
            Set up a new savings group with contribution rules
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                {error}
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Basic Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="name">Group Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Family Savings Club"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="What's this group for?"
                  {...register('description')}
                />
              </div>
            </div>

            {/* Contribution Rules */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium text-lg">Contribution Rules</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contributionAmount">
                    Contribution Amount (ZAR) *
                  </Label>
                  <Input
                    id="contributionAmount"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="500"
                    {...register('contributionAmount')}
                  />
                  {errors.contributionAmount && (
                    <p className="text-sm text-red-600">
                      {errors.contributionAmount.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contributionFrequency">Frequency *</Label>
                  <select
                    id="contributionFrequency"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    {...register('contributionFrequency')}
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Bi-weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contributionDay">
                  {frequency === 'WEEKLY'
                    ? 'Day of Week (1=Mon, 7=Sun) *'
                    : 'Day of Month *'}
                </Label>
                <Input
                  id="contributionDay"
                  type="number"
                  min="1"
                  max={frequency === 'WEEKLY' ? 7 : 31}
                  {...register('contributionDay')}
                />
                {errors.contributionDay && (
                  <p className="text-sm text-red-600">
                    {errors.contributionDay.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    {...register('startDate')}
                  />
                  {errors.startDate && (
                    <p className="text-sm text-red-600">
                      {errors.startDate.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date (optional)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    {...register('endDate')}
                  />
                </div>
              </div>
            </div>

            {/* Advanced Options */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium text-lg">Advanced Options</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latePaymentPenaltyPercent">
                    Late Payment Penalty (%)
                  </Label>
                  <Input
                    id="latePaymentPenaltyPercent"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0"
                    {...register('latePaymentPenaltyPercent')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minApprovalsForPayout">
                    Min Approvals for Payout
                  </Label>
                  <Input
                    id="minApprovalsForPayout"
                    type="number"
                    min="1"
                    placeholder="2"
                    {...register('minApprovalsForPayout')}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Group'
                )}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}

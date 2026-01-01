import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groceryApi } from '@/lib/api';
import { 
  ArrowLeft, 
  Users, 
  Package,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Edit2,
  AlertCircle,
  User
} from 'lucide-react';

interface DistributionItem {
  id: string;
  quantity: number;
  status: 'ALLOCATED' | 'COLLECTED' | 'UNCOLLECTED';
  confirmedAt: string | null;
  product: { name: string; unit: string };
  member: { user: { name: string; email: string } };
}

interface Distribution {
  id: string;
  eventName: string;
  eventDate: string;
  status: 'DRAFT' | 'CONFIRMED' | 'DISTRIBUTED' | 'CANCELLED';
  allocationRule: string;
  notes: string | null;
  createdAt: string;
  items: DistributionItem[];
  createdBy: { name: string };
}

export function DistributionDetailPage() {
  const { groupId, distributionId } = useParams<{ groupId: string; distributionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'collected'>('all');

  const { data: distribution, isLoading } = useQuery({
    queryKey: ['grocery-distribution', distributionId],
    queryFn: () => groceryApi.getDistribution(groupId!, distributionId!).then(res => res.data),
    enabled: !!groupId && !!distributionId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: string }) =>
      groceryApi.updateDistributionItemStatus(itemId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-distribution', distributionId] });
    },
  });

  const finalizeDistributionMutation = useMutation({
    mutationFn: () => groceryApi.finalizeDistribution(groupId!, distributionId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-distribution', distributionId] });
      queryClient.invalidateQueries({ queryKey: ['grocery-distributions', groupId] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!distribution) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Package className="h-12 w-12 mb-4" />
        <p>Distribution not found</p>
        <Link
          to={`/groups/${groupId}/grocery/distributions`}
          className="mt-2 text-emerald-600 hover:text-emerald-700"
        >
          Back to distributions
        </Link>
      </div>
    );
  }

  // Group items by member
  const itemsByMember = distribution.items?.reduce((acc: any, item: DistributionItem) => {
    const memberKey = item.member?.user?.email || 'unknown';
    if (!acc[memberKey]) {
      acc[memberKey] = {
        member: item.member,
        items: [],
      };
    }
    acc[memberKey].items.push(item);
    return acc;
  }, {}) || {};

  const members = Object.values(itemsByMember) as { member: any; items: DistributionItem[] }[];

  // Filter members
  const filteredMembers = members.filter(({ items }) => {
    if (filter === 'pending') return items.some(i => i.status === 'ALLOCATED');
    if (filter === 'collected') return items.every(i => i.status === 'COLLECTED');
    return true;
  });

  const totalItems = distribution.items?.length || 0;
  const collectedItems = distribution.items?.filter((i: DistributionItem) => i.status === 'COLLECTED').length || 0;
  const pendingItems = distribution.items?.filter((i: DistributionItem) => i.status === 'ALLOCATED').length || 0;

  const statusColors = {
    DRAFT: 'bg-gray-100 text-gray-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    DISTRIBUTED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {distribution.eventName}
            </h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              statusColors[distribution.status as keyof typeof statusColors]
            }`}>
              {distribution.status}
            </span>
          </div>
          <p className="text-gray-600 flex items-center gap-2 mt-1">
            <Calendar className="h-4 w-4" />
            {new Date(distribution.eventDate).toLocaleDateString()}
            <span className="mx-2">•</span>
            <Users className="h-4 w-4" />
            {members.length} members
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="text-xl font-bold text-gray-900">{totalItems}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Collected</p>
              <p className="text-xl font-bold text-gray-900">{collectedItems}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-xl font-bold text-gray-900">{pendingItems}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Collection Progress</span>
          <span className="text-sm text-gray-500">
            {collectedItems} of {totalItems} items collected
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-emerald-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${totalItems > 0 ? (collectedItems / totalItems) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">Filter:</span>
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          {(['all', 'pending', 'collected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === f
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Members & Items */}
      <div className="space-y-4">
        {filteredMembers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-2" />
            <p>No members match the filter</p>
          </div>
        ) : (
          filteredMembers.map(({ member, items }) => {
            const memberCollected = items.filter(i => i.status === 'COLLECTED').length;
            const memberTotal = items.length;
            const allCollected = memberCollected === memberTotal;

            return (
              <div
                key={member?.user?.email}
                className={`bg-white rounded-xl shadow-sm border ${
                  allCollected ? 'border-green-200' : 'border-gray-200'
                } overflow-hidden`}
              >
                <div className={`p-4 flex items-center justify-between ${
                  allCollected ? 'bg-green-50' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      allCollected ? 'bg-green-100' : 'bg-gray-200'
                    }`}>
                      <User className={`h-5 w-5 ${
                        allCollected ? 'text-green-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {member?.user?.name || 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {member?.user?.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {allCollected ? (
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                        All Collected
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">
                        {memberCollected}/{memberTotal} collected
                      </span>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <div key={item.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">
                            {item.product.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {item.quantity} {item.product.unit}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === 'COLLECTED' ? (
                          <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                            <CheckCircle className="h-4 w-4" />
                            Collected
                          </span>
                        ) : item.status === 'UNCOLLECTED' ? (
                          <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                            <XCircle className="h-4 w-4" />
                            Uncollected
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateStatusMutation.mutate({
                                itemId: item.id,
                                status: 'COLLECTED',
                              })}
                              disabled={updateStatusMutation.isPending}
                              className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full hover:bg-green-200 transition-colors"
                            >
                              Mark Collected
                            </button>
                            <button
                              onClick={() => updateStatusMutation.mutate({
                                itemId: item.id,
                                status: 'UNCOLLECTED',
                              })}
                              disabled={updateStatusMutation.isPending}
                              className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-200 transition-colors"
                            >
                              Not Collected
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Actions */}
      {distribution.status === 'CONFIRMED' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Finalize Distribution</p>
              <p className="text-sm text-gray-500">
                Mark this distribution as complete once all items are accounted for
              </p>
            </div>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to finalize this distribution?')) {
                  finalizeDistributionMutation.mutate();
                }
              }}
              disabled={finalizeDistributionMutation.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {finalizeDistributionMutation.isPending ? 'Finalizing...' : 'Finalize'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DistributionDetailPage;

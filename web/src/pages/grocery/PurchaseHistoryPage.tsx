import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groceryApi } from '@/lib/api';
import { 
  ShoppingCart, 
  Search,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface PurchaseItem {
  id: string;
  quantity: number;
  unitCost: number;
  lineCost: number;
  product: { name: string; unit: string };
}

interface Purchase {
  id: string;
  purchaseDate: string;
  totalCost: number;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  notes: string | null;
  createdAt: string;
  items: PurchaseItem[];
  createdBy: { name: string };
  approvedBy?: { name: string };
  approvedAt?: string;
  receipt?: { id: string; fileUrl: string };
}

export function PurchaseHistoryPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['grocery-purchases', groupId, search, statusFilter],
    queryFn: () => groceryApi.getPurchases(groupId!, {
      search: search || undefined,
      status: statusFilter || undefined,
    }).then(res => res.data),
    enabled: !!groupId,
  });

  const approveMutation = useMutation({
    mutationFn: (purchaseId: string) => groceryApi.approvePurchase(groupId!, purchaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-purchases', groupId] });
      queryClient.invalidateQueries({ queryKey: ['grocery-summary', groupId] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ purchaseId, reason }: { purchaseId: string; reason: string }) => 
      groceryApi.rejectPurchase(groupId!, purchaseId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-purchases', groupId] });
    },
  });

  const statusIcons = {
    PENDING_APPROVAL: <Clock className="h-4 w-4 text-amber-500" />,
    APPROVED: <CheckCircle className="h-4 w-4 text-green-500" />,
    REJECTED: <XCircle className="h-4 w-4 text-red-500" />,
  };

  const statusColors = {
    PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase History</h1>
          <p className="text-gray-600">View and manage grocery purchases</p>
        </div>
        <Link
          to={`/groups/${groupId}/grocery/purchases/new`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <ShoppingCart className="h-4 w-4" />
          Record Purchase
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search purchases..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Purchases List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : data?.purchases?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <ShoppingCart className="h-12 w-12 mb-4" />
            <p>No purchases found</p>
            <Link
              to={`/groups/${groupId}/grocery/purchases/new`}
              className="mt-2 text-emerald-600 hover:text-emerald-700"
            >
              Record your first purchase
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {data?.purchases?.map((purchase: Purchase) => (
              <div key={purchase.id} className="bg-white">
                {/* Purchase Header */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(expandedId === purchase.id ? null : purchase.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <ShoppingCart className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          R {Number(purchase.totalCost).toFixed(2)}
                        </p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          statusColors[purchase.status]
                        }`}>
                          {statusIcons[purchase.status]}
                          {purchase.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(purchase.purchaseDate).toLocaleDateString()}
                        <span className="mx-1">•</span>
                        {purchase.items?.length || 0} items
                        <span className="mx-1">•</span>
                        by {purchase.createdBy?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {purchase.status === 'PENDING_APPROVAL' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            approveMutation.mutate(purchase.id);
                          }}
                          disabled={approveMutation.isPending}
                          className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-lg hover:bg-green-200 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const reason = prompt('Reason for rejection:');
                            if (reason) {
                              rejectMutation.mutate({ purchaseId: purchase.id, reason });
                            }
                          }}
                          disabled={rejectMutation.isPending}
                          className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {expandedId === purchase.id ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === purchase.id && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    {/* Notes */}
                    {purchase.notes && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">{purchase.notes}</p>
                      </div>
                    )}

                    {/* Receipt */}
                    {purchase.receipt && (
                      <div className="mt-4 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <a
                          href={purchase.receipt.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-emerald-600 hover:text-emerald-700"
                        >
                          View Receipt
                        </a>
                      </div>
                    )}

                    {/* Items Table */}
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Product
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                              Quantity
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                              Unit Cost
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                              Line Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {purchase.items?.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {item.product?.name}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600 text-right">
                                {item.quantity} {item.product?.unit}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600 text-right">
                                R {Number(item.unitCost).toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                                R {Number(item.lineCost).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-gray-200">
                          <tr>
                            <td colSpan={3} className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                              Total
                            </td>
                            <td className="px-4 py-2 text-sm font-bold text-gray-900 text-right">
                              R {Number(purchase.totalCost).toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Approval Info */}
                    {purchase.status === 'APPROVED' && purchase.approvedBy && (
                      <div className="mt-4 text-sm text-gray-500">
                        Approved by {purchase.approvedBy.name} on{' '}
                        {purchase.approvedAt && new Date(purchase.approvedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PurchaseHistoryPage;

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groceryApi } from '@/lib/api';
import { 
  ArrowLeft, 
  Users, 
  Package,
  Calculator,
  Calendar,
  AlertCircle
} from 'lucide-react';

interface DistributionItem {
  productId: string;
  totalQuantity: number;
}

interface MemberInfo {
  id: string;
  userId: string;
  user: { name: string; email: string };
  role: string;
}

export function CreateDistributionPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [allocationRule, setAllocationRule] = useState('EQUAL_SHARE');
  const [items, setItems] = useState<DistributionItem[]>([]);
  const [notes, setNotes] = useState('');

  // Fetch available stock
  const { data: stockData, isLoading: loadingStock } = useQuery({
    queryKey: ['grocery-stock', groupId],
    queryFn: () => groceryApi.getStock(groupId!).then(res => res.data),
    enabled: !!groupId,
  });

  // Fetch group members
  const { data: membersData } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => groceryApi.getSummary(groupId!).then(res => res.data),
    enabled: !!groupId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => groceryApi.createDistribution(groupId!, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['grocery-distributions', groupId] });
      queryClient.invalidateQueries({ queryKey: ['grocery-stock', groupId] });
      queryClient.invalidateQueries({ queryKey: ['grocery-summary', groupId] });
      navigate(`/groups/${groupId}/grocery/distributions/${response.data.id}`);
    },
  });

  const addItem = (productId: string) => {
    if (items.find(i => i.productId === productId)) return;
    setItems([...items, { productId, totalQuantity: 0 }]);
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    setItems(items.map(item => 
      item.productId === productId 
        ? { ...item, totalQuantity: quantity }
        : item
    ));
  };

  const removeItem = (productId: string) => {
    setItems(items.filter(i => i.productId !== productId));
  };

  const getStockItem = (productId: string) => {
    return stockData?.stock?.find((s: any) => s.productId === productId);
  };

  const hasInsufficientStock = items.some(item => {
    const stock = getStockItem(item.productId);
    return stock && item.totalQuantity > stock.currentQuantity;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      alert('Please add at least one item to distribute');
      return;
    }

    const validItems = items.filter(i => i.totalQuantity > 0);
    if (validItems.length === 0) {
      alert('Please specify quantities for items');
      return;
    }

    createMutation.mutate({
      eventName,
      eventDate: new Date(eventDate).toISOString(),
      allocationRule,
      notes: notes || undefined,
      items: validItems,
    });
  };

  const memberCount = membersData?.memberCount || 0;

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Distribution</h1>
          <p className="text-gray-600">
            Distribute groceries to group members
          </p>
        </div>
      </div>

      {/* Member Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-blue-600" />
          <div>
            <p className="font-medium text-blue-900">
              {memberCount} Active Members
            </p>
            <p className="text-sm text-blue-700">
              Items will be distributed according to the allocation rule
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Event Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Distribution Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Name
              </label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g., December Monthly Distribution"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Distribution Date
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Allocation Rule
              </label>
              <select
                value={allocationRule}
                onChange={(e) => setAllocationRule(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="EQUAL_SHARE">Equal Share</option>
                <option value="CONTRIBUTION_WEIGHTED">Contribution Weighted</option>
                <option value="CUSTOM">Custom Allocation</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {allocationRule === 'EQUAL_SHARE' && 'Each member receives the same amount'}
                {allocationRule === 'CONTRIBUTION_WEIGHTED' && 'Share based on contribution percentage'}
                {allocationRule === 'CUSTOM' && 'Manually specify each member\'s share'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g., Holiday special distribution"
              />
            </div>
          </div>
        </div>

        {/* Select Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Items to Distribute
          </h2>

          {loadingStock ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : stockData?.stock?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Package className="h-12 w-12 mb-2" />
              <p>No stock available for distribution</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Available Stock */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Available Stock (click to add)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {stockData?.stock
                    ?.filter((s: any) => !items.find(i => i.productId === s.productId) && s.currentQuantity > 0)
                    .map((stock: any) => (
                      <button
                        key={stock.productId}
                        type="button"
                        onClick={() => addItem(stock.productId)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-emerald-100 text-gray-700 hover:text-emerald-700 rounded-full text-sm transition-colors"
                      >
                        {stock.productName} ({stock.currentQuantity} {stock.productUnit})
                      </button>
                    ))}
                </div>
              </div>

              {/* Selected Items */}
              {items.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">
                    Distribution Items
                  </h3>
                  {items.map((item) => {
                    const stock = getStockItem(item.productId);
                    const perMember = memberCount > 0 
                      ? (item.totalQuantity / memberCount).toFixed(2)
                      : '0';
                    const isOverStock = stock && item.totalQuantity > stock.currentQuantity;

                    return (
                      <div
                        key={item.productId}
                        className={`p-4 rounded-lg border ${
                          isOverStock 
                            ? 'border-red-200 bg-red-50' 
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium text-gray-900">
                              {stock?.productName}
                            </span>
                            <span className="text-sm text-gray-500 ml-2">
                              Available: {stock?.currentQuantity} {stock?.productUnit}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.productId)}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500">
                              Total to Distribute
                            </label>
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              max={stock?.currentQuantity}
                              value={item.totalQuantity}
                              onChange={(e) => updateItemQuantity(
                                item.productId, 
                                parseFloat(e.target.value) || 0
                              )}
                              className={`w-full px-3 py-2 border rounded-lg ${
                                isOverStock
                                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                                  : 'border-gray-300 focus:ring-emerald-500 focus:border-emerald-500'
                              }`}
                            />
                          </div>
                          <div className="text-center">
                            <label className="text-xs text-gray-500">Per Member</label>
                            <p className="text-lg font-semibold text-emerald-600">
                              {perMember}
                            </p>
                          </div>
                        </div>
                        {isOverStock && (
                          <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            Exceeds available stock
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary & Submit */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-gray-400" />
              <span className="text-gray-600">Distribution Summary</span>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">
                {items.length} product{items.length !== 1 ? 's' : ''} to {memberCount} members
              </p>
            </div>
          </div>

          {hasInsufficientStock && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Some items exceed available stock. Please adjust quantities.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || items.length === 0 || hasInsufficientStock}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Distribution'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default CreateDistributionPage;

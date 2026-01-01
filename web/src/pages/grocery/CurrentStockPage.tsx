import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groceryApi } from '@/lib/api';
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Plus,
  Minus,
  RefreshCw,
  History,
  Filter
} from 'lucide-react';

type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT';

interface StockItem {
  productId: string;
  productName: string;
  productUnit: string;
  category: string;
  currentQuantity: number;
}

interface StockMovement {
  id: string;
  type: MovementType;
  quantity: number;
  notes: string | null;
  createdAt: string;
  product: { name: string; unit: string };
  purchase?: { id: string };
  distribution?: { id: string; eventName: string };
  createdBy: { name: string };
}

export function CurrentStockPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'stock' | 'movements'>('stock');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);

  const { data: stockData, isLoading: loadingStock } = useQuery({
    queryKey: ['grocery-stock', groupId, categoryFilter],
    queryFn: () => groceryApi.getStock(groupId!, { 
      category: categoryFilter || undefined 
    }).then(res => res.data),
    enabled: !!groupId && view === 'stock',
  });

  const { data: movementsData, isLoading: loadingMovements } = useQuery({
    queryKey: ['grocery-movements', groupId],
    queryFn: () => groceryApi.getStockMovements(groupId!).then(res => res.data),
    enabled: !!groupId && view === 'movements',
  });

  const adjustMutation = useMutation({
    mutationFn: (data: { productId: string; quantity: number; type: MovementType; notes: string }) =>
      groceryApi.createAdjustment(groupId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-stock', groupId] });
      queryClient.invalidateQueries({ queryKey: ['grocery-movements', groupId] });
      setShowAdjustModal(false);
      setSelectedProduct(null);
    },
  });

  const handleAdjust = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const formData = new FormData(e.currentTarget);
    adjustMutation.mutate({
      productId: selectedProduct.productId,
      quantity: parseFloat(formData.get('quantity') as string),
      type: formData.get('type') as MovementType,
      notes: formData.get('notes') as string,
    });
  };

  const lowStockItems = stockData?.stock?.filter(
    (item: StockItem) => item.currentQuantity <= 5
  ) || [];

  const categories = [...new Set(stockData?.stock?.map((s: StockItem) => s.category) || [])];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Current Stock</h1>
          <p className="text-gray-600">View and manage your grocery inventory</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/groups/${groupId}/grocery/purchases/new`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Stock
          </Link>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800">Low Stock Alert</h3>
              <p className="text-sm text-amber-700 mt-1">
                {lowStockItems.length} product{lowStockItems.length > 1 ? 's' : ''} running low:{' '}
                {lowStockItems.map((s: StockItem) => s.productName).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* View Toggle & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('stock')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'stock'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Package className="h-4 w-4 inline mr-2" />
            Current Stock
          </button>
          <button
            onClick={() => setView('movements')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'movements'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <History className="h-4 w-4 inline mr-2" />
            Movement History
          </button>
        </div>

        {view === 'stock' && categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {String(cat).charAt(0) + String(cat).slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Stock Grid */}
      {view === 'stock' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {loadingStock ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : stockData?.stock?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Package className="h-12 w-12 mb-4" />
              <p>No stock available</p>
              <Link
                to={`/groups/${groupId}/grocery/purchases/new`}
                className="mt-2 text-emerald-600 hover:text-emerald-700"
              >
                Record a purchase to add stock
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {stockData?.stock?.map((item: StockItem) => (
                <div
                  key={item.productId}
                  className={`p-4 rounded-lg border ${
                    item.currentQuantity <= 5
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{item.productName}</h3>
                      <p className="text-sm text-gray-500">
                        {item.category.charAt(0) + item.category.slice(1).toLowerCase()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedProduct(item);
                        setShowAdjustModal(true);
                      }}
                      className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                      title="Adjust stock"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold text-gray-900">
                        {item.currentQuantity.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500">{item.productUnit}</p>
                    </div>
                    {item.currentQuantity <= 5 && (
                      <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                        Low Stock
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Movement History */}
      {view === 'movements' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {loadingMovements ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : movementsData?.movements?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <History className="h-12 w-12 mb-4" />
              <p>No stock movements yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {movementsData?.movements?.map((movement: StockMovement) => (
                <div key={movement.id} className="p-4 flex items-center gap-4">
                  <div className={`p-2 rounded-full ${
                    movement.type === 'IN'
                      ? 'bg-green-100 text-green-600'
                      : movement.type === 'OUT'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {movement.type === 'IN' ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : movement.type === 'OUT' ? (
                      <TrendingDown className="h-4 w-4" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {movement.product.name}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        movement.type === 'IN'
                          ? 'bg-green-100 text-green-800'
                          : movement.type === 'OUT'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {movement.type}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {movement.type === 'IN' && movement.purchase && (
                        <span>From purchase</span>
                      )}
                      {movement.type === 'OUT' && movement.distribution && (
                        <span>Distribution: {movement.distribution.eventName}</span>
                      )}
                      {movement.notes && <span> • {movement.notes}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      movement.type === 'IN' ? 'text-green-600' : 
                      movement.type === 'OUT' ? 'text-red-600' : 
                      'text-blue-600'
                    }`}>
                      {movement.type === 'IN' ? '+' : movement.type === 'OUT' ? '-' : ''}
                      {movement.quantity} {movement.product.unit}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(movement.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Adjust Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Adjust Stock: {selectedProduct.productName}
              </h2>
              <p className="text-sm text-gray-500">
                Current: {selectedProduct.currentQuantity} {selectedProduct.productUnit}
              </p>
            </div>
            <form onSubmit={handleAdjust} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adjustment Type
                </label>
                <select
                  name="type"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="IN">Add Stock (IN)</option>
                  <option value="OUT">Remove Stock (OUT)</option>
                  <option value="ADJUSTMENT">Correction (ADJUSTMENT)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity ({selectedProduct.productUnit})
                </label>
                <input
                  type="number"
                  name="quantity"
                  step="0.001"
                  min="0.001"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason / Notes
                </label>
                <textarea
                  name="notes"
                  required
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., Stock count correction, expired items removed"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdjustModal(false);
                    setSelectedProduct(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {adjustMutation.isPending ? 'Saving...' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CurrentStockPage;

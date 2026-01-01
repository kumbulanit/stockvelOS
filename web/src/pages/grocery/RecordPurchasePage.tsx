import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groceryApi } from '@/lib/api';
import { 
  Plus, 
  Trash2, 
  ShoppingCart, 
  Upload,
  ArrowLeft,
  Calculator
} from 'lucide-react';

interface PurchaseItem {
  productId: string;
  productName?: string;
  quantity: number;
  unitCost: number;
}

export function RecordPurchasePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['grocery-products', groupId],
    queryFn: () => groceryApi.getProducts(groupId!, { active: true }).then(res => res.data),
    enabled: !!groupId,
  });

  const { data: summary } = useQuery({
    queryKey: ['grocery-summary', groupId],
    queryFn: () => groceryApi.getSummary(groupId!).then(res => res.data),
    enabled: !!groupId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await groceryApi.createPurchase(groupId!, data);
      // If we have a receipt, upload it
      if (receiptFile && response.data.id) {
        const formData = new FormData();
        formData.append('file', receiptFile);
        formData.append('purchaseId', response.data.id);
        // Note: This would need a file upload endpoint
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-purchases', groupId] });
      queryClient.invalidateQueries({ queryKey: ['grocery-summary', groupId] });
      queryClient.invalidateQueries({ queryKey: ['grocery-stock', groupId] });
      navigate(`/groups/${groupId}/grocery/purchases`);
    },
  });

  const addItem = () => {
    setItems([...items, { productId: '', quantity: 1, unitCost: 0 }]);
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // If product changed, update name for display
    if (field === 'productId') {
      const product = productsData?.products?.find((p: any) => p.id === value);
      if (product) {
        newItems[index].productName = product.name;
      }
    }
    
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalCost = items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost, 
    0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    const validItems = items.filter(
      item => item.productId && item.quantity > 0 && item.unitCost > 0
    );

    if (validItems.length === 0) {
      alert('Please fill in all item details');
      return;
    }

    createMutation.mutate({
      purchaseDate: new Date(purchaseDate).toISOString(),
      notes: notes || undefined,
      items: validItems.map(({ productId, quantity, unitCost }) => ({
        productId,
        quantity,
        unitCost,
      })),
    });
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Record Purchase</h1>
          <p className="text-gray-600">
            Add a bulk grocery purchase to stock
          </p>
        </div>
      </div>

      {/* Balance Info */}
      {summary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-700">Available Pot Balance</p>
              <p className="text-2xl font-bold text-emerald-800">
                R {Number(summary.potBalance || 0).toFixed(2)}
              </p>
            </div>
            {totalCost > 0 && (
              <div className="text-right">
                <p className="text-sm text-gray-600">Remaining after purchase</p>
                <p className={`text-xl font-semibold ${
                  (summary.potBalance || 0) - totalCost >= 0 
                    ? 'text-emerald-700' 
                    : 'text-red-600'
                }`}>
                  R {((summary.potBalance || 0) - totalCost).toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Purchase Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Purchase Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Receipt (optional)
              </label>
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 border-dashed rounded-lg hover:bg-gray-50">
                    <Upload className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {receiptFile ? receiptFile.name : 'Upload receipt'}
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  />
                </label>
                {receiptFile && (
                  <button
                    type="button"
                    onClick={() => setReceiptFile(null)}
                    className="p-2 text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="e.g., Monthly bulk buy from Makro"
            />
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Purchase Items
            </h2>
            <button
              type="button"
              onClick={addItem}
              disabled={loadingProducts}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <ShoppingCart className="h-12 w-12 mb-2" />
              <p>No items added yet</p>
              <button
                type="button"
                onClick={addItem}
                className="mt-2 text-emerald-600 hover:text-emerald-700"
              >
                Add your first item
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-2 text-xs font-medium text-gray-500 uppercase">
                <div className="col-span-5">Product</div>
                <div className="col-span-2">Quantity</div>
                <div className="col-span-2">Unit Cost (R)</div>
                <div className="col-span-2">Line Total</div>
                <div className="col-span-1"></div>
              </div>

              {/* Items */}
              {items.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="md:col-span-5">
                    <label className="md:hidden text-xs text-gray-500 mb-1 block">
                      Product
                    </label>
                    <select
                      value={item.productId}
                      onChange={(e) => updateItem(index, 'productId', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">Select product...</option>
                      {productsData?.products?.map((product: any) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="md:hidden text-xs text-gray-500 mb-1 block">
                      Quantity
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="md:hidden text-xs text-gray-500 mb-1 block">
                      Unit Cost (R)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unitCost}
                      onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center">
                    <label className="md:hidden text-xs text-gray-500 mr-2">
                      Total:
                    </label>
                    <span className="font-medium text-gray-900">
                      R {(item.quantity * item.unitCost).toFixed(2)}
                    </span>
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary & Submit */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-gray-400" />
              <span className="text-gray-600">Total Purchase Cost</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">
              R {totalCost.toFixed(2)}
            </span>
          </div>
          
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
              disabled={createMutation.isPending || items.length === 0}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Recording...' : 'Record Purchase'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default RecordPurchasePage;

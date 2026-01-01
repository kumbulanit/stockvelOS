import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groceryApi } from '@/lib/api';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Package,
  Filter,
  X,
  Check
} from 'lucide-react';

const CATEGORIES = [
  'STAPLES', 'MEAT', 'DAIRY', 'VEGETABLES', 'FRUITS',
  'BEVERAGES', 'TOILETRIES', 'CLEANING', 'VOUCHERS', 'OTHER'
];

interface Product {
  id: string;
  name: string;
  unit: string;
  category: string;
  defaultSize: number | null;
  active: boolean;
}

export function ProductCatalogPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['grocery-products', groupId, search, categoryFilter, showInactive],
    queryFn: () => groceryApi.getProducts(groupId!, {
      search: search || undefined,
      category: categoryFilter || undefined,
      active: showInactive ? undefined : true,
    }).then(res => res.data),
    enabled: !!groupId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => groceryApi.createProduct(groupId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-products', groupId] });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: any }) =>
      groceryApi.updateProduct(groupId!, productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-products', groupId] });
      setIsModalOpen(false);
      setEditingProduct(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (productId: string) => groceryApi.deleteProduct(groupId!, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-products', groupId] });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      unit: formData.get('unit') as string,
      category: formData.get('category') as string,
      defaultSize: formData.get('defaultSize') 
        ? parseFloat(formData.get('defaultSize') as string) 
        : undefined,
    };

    if (editingProduct) {
      updateMutation.mutate({ productId: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const toggleActive = (product: Product) => {
    updateMutation.mutate({
      productId: product.id,
      data: { active: !product.active },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
          <p className="text-gray-600">Manage your grocery product catalog</p>
        </div>
        <button
          onClick={() => {
            setEditingProduct(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="w-48">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0) + cat.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-600">Show inactive</span>
          </label>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : data?.products?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Package className="h-12 w-12 mb-4" />
            <p>No products found</p>
            <p className="text-sm">Add your first product to get started</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data?.products?.map((product: Product) => (
                <tr key={product.id} className={!product.active ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 rounded-lg">
                        <Package className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        {product.defaultSize && (
                          <p className="text-sm text-gray-500">
                            Default: {product.defaultSize} {product.unit}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{product.unit}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                      {product.category.charAt(0) + product.category.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleActive(product)}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        product.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {product.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(product)}
                        className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this product?')) {
                            deleteMutation.mutate(product.id);
                          }
                        }}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingProduct(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingProduct?.name}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., Rice, Cooking Oil"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit
                </label>
                <input
                  type="text"
                  name="unit"
                  defaultValue={editingProduct?.unit}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., kg, litre, packet"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  name="category"
                  defaultValue={editingProduct?.category || 'STAPLES'}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0) + cat.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Size (optional)
                </label>
                <input
                  type="number"
                  name="defaultSize"
                  step="0.001"
                  defaultValue={editingProduct?.defaultSize || ''}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., 2.5"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingProduct
                    ? 'Update'
                    : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductCatalogPage;

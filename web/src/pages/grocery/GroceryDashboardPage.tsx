import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { groceryApi } from '@/lib/api';
import { 
  ShoppingCart, 
  Package, 
  Truck, 
  Users, 
  TrendingUp,
  ArrowRight,
  Plus,
  AlertCircle
} from 'lucide-react';

interface GrocerySummary {
  groupId: string;
  groupName: string;
  currentPotBalance: number;
  totalStockValue: number;
  activeProductCount: number;
  pendingDistributions: number;
  recentPurchases: number;
}

export function GroceryDashboardPage() {
  const { groupId } = useParams<{ groupId: string }>();

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['grocery-summary', groupId],
    queryFn: () => groceryApi.getSummary(groupId!).then(res => res.data),
    enabled: !!groupId,
  });

  const { data: recentStock } = useQuery({
    queryKey: ['grocery-stock', groupId],
    queryFn: () => groceryApi.getStock(groupId!).then(res => res.data),
    enabled: !!groupId,
  });

  const { data: pendingDist } = useQuery({
    queryKey: ['grocery-distributions', groupId, 'ACTIVE'],
    queryFn: () => groceryApi.getDistributions(groupId!, { status: 'ACTIVE' }).then(res => res.data),
    enabled: !!groupId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-red-500">
        <AlertCircle className="h-12 w-12 mb-4" />
        <p>Failed to load grocery data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Grocery Stokvel
          </h1>
          <p className="text-gray-600">{summary?.groupName}</p>
        </div>
        <div className="flex gap-3">
          <Link
            to={`/groups/${groupId}/grocery/purchases/new`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Record Purchase
          </Link>
          <Link
            to={`/groups/${groupId}/grocery/distributions/new`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-emerald-600 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            <Truck className="h-4 w-4" />
            Create Distribution
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pot Balance"
          value={`R ${(summary?.currentPotBalance || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`}
          icon={<TrendingUp className="h-6 w-6" />}
          color="emerald"
        />
        <StatCard
          title="Products in Stock"
          value={summary?.activeProductCount || 0}
          icon={<Package className="h-6 w-6" />}
          color="blue"
        />
        <StatCard
          title="Pending Distributions"
          value={summary?.pendingDistributions || 0}
          icon={<Truck className="h-6 w-6" />}
          color="amber"
        />
        <StatCard
          title="Recent Purchases"
          value={summary?.recentPurchases || 0}
          subtitle="Last 30 days"
          icon={<ShoppingCart className="h-6 w-6" />}
          color="purple"
        />
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Stock */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Current Stock</h2>
            <Link
              to={`/groups/${groupId}/grocery/stock`}
              className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentStock?.slice(0, 5).map((item: any) => (
              <div
                key={item.productId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{item.productName}</p>
                  <p className="text-sm text-gray-500">{item.category}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {item.currentQuantity} {item.unit}
                  </p>
                </div>
              </div>
            ))}
            {(!recentStock || recentStock.length === 0) && (
              <p className="text-center text-gray-500 py-4">No stock items yet</p>
            )}
          </div>
        </div>

        {/* Pending Distributions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Active Distributions</h2>
            <Link
              to={`/groups/${groupId}/grocery/distributions`}
              className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {pendingDist?.distributions?.slice(0, 3).map((dist: any) => (
              <Link
                key={dist.id}
                to={`/groups/${groupId}/grocery/distributions/${dist.id}`}
                className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      Distribution {new Date(dist.distributionDate).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-500">
                      {dist.stats?.confirmedCount || 0}/{dist.stats?.totalItems || 0} items confirmed
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      dist.status === 'ACTIVE' ? 'bg-amber-100 text-amber-800' :
                      dist.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {dist.status}
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </Link>
            ))}
            {(!pendingDist?.distributions || pendingDist.distributions.length === 0) && (
              <p className="text-center text-gray-500 py-4">No active distributions</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickLink
          to={`/groups/${groupId}/grocery/products`}
          icon={<Package className="h-5 w-5" />}
          label="Product Catalog"
        />
        <QuickLink
          to={`/groups/${groupId}/grocery/purchases`}
          icon={<ShoppingCart className="h-5 w-5" />}
          label="All Purchases"
        />
        <QuickLink
          to={`/groups/${groupId}/grocery/stock`}
          icon={<TrendingUp className="h-5 w-5" />}
          label="Stock Levels"
        />
        <QuickLink
          to={`/groups/${groupId}/grocery/fairness`}
          icon={<Users className="h-5 w-5" />}
          label="Fairness Report"
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'emerald' | 'blue' | 'amber' | 'purple';
}) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colors[color]}`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 hover:shadow-sm transition-all"
    >
      <span className="text-emerald-600">{icon}</span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </Link>
  );
}

export default GroceryDashboardPage;

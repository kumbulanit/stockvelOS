import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { groceryApi } from '@/lib/api';
import { 
  Scale, 
  Users, 
  Package,
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Download,
  Filter
} from 'lucide-react';

interface MemberFairness {
  memberId: string;
  memberName: string;
  totalContributed: number;
  totalReceived: number;
  fairnessScore: number;
  distributionsReceived: number;
}

interface ProductDistribution {
  productId: string;
  productName: string;
  totalDistributed: number;
  unit: string;
  distributions: number;
}

export function FairnessReportPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year' | 'all'>('quarter');

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['grocery-fairness', groupId, dateRange],
    queryFn: () => groceryApi.getFairnessReport(groupId!, { range: dateRange }).then(res => res.data),
    enabled: !!groupId,
  });

  const { data: summary } = useQuery({
    queryKey: ['grocery-summary', groupId],
    queryFn: () => groceryApi.getSummary(groupId!).then(res => res.data),
    enabled: !!groupId,
  });

  // Mock data for demonstration - in real app this comes from backend
  const memberStats: MemberFairness[] = reportData?.memberStats || [
    { memberId: '1', memberName: 'John Doe', totalContributed: 1500, totalReceived: 1450, fairnessScore: 97, distributionsReceived: 12 },
    { memberId: '2', memberName: 'Jane Smith', totalContributed: 1500, totalReceived: 1520, fairnessScore: 101, distributionsReceived: 12 },
    { memberId: '3', memberName: 'Bob Wilson', totalContributed: 1200, totalReceived: 1180, fairnessScore: 98, distributionsReceived: 10 },
  ];

  const productStats: ProductDistribution[] = reportData?.productStats || [
    { productId: '1', productName: 'Rice', totalDistributed: 150, unit: 'kg', distributions: 12 },
    { productId: '2', productName: 'Cooking Oil', totalDistributed: 48, unit: 'litre', distributions: 12 },
    { productId: '3', productName: 'Sugar', totalDistributed: 60, unit: 'kg', distributions: 12 },
  ];

  const averageFairness = memberStats.reduce((sum, m) => sum + m.fairnessScore, 0) / memberStats.length || 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fairness Report</h1>
          <p className="text-gray-600">Distribution equity analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="month">Last Month</option>
            <option value="quarter">Last Quarter</option>
            <option value="year">Last Year</option>
            <option value="all">All Time</option>
          </select>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Scale className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Fairness Score</p>
              <p className="text-xl font-bold text-gray-900">
                {averageFairness.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Members</p>
              <p className="text-xl font-bold text-gray-900">
                {summary?.memberCount || memberStats.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Distributions</p>
              <p className="text-xl font-bold text-gray-900">
                {summary?.totalDistributions || 12}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Package className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Products</p>
              <p className="text-xl font-bold text-gray-900">
                {productStats.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fairness Score Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Scale className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">Understanding Fairness Score</h3>
            <p className="text-sm text-blue-700 mt-1">
              A fairness score of 100% means a member received exactly their fair share based on contributions.
              Scores above 100% indicate receiving more than contributed proportion, below 100% means receiving less.
              Minor variations are normal and typically balance out over time.
            </p>
          </div>
        </div>
      </div>

      {/* Member Fairness Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Member Distribution Analysis</h2>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contributed (R)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Received Value (R)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Distributions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fairness Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {memberStats.map((member) => {
                const diff = member.totalReceived - member.totalContributed;
                const isOver = member.fairnessScore > 102;
                const isUnder = member.fairnessScore < 98;
                
                return (
                  <tr key={member.memberId}>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{member.memberName}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      R {member.totalContributed.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      R {member.totalReceived.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {member.distributionsReceived}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              isOver ? 'bg-amber-500' :
                              isUnder ? 'bg-red-500' :
                              'bg-emerald-500'
                            }`}
                            style={{ 
                              width: `${Math.min(100, member.fairnessScore)}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {member.fairnessScore.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {isOver ? (
                          <>
                            <TrendingUp className="h-4 w-4 text-amber-500" />
                            <span className="text-sm text-amber-600">
                              +R{diff.toFixed(2)}
                            </span>
                          </>
                        ) : isUnder ? (
                          <>
                            <TrendingDown className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-red-600">
                              R{diff.toFixed(2)}
                            </span>
                          </>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            Balanced
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Product Distribution Stats */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Product Distribution Summary</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {productStats.map((product) => (
            <div
              key={product.productId}
              className="p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{product.productName}</h3>
                  <p className="text-sm text-gray-500">
                    {product.distributions} distributions
                  </p>
                </div>
                <BarChart3 className="h-5 w-5 text-gray-400" />
              </div>
              <p className="mt-3 text-2xl font-bold text-gray-900">
                {product.totalDistributed} <span className="text-sm font-normal text-gray-500">{product.unit}</span>
              </p>
              <p className="text-sm text-gray-500">
                Avg per distribution: {(product.totalDistributed / product.distributions).toFixed(1)} {product.unit}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Link
          to={`/groups/${groupId}/grocery`}
          className="px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default FairnessReportPage;

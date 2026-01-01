import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth-store';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Dashboard Pages
import DashboardPage from './pages/dashboard/DashboardPage';
import GroupsPage from './pages/groups/GroupsPage';
import GroupDetailPage from './pages/groups/GroupDetailPage';
import CreateGroupPage from './pages/groups/CreateGroupPage';
import ContributionsPage from './pages/contributions/ContributionsPage';
import ContributionReviewPage from './pages/contributions/ContributionReviewPage';
import PayoutsPage from './pages/payouts/PayoutsPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import ProfilePage from './pages/profile/ProfilePage';

// Grocery Pages
import {
  GroceryDashboardPage,
  ProductCatalogPage,
  RecordPurchasePage,
  PurchaseHistoryPage,
  CurrentStockPage,
  CreateDistributionPage,
  DistributionDetailPage,
  FairnessReportPage,
} from './pages/grocery';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        element={
          <PublicRoute>
            <AuthLayout />
          </PublicRoute>
        }
      >
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Protected Routes */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/create" element={<CreateGroupPage />} />
        <Route path="/groups/:groupId" element={<GroupDetailPage />} />
        <Route path="/contributions" element={<ContributionsPage />} />
        <Route path="/contributions/review/:groupId" element={<ContributionReviewPage />} />
        <Route path="/payouts" element={<PayoutsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        {/* Grocery Routes */}
        <Route path="/groups/:groupId/grocery" element={<GroceryDashboardPage />} />
        <Route path="/groups/:groupId/grocery/products" element={<ProductCatalogPage />} />
        <Route path="/groups/:groupId/grocery/purchases" element={<PurchaseHistoryPage />} />
        <Route path="/groups/:groupId/grocery/purchases/new" element={<RecordPurchasePage />} />
        <Route path="/groups/:groupId/grocery/stock" element={<CurrentStockPage />} />
        <Route path="/groups/:groupId/grocery/distributions" element={<GroceryDashboardPage />} />
        <Route path="/groups/:groupId/grocery/distributions/new" element={<CreateDistributionPage />} />
        <Route path="/groups/:groupId/grocery/distributions/:distributionId" element={<DistributionDetailPage />} />
        <Route path="/groups/:groupId/grocery/fairness" element={<FairnessReportPage />} />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;

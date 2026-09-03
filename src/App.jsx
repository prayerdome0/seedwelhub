import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import Spinner from './components/Spinner';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './contexts/AuthContext';

// Layout routes.
import HomePage from './pages/HomePage';
import MarketplacePage from './pages/MarketplacePage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ServicesPage from './pages/ServicesPage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import BusinessesPage from './pages/BusinessesPage';
import BusinessDetailPage from './pages/BusinessDetailPage';
import SearchPage from './pages/SearchPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import SettingsPage from './pages/SettingsPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import OrderTrackingPage from './pages/OrderTrackingPage';
import PaymentsPage from './pages/PaymentsPage';
import PaymentDetailPage from './pages/PaymentDetailPage';
import QuotationsPage from './pages/QuotationsPage';
import QuotationDetailPage from './pages/QuotationDetailPage';
import InvoicesPage from './pages/InvoicesPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import ReceiptsPage from './pages/ReceiptsPage';
import ReceiptDetailPage from './pages/ReceiptDetailPage';
import MessagesPage from './pages/MessagesPage';
import ConversationPage from './pages/ConversationPage';
import GroupsPage from './pages/GroupsPage';
import GroupDetailPage from './pages/GroupDetailPage';
import NotificationsPage from './pages/NotificationsPage';
import VerificationPage from './pages/VerificationPage';
import NotFoundPage from './pages/NotFoundPage';

// Admin (lazy-loaded group).
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminBusinesses = lazy(() => import('./pages/admin/AdminBusinesses'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminVerification = lazy(() => import('./pages/admin/AdminVerification'));
const AdminSecurity = lazy(() => import('./pages/admin/AdminSecurity'));

function PageLoader() {
  return (
    <div className="page">
      <Spinner size="large" />
    </div>
  );
}

// Guards an authenticated-only section.
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Guards the admin section.
function RequireAdmin({ children }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/profile" replace />;
  return children;
}

// Redirects logged-in users away from auth pages.
function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public-only auth screens */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
            <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
          </Route>

          {/* Main app layout */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/service/:id" element={<ServiceDetailPage />} />
            <Route path="/businesses" element={<BusinessesPage />} />
            <Route path="/business/:id" element={<BusinessDetailPage />} />
            <Route path="/store/:id" element={<BusinessDetailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/verify/:code" element={<VerificationPage />} />

            {/* Authenticated */}
            <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
            <Route path="/orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
            <Route path="/order/:id" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
            <Route path="/order/:id/tracking" element={<RequireAuth><OrderTrackingPage /></RequireAuth>} />
            <Route path="/payments" element={<RequireAuth><PaymentsPage /></RequireAuth>} />
            <Route path="/payment/:id" element={<RequireAuth><PaymentDetailPage /></RequireAuth>} />
            <Route path="/quotations" element={<RequireAuth><QuotationsPage /></RequireAuth>} />
            <Route path="/quotation/:id" element={<RequireAuth><QuotationDetailPage /></RequireAuth>} />
            <Route path="/invoices" element={<RequireAuth><InvoicesPage /></RequireAuth>} />
            <Route path="/invoice/:id" element={<RequireAuth><InvoiceDetailPage /></RequireAuth>} />
            <Route path="/receipts" element={<RequireAuth><ReceiptsPage /></RequireAuth>} />
            <Route path="/receipt/:id" element={<RequireAuth><ReceiptDetailPage /></RequireAuth>} />
            <Route path="/messages" element={<RequireAuth><MessagesPage /></RequireAuth>} />
            <Route path="/messages/:id" element={<RequireAuth><ConversationPage /></RequireAuth>} />
            <Route path="/groups" element={<RequireAuth><GroupsPage /></RequireAuth>} />
            <Route path="/group/:id" element={<RequireAuth><GroupDetailPage /></RequireAuth>} />
            <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />

            {/* Admin */}
            <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="businesses" element={<AdminBusinesses />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="verification" element={<AdminVerification />} />
              <Route path="security" element={<AdminSecurity />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

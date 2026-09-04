import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import Spinner from './components/Spinner';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './contexts/AuthContext';

// Page components are lazy-loaded so the initial JavaScript bundle only loads
// the shell + the route the user actually visits. The layouts stay eager because
// they wrap every page.
const HomePage = lazy(() => import('./pages/HomePage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const DealsPage = lazy(() => import('./pages/DealsPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const ServiceDetailPage = lazy(() => import('./pages/ServiceDetailPage'));
const BusinessesPage = lazy(() => import('./pages/BusinessesPage'));
const BusinessDetailPage = lazy(() => import('./pages/BusinessDetailPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const SavedPage = lazy(() => import('./pages/SavedPage'));
const AboutCompanyPage = lazy(() => import('./pages/AboutCompanyPage'));
const AboutServicesPage = lazy(() => import('./pages/AboutServicesPage'));
const RequestQuotationPage = lazy(() => import('./pages/RequestQuotationPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SellerOnboardingPage = lazy(() => import('./pages/SellerOnboardingPage'));
const SellerDashboardPage = lazy(() => import('./pages/SellerDashboardPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const PaymentDetailPage = lazy(() => import('./pages/PaymentDetailPage'));
const QuotationsPage = lazy(() => import('./pages/QuotationsPage'));
const QuotationDetailPage = lazy(() => import('./pages/QuotationDetailPage'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'));
const InvoiceDetailPage = lazy(() => import('./pages/InvoiceDetailPage'));
const ReceiptsPage = lazy(() => import('./pages/ReceiptsPage'));
const ReceiptDetailPage = lazy(() => import('./pages/ReceiptDetailPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const ConversationPage = lazy(() => import('./pages/ConversationPage'));
const GroupsPage = lazy(() => import('./pages/GroupsPage'));
const GroupDetailPage = lazy(() => import('./pages/GroupDetailPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const VerificationPage = lazy(() => import('./pages/VerificationPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

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
const AdminFraud = lazy(() => import('./pages/admin/AdminFraud'));
const AdminUserDossier = lazy(() => import('./pages/admin/AdminUserDossier'));

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
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/promotions" element={<Navigate to="/deals" replace />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/service/:id" element={<ServiceDetailPage />} />
            <Route path="/businesses" element={<BusinessesPage />} />
            <Route path="/business/:id" element={<BusinessDetailPage />} />
            <Route path="/store/:id" element={<BusinessDetailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/verify/:code" element={<VerificationPage />} />
            <Route path="/about/company" element={<AboutCompanyPage />} />
            <Route path="/about/services" element={<AboutServicesPage />} />
            <Route path="/about" element={<Navigate to="/about/company" replace />} />

            {/* Authenticated */}
            <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
            <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
            <Route path="/account/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
            <Route path="/saved" element={<RequireAuth><SavedPage /></RequireAuth>} />
            <Route path="/favorites" element={<Navigate to="/saved" replace />} />
            <Route path="/sell" element={<RequireAuth><SellerOnboardingPage /></RequireAuth>} />
            <Route path="/seller" element={<RequireAuth><SellerDashboardPage /></RequireAuth>} />
            <Route path="/seller/dashboard" element={<Navigate to="/seller" replace />} />
            <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
            <Route path="/orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
            <Route path="/order/:id" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
            <Route path="/order/:id/tracking" element={<RequireAuth><OrderTrackingPage /></RequireAuth>} />
            <Route path="/payments" element={<RequireAuth><PaymentsPage /></RequireAuth>} />
            <Route path="/payment/:id" element={<RequireAuth><PaymentDetailPage /></RequireAuth>} />
            <Route path="/quotations" element={<RequireAuth><QuotationsPage /></RequireAuth>} />
            <Route path="/quotations/request" element={<RequireAuth><RequestQuotationPage /></RequireAuth>} />
            <Route path="/quotation/:id" element={<RequireAuth><QuotationDetailPage /></RequireAuth>} />
            <Route path="/invoices" element={<RequireAuth><InvoicesPage /></RequireAuth>} />
            <Route path="/invoice/:id" element={<RequireAuth><InvoiceDetailPage /></RequireAuth>} />
            <Route path="/receipts" element={<RequireAuth><ReceiptsPage /></RequireAuth>} />
            <Route path="/receipt/:id" element={<RequireAuth><ReceiptDetailPage /></RequireAuth>} />
            <Route path="/messages" element={<RequireAuth><MessagesPage /></RequireAuth>} />
            {/* Group chats are reachable as /group/:id and as the equivalent
                /messages/group/:id deep link. This alias is declared BEFORE
                /messages/:id so "group" is never treated as a conversation id. */}
            <Route path="/messages/group/:id" element={<RequireAuth><GroupDetailPage /></RequireAuth>} />
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
              <Route path="fraud" element={<AdminFraud />} />
              <Route path="users/:uid" element={<AdminUserDossier />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

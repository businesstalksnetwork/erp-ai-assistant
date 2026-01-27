import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { CompanyProvider } from "@/lib/company-context";
import { ThemeProvider } from "@/lib/theme-context";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Clients from "./pages/Clients";
import Invoices from "./pages/Invoices";
import NewInvoice from "./pages/NewInvoice";
import EditInvoice from "./pages/EditInvoice";
import EditTemplate from "./pages/EditTemplate";
import InvoiceDetail from "./pages/InvoiceDetail";
import AdminAnalytics from "./pages/AdminAnalytics";
import InvoiceAnalytics from "./pages/InvoiceAnalytics";
import KPOBook from "./pages/KPOBook";
import FiscalCashRegister from "./pages/FiscalCashRegister";
import Reminders from "./pages/Reminders";
import ServiceCatalog from "./pages/ServiceCatalog";
import Documents from "./pages/Documents";

import BookkeeperSettings from "./pages/BookkeeperSettings";
import AdminPanel from "./pages/AdminPanel";
import Payouts from "./pages/Payouts";
import SEFCenter from "./pages/SEFCenter";
import CompanyProfile from "./pages/CompanyProfile";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Učitavanje...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <CompanyProvider>
      <AppLayout>{children}</AppLayout>
    </CompanyProvider>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();

  const isRecoveryUrl =
    location.hash.includes("type=recovery") ||
    location.hash.includes("access_token") ||
    new URLSearchParams(location.search).get("type") === "recovery";

  // If user opened password-recovery link, force them onto /auth so they can set a new password.
  if (isRecoveryUrl && location.pathname !== "/auth") {
    return <Navigate to={`/auth${location.search}${location.hash}`} replace />;
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Učitavanje...</div>;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          isRecoveryUrl
            ? <Navigate to={`/auth${location.search}${location.hash}`} replace />
            : user
              ? <Navigate to="/dashboard" replace />
              : <Index />
        }
      />
      <Route path="/auth" element={user && !isRecoveryUrl ? <Navigate to="/dashboard" replace /> : <Auth />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/companies" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
      <Route path="/company/:id" element={<ProtectedRoute><CompanyProfile /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
      <Route path="/invoices/new" element={<ProtectedRoute><NewInvoice /></ProtectedRoute>} />
      <Route path="/invoices/:id/edit" element={<ProtectedRoute><EditInvoice /></ProtectedRoute>} />
      <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceDetail /></ProtectedRoute>} />
      <Route path="/templates/:id/edit" element={<ProtectedRoute><EditTemplate /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute adminOnly><AdminAnalytics /></ProtectedRoute>} />
      <Route path="/invoice-analytics" element={<ProtectedRoute><InvoiceAnalytics /></ProtectedRoute>} />
      <Route path="/kpo" element={<ProtectedRoute><KPOBook /></ProtectedRoute>} />
      <Route path="/fiscal" element={<ProtectedRoute><FiscalCashRegister /></ProtectedRoute>} />
      <Route path="/sef" element={<ProtectedRoute><SEFCenter /></ProtectedRoute>} />
      <Route path="/reminders" element={<ProtectedRoute><Reminders /></ProtectedRoute>} />
      <Route path="/services" element={<ProtectedRoute><ServiceCatalog /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
      
      <Route path="/bookkeeper" element={<ProtectedRoute><BookkeeperSettings /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/payouts" element={<ProtectedRoute adminOnly><Payouts /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPanel /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

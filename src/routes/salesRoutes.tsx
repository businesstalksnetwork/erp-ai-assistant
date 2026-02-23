import React from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const SalesHub = React.lazy(() => import("@/pages/tenant/SalesHub"));
const Quotes = React.lazy(() => import("@/pages/tenant/Quotes"));
const QuoteDetail = React.lazy(() => import("@/pages/tenant/QuoteDetail"));
const SalesOrders = React.lazy(() => import("@/pages/tenant/SalesOrders"));
const SalesOrderDetail = React.lazy(() => import("@/pages/tenant/SalesOrderDetail"));
const SalesChannels = React.lazy(() => import("@/pages/tenant/SalesChannels"));
const Salespeople = React.lazy(() => import("@/pages/tenant/Salespeople"));
const SalesPerformance = React.lazy(() => import("@/pages/tenant/SalesPerformance"));
const WebSettings = React.lazy(() => import("@/pages/tenant/WebSettings"));
const WebPrices = React.lazy(() => import("@/pages/tenant/WebPrices"));

export const salesRoutes = (
  <>
    <Route path="sales" element={<ProtectedRoute requiredModule="sales"><SalesHub /></ProtectedRoute>} />
    <Route path="sales/quotes" element={<ProtectedRoute requiredModule="sales"><Quotes /></ProtectedRoute>} />
    <Route path="sales/quotes/:id" element={<ProtectedRoute requiredModule="sales"><QuoteDetail /></ProtectedRoute>} />
    <Route path="sales/sales-orders" element={<ProtectedRoute requiredModule="sales"><SalesOrders /></ProtectedRoute>} />
    <Route path="sales/sales-orders/:id" element={<ProtectedRoute requiredModule="sales"><SalesOrderDetail /></ProtectedRoute>} />
    <Route path="sales/sales-channels" element={<ProtectedRoute requiredModule="sales"><SalesChannels /></ProtectedRoute>} />
    <Route path="sales/salespeople" element={<ProtectedRoute requiredModule="sales"><Salespeople /></ProtectedRoute>} />
    <Route path="sales/sales-performance" element={<ProtectedRoute requiredModule="sales"><SalesPerformance /></ProtectedRoute>} />
    <Route path="sales/web-settings" element={<ProtectedRoute requiredModule="sales"><WebSettings /></ProtectedRoute>} />
    <Route path="sales/web-prices" element={<ProtectedRoute requiredModule="sales"><WebPrices /></ProtectedRoute>} />
  </>
);

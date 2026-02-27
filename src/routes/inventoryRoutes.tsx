import React from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";

const InventoryHub = React.lazy(() => import("@/pages/tenant/InventoryHub"));
const Products = React.lazy(() => import("@/pages/tenant/Products"));
const ProductCategories = React.lazy(() => import("@/pages/tenant/ProductCategories"));
const ProductDetail = React.lazy(() => import("@/pages/tenant/ProductDetail"));
const InventoryStock = React.lazy(() => import("@/pages/tenant/InventoryStock"));
const InventoryMovements = React.lazy(() => import("@/pages/tenant/InventoryMovements"));
const InventoryCostLayers = React.lazy(() => import("@/pages/tenant/InventoryCostLayers"));
const Eotpremnica = React.lazy(() => import("@/pages/tenant/Eotpremnica"));
const DispatchNoteDetail = React.lazy(() => import("@/pages/tenant/DispatchNoteDetail"));
const InternalOrders = React.lazy(() => import("@/pages/tenant/InternalOrders"));
const InternalTransfers = React.lazy(() => import("@/pages/tenant/InternalTransfers"));
const InternalGoodsReceipts = React.lazy(() => import("@/pages/tenant/InternalGoodsReceipts"));
const Kalkulacija = React.lazy(() => import("@/pages/tenant/Kalkulacija"));
const Nivelacija = React.lazy(() => import("@/pages/tenant/Nivelacija"));
const RetailPrices = React.lazy(() => import("@/pages/tenant/RetailPrices"));
const PricingCenter = React.lazy(() => import("@/pages/tenant/PricingCenter"));
const WarehouseDetail = React.lazy(() => import("@/pages/tenant/WarehouseDetail"));
const WmsDashboard = React.lazy(() => import("@/pages/tenant/WmsDashboard"));
const WmsZones = React.lazy(() => import("@/pages/tenant/WmsZones"));
const WmsBinDetail = React.lazy(() => import("@/pages/tenant/WmsBinDetail"));
const WmsTasks = React.lazy(() => import("@/pages/tenant/WmsTasks"));
const WmsReceiving = React.lazy(() => import("@/pages/tenant/WmsReceiving"));
const WmsPicking = React.lazy(() => import("@/pages/tenant/WmsPicking"));
const WmsCycleCounts = React.lazy(() => import("@/pages/tenant/WmsCycleCounts"));
const WmsSlotting = React.lazy(() => import("@/pages/tenant/WmsSlotting"));
const WmsLabor = React.lazy(() => import("@/pages/tenant/WmsLabor"));
const WmsReturns = React.lazy(() => import("@/pages/tenant/WmsReturns"));

const m = "inventory";
const B = PageErrorBoundary;

export const inventoryRoutes = (
  <>
    <Route path="inventory" element={<ProtectedRoute requiredModule={m}><B><InventoryHub /></B></ProtectedRoute>} />
    <Route path="inventory/products" element={<ProtectedRoute requiredModule={m}><B><Products /></B></ProtectedRoute>} />
    <Route path="inventory/product-categories" element={<ProtectedRoute requiredModule={m}><B><ProductCategories /></B></ProtectedRoute>} />
    <Route path="inventory/products/:id" element={<ProtectedRoute requiredModule={m}><B><ProductDetail /></B></ProtectedRoute>} />
    <Route path="inventory/stock" element={<ProtectedRoute requiredModule={m}><B><InventoryStock /></B></ProtectedRoute>} />
    <Route path="inventory/movements" element={<ProtectedRoute requiredModule={m}><B><InventoryMovements /></B></ProtectedRoute>} />
    <Route path="inventory/cost-layers" element={<ProtectedRoute requiredModule={m}><B><InventoryCostLayers /></B></ProtectedRoute>} />
    <Route path="inventory/dispatch-notes" element={<ProtectedRoute requiredModule={m}><B><Eotpremnica /></B></ProtectedRoute>} />
    <Route path="inventory/dispatch-notes/:id" element={<ProtectedRoute requiredModule={m}><B><DispatchNoteDetail /></B></ProtectedRoute>} />
    <Route path="inventory/internal-orders" element={<ProtectedRoute requiredModule={m}><B><InternalOrders /></B></ProtectedRoute>} />
    <Route path="inventory/internal-transfers" element={<ProtectedRoute requiredModule={m}><B><InternalTransfers /></B></ProtectedRoute>} />
    <Route path="inventory/internal-receipts" element={<ProtectedRoute requiredModule={m}><B><InternalGoodsReceipts /></B></ProtectedRoute>} />
    <Route path="inventory/kalkulacija" element={<ProtectedRoute requiredModule={m}><B><Kalkulacija /></B></ProtectedRoute>} />
    <Route path="inventory/nivelacija" element={<ProtectedRoute requiredModule={m}><B><Nivelacija /></B></ProtectedRoute>} />
    <Route path="inventory/retail-prices" element={<ProtectedRoute requiredModule={m}><B><RetailPrices /></B></ProtectedRoute>} />
    <Route path="inventory/pricing-center" element={<ProtectedRoute requiredModule={m}><B><PricingCenter /></B></ProtectedRoute>} />
    <Route path="inventory/warehouses/:id" element={<ProtectedRoute requiredModule={m}><B><WarehouseDetail /></B></ProtectedRoute>} />
    <Route path="inventory/wms/dashboard" element={<ProtectedRoute requiredModule={m}><B><WmsDashboard /></B></ProtectedRoute>} />
    <Route path="inventory/wms/zones" element={<ProtectedRoute requiredModule={m}><B><WmsZones /></B></ProtectedRoute>} />
    <Route path="inventory/wms/bins/:id" element={<ProtectedRoute requiredModule={m}><B><WmsBinDetail /></B></ProtectedRoute>} />
    <Route path="inventory/wms/tasks" element={<ProtectedRoute requiredModule={m}><B><WmsTasks /></B></ProtectedRoute>} />
    <Route path="inventory/wms/receiving" element={<ProtectedRoute requiredModule={m}><B><WmsReceiving /></B></ProtectedRoute>} />
    <Route path="inventory/wms/picking" element={<ProtectedRoute requiredModule={m}><B><WmsPicking /></B></ProtectedRoute>} />
    <Route path="inventory/wms/cycle-counts" element={<ProtectedRoute requiredModule={m}><B><WmsCycleCounts /></B></ProtectedRoute>} />
    <Route path="inventory/wms/slotting" element={<ProtectedRoute requiredModule={m}><B><WmsSlotting /></B></ProtectedRoute>} />
    <Route path="inventory/wms/labor" element={<ProtectedRoute requiredModule={m}><B><WmsLabor /></B></ProtectedRoute>} />
    <Route path="inventory/wms/returns" element={<ProtectedRoute requiredModule={m}><B><WmsReturns /></B></ProtectedRoute>} />
  </>
);

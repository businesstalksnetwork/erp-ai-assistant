import React from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const InventoryHub = React.lazy(() => import("@/pages/tenant/InventoryHub"));
const Products = React.lazy(() => import("@/pages/tenant/Products"));
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

export const inventoryRoutes = (
  <>
    <Route path="inventory" element={<ProtectedRoute requiredModule={m}><InventoryHub /></ProtectedRoute>} />
    <Route path="inventory/products" element={<ProtectedRoute requiredModule={m}><Products /></ProtectedRoute>} />
    <Route path="inventory/products/:id" element={<ProtectedRoute requiredModule={m}><ProductDetail /></ProtectedRoute>} />
    <Route path="inventory/stock" element={<ProtectedRoute requiredModule={m}><InventoryStock /></ProtectedRoute>} />
    <Route path="inventory/movements" element={<ProtectedRoute requiredModule={m}><InventoryMovements /></ProtectedRoute>} />
    <Route path="inventory/cost-layers" element={<ProtectedRoute requiredModule={m}><InventoryCostLayers /></ProtectedRoute>} />
    <Route path="inventory/dispatch-notes" element={<ProtectedRoute requiredModule={m}><Eotpremnica /></ProtectedRoute>} />
    <Route path="inventory/dispatch-notes/:id" element={<ProtectedRoute requiredModule={m}><DispatchNoteDetail /></ProtectedRoute>} />
    <Route path="inventory/internal-orders" element={<ProtectedRoute requiredModule={m}><InternalOrders /></ProtectedRoute>} />
    <Route path="inventory/internal-transfers" element={<ProtectedRoute requiredModule={m}><InternalTransfers /></ProtectedRoute>} />
    <Route path="inventory/internal-receipts" element={<ProtectedRoute requiredModule={m}><InternalGoodsReceipts /></ProtectedRoute>} />
    <Route path="inventory/kalkulacija" element={<ProtectedRoute requiredModule={m}><Kalkulacija /></ProtectedRoute>} />
    <Route path="inventory/nivelacija" element={<ProtectedRoute requiredModule={m}><Nivelacija /></ProtectedRoute>} />
    <Route path="inventory/retail-prices" element={<ProtectedRoute requiredModule={m}><RetailPrices /></ProtectedRoute>} />
    <Route path="inventory/warehouses/:id" element={<ProtectedRoute requiredModule={m}><WarehouseDetail /></ProtectedRoute>} />
    <Route path="inventory/wms/dashboard" element={<ProtectedRoute requiredModule={m}><WmsDashboard /></ProtectedRoute>} />
    <Route path="inventory/wms/zones" element={<ProtectedRoute requiredModule={m}><WmsZones /></ProtectedRoute>} />
    <Route path="inventory/wms/bins/:id" element={<ProtectedRoute requiredModule={m}><WmsBinDetail /></ProtectedRoute>} />
    <Route path="inventory/wms/tasks" element={<ProtectedRoute requiredModule={m}><WmsTasks /></ProtectedRoute>} />
    <Route path="inventory/wms/receiving" element={<ProtectedRoute requiredModule={m}><WmsReceiving /></ProtectedRoute>} />
    <Route path="inventory/wms/picking" element={<ProtectedRoute requiredModule={m}><WmsPicking /></ProtectedRoute>} />
    <Route path="inventory/wms/cycle-counts" element={<ProtectedRoute requiredModule={m}><WmsCycleCounts /></ProtectedRoute>} />
    <Route path="inventory/wms/slotting" element={<ProtectedRoute requiredModule={m}><WmsSlotting /></ProtectedRoute>} />
    <Route path="inventory/wms/labor" element={<ProtectedRoute requiredModule={m}><WmsLabor /></ProtectedRoute>} />
    <Route path="inventory/wms/returns" element={<ProtectedRoute requiredModule={m}><WmsReturns /></ProtectedRoute>} />
  </>
);

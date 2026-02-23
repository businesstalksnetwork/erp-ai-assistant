import React from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const CrmDashboard = React.lazy(() => import("@/pages/tenant/CrmDashboard"));
const Partners = React.lazy(() => import("@/pages/tenant/Partners"));
const Companies = React.lazy(() => import("@/pages/tenant/Companies"));
const CompanyDetail = React.lazy(() => import("@/pages/tenant/CompanyDetail"));
const Contacts = React.lazy(() => import("@/pages/tenant/Contacts"));
const ContactDetail = React.lazy(() => import("@/pages/tenant/ContactDetail"));
const Leads = React.lazy(() => import("@/pages/tenant/Leads"));
const Opportunities = React.lazy(() => import("@/pages/tenant/Opportunities"));
const OpportunityDetail = React.lazy(() => import("@/pages/tenant/OpportunityDetail"));
const Meetings = React.lazy(() => import("@/pages/tenant/Meetings"));
const MeetingsCalendar = React.lazy(() => import("@/pages/tenant/MeetingsCalendar"));

export const crmRoutes = (
  <>
    <Route path="crm" element={<ProtectedRoute requiredModule="crm"><CrmDashboard /></ProtectedRoute>} />
    <Route path="crm/partners" element={<ProtectedRoute requiredModule="crm"><Partners /></ProtectedRoute>} />
    <Route path="crm/companies" element={<ProtectedRoute requiredModule="crm"><Companies /></ProtectedRoute>} />
    <Route path="crm/companies/:id" element={<ProtectedRoute requiredModule="crm"><CompanyDetail /></ProtectedRoute>} />
    <Route path="crm/contacts" element={<ProtectedRoute requiredModule="crm"><Contacts /></ProtectedRoute>} />
    <Route path="crm/contacts/:id" element={<ProtectedRoute requiredModule="crm"><ContactDetail /></ProtectedRoute>} />
    <Route path="crm/leads" element={<ProtectedRoute requiredModule="crm"><Leads /></ProtectedRoute>} />
    <Route path="crm/opportunities" element={<ProtectedRoute requiredModule="crm"><Opportunities /></ProtectedRoute>} />
    <Route path="crm/opportunities/:id" element={<ProtectedRoute requiredModule="crm"><OpportunityDetail /></ProtectedRoute>} />
    <Route path="crm/meetings" element={<ProtectedRoute requiredModule="crm"><Meetings /></ProtectedRoute>} />
    <Route path="crm/meetings/calendar" element={<ProtectedRoute requiredModule="crm"><MeetingsCalendar /></ProtectedRoute>} />
  </>
);

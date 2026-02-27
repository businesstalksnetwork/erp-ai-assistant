import React from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";

const CrmDashboard = React.lazy(() => import("@/pages/tenant/CrmDashboard"));
const Companies = React.lazy(() => import("@/pages/tenant/Companies"));
const CompanyDetail = React.lazy(() => import("@/pages/tenant/CompanyDetail"));
const Contacts = React.lazy(() => import("@/pages/tenant/Contacts"));
const ContactDetail = React.lazy(() => import("@/pages/tenant/ContactDetail"));
const Leads = React.lazy(() => import("@/pages/tenant/Leads"));
const Opportunities = React.lazy(() => import("@/pages/tenant/Opportunities"));
const OpportunityDetail = React.lazy(() => import("@/pages/tenant/OpportunityDetail"));
const Meetings = React.lazy(() => import("@/pages/tenant/Meetings"));
const MeetingsCalendar = React.lazy(() => import("@/pages/tenant/MeetingsCalendar"));

const B = PageErrorBoundary;

export const crmRoutes = (
  <>
    <Route path="crm" element={<ProtectedRoute requiredModule="crm"><B><CrmDashboard /></B></ProtectedRoute>} />
    <Route path="crm/companies" element={<ProtectedRoute requiredModule="crm"><B><Companies /></B></ProtectedRoute>} />
    <Route path="crm/companies/:id" element={<ProtectedRoute requiredModule="crm"><B><CompanyDetail /></B></ProtectedRoute>} />
    <Route path="crm/contacts" element={<ProtectedRoute requiredModule="crm"><B><Contacts /></B></ProtectedRoute>} />
    <Route path="crm/contacts/:id" element={<ProtectedRoute requiredModule="crm"><B><ContactDetail /></B></ProtectedRoute>} />
    <Route path="crm/leads" element={<ProtectedRoute requiredModule="crm"><B><Leads /></B></ProtectedRoute>} />
    <Route path="crm/opportunities" element={<ProtectedRoute requiredModule="crm"><B><Opportunities /></B></ProtectedRoute>} />
    <Route path="crm/opportunities/:id" element={<ProtectedRoute requiredModule="crm"><B><OpportunityDetail /></B></ProtectedRoute>} />
    <Route path="crm/meetings" element={<ProtectedRoute requiredModule="crm"><B><Meetings /></B></ProtectedRoute>} />
    <Route path="crm/meetings/calendar" element={<ProtectedRoute requiredModule="crm"><B><MeetingsCalendar /></B></ProtectedRoute>} />
  </>
);

import React from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const HrHub = React.lazy(() => import("@/pages/tenant/HrHub"));
const Employees = React.lazy(() => import("@/pages/tenant/Employees"));
const EmployeeDetail = React.lazy(() => import("@/pages/tenant/EmployeeDetail"));
const EmployeeContracts = React.lazy(() => import("@/pages/tenant/EmployeeContracts"));
const Departments = React.lazy(() => import("@/pages/tenant/Departments"));
const Attendance = React.lazy(() => import("@/pages/tenant/Attendance"));
const LeaveRequests = React.lazy(() => import("@/pages/tenant/LeaveRequests"));
const Payroll = React.lazy(() => import("@/pages/tenant/Payroll"));
const WorkLogs = React.lazy(() => import("@/pages/tenant/WorkLogs"));
const WorkLogsBulkEntry = React.lazy(() => import("@/pages/tenant/WorkLogsBulkEntry"));
const WorkLogsCalendar = React.lazy(() => import("@/pages/tenant/WorkLogsCalendar"));
const OvertimeHours = React.lazy(() => import("@/pages/tenant/OvertimeHours"));
const NightWork = React.lazy(() => import("@/pages/tenant/NightWork"));
const AnnualLeaveBalances = React.lazy(() => import("@/pages/tenant/AnnualLeaveBalances"));
const HolidaysPage = React.lazy(() => import("@/pages/tenant/Holidays"));
const Deductions = React.lazy(() => import("@/pages/tenant/Deductions"));
const Allowances = React.lazy(() => import("@/pages/tenant/Allowances"));
const ExternalWorkers = React.lazy(() => import("@/pages/tenant/ExternalWorkers"));
const EmployeeSalaries = React.lazy(() => import("@/pages/tenant/EmployeeSalaries"));
const InsuranceRecords = React.lazy(() => import("@/pages/tenant/InsuranceRecords"));
const PositionTemplates = React.lazy(() => import("@/pages/tenant/PositionTemplates"));
const HrReports = React.lazy(() => import("@/pages/tenant/HrReports"));
const EBolovanje = React.lazy(() => import("@/pages/tenant/EBolovanje"));

const m = "hr";

export const hrRoutes = (
  <>
    <Route path="hr" element={<ProtectedRoute requiredModule={m}><HrHub /></ProtectedRoute>} />
    <Route path="hr/employees" element={<ProtectedRoute requiredModule={m}><Employees /></ProtectedRoute>} />
    <Route path="hr/employees/:id" element={<ProtectedRoute requiredModule={m}><EmployeeDetail /></ProtectedRoute>} />
    <Route path="hr/contracts" element={<ProtectedRoute requiredModule={m}><EmployeeContracts /></ProtectedRoute>} />
    <Route path="hr/departments" element={<ProtectedRoute requiredModule={m}><Departments /></ProtectedRoute>} />
    <Route path="hr/attendance" element={<ProtectedRoute requiredModule={m}><Attendance /></ProtectedRoute>} />
    <Route path="hr/leave-requests" element={<ProtectedRoute requiredModule={m}><LeaveRequests /></ProtectedRoute>} />
    <Route path="hr/payroll" element={<ProtectedRoute requiredModule={m}><Payroll /></ProtectedRoute>} />
    <Route path="hr/work-logs" element={<ProtectedRoute requiredModule={m}><WorkLogs /></ProtectedRoute>} />
    <Route path="hr/work-logs/bulk" element={<ProtectedRoute requiredModule={m}><WorkLogsBulkEntry /></ProtectedRoute>} />
    <Route path="hr/work-logs/calendar" element={<ProtectedRoute requiredModule={m}><WorkLogsCalendar /></ProtectedRoute>} />
    <Route path="hr/overtime" element={<ProtectedRoute requiredModule={m}><OvertimeHours /></ProtectedRoute>} />
    <Route path="hr/night-work" element={<ProtectedRoute requiredModule={m}><NightWork /></ProtectedRoute>} />
    <Route path="hr/annual-leave" element={<ProtectedRoute requiredModule={m}><AnnualLeaveBalances /></ProtectedRoute>} />
    <Route path="hr/holidays" element={<ProtectedRoute requiredModule={m}><HolidaysPage /></ProtectedRoute>} />
    <Route path="hr/deductions" element={<ProtectedRoute requiredModule={m}><Deductions /></ProtectedRoute>} />
    <Route path="hr/allowances" element={<ProtectedRoute requiredModule={m}><Allowances /></ProtectedRoute>} />
    <Route path="hr/external-workers" element={<ProtectedRoute requiredModule={m}><ExternalWorkers /></ProtectedRoute>} />
    <Route path="hr/salaries" element={<ProtectedRoute requiredModule={m}><EmployeeSalaries /></ProtectedRoute>} />
    <Route path="hr/insurance" element={<ProtectedRoute requiredModule={m}><InsuranceRecords /></ProtectedRoute>} />
    <Route path="hr/position-templates" element={<ProtectedRoute requiredModule={m}><PositionTemplates /></ProtectedRoute>} />
    <Route path="hr/reports" element={<ProtectedRoute requiredModule={m}><HrReports /></ProtectedRoute>} />
    <Route path="hr/ebolovanje" element={<ProtectedRoute requiredModule={m}><EBolovanje /></ProtectedRoute>} />
  </>
);

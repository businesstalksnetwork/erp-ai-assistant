import React from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageErrorBoundary } from "@/components/shared/PageErrorBoundary";

const HrHub = React.lazy(() => import("@/pages/tenant/HrHub"));
const Employees = React.lazy(() => import("@/pages/tenant/Employees"));
const EmployeeDetail = React.lazy(() => import("@/pages/tenant/EmployeeDetail"));
const EmployeeContracts = React.lazy(() => import("@/pages/tenant/EmployeeContracts"));
const Departments = React.lazy(() => import("@/pages/tenant/Departments"));
const Attendance = React.lazy(() => import("@/pages/tenant/Attendance"));
const LeaveRequests = React.lazy(() => import("@/pages/tenant/LeaveRequests"));
const Payroll = React.lazy(() => import("@/pages/tenant/Payroll"));
const WorkLogs = React.lazy(() => import("@/pages/tenant/WorkLogs"));
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
const PayrollCategories = React.lazy(() => import("@/pages/tenant/PayrollCategories"));
const PayrollPaymentTypes = React.lazy(() => import("@/pages/tenant/PayrollPaymentTypes"));
const PayrollRunDetail = React.lazy(() => import("@/pages/tenant/PayrollRunDetail"));
const NonEmploymentIncome = React.lazy(() => import("@/pages/tenant/NonEmploymentIncome"));
const PppdReview = React.lazy(() => import("@/pages/tenant/PppdReview"));
const TravelOrders = React.lazy(() => import("@/pages/tenant/TravelOrders"));
const TravelOrderForm = React.lazy(() => import("@/pages/tenant/TravelOrderForm"));
const EmployeeDataExport = React.lazy(() => import("@/pages/tenant/reports/EmployeeDataExport"));
const OnboardingChecklists = React.lazy(() => import("@/pages/tenant/OnboardingChecklists"));
const PayrollBankReconciliation = React.lazy(() => import("@/pages/tenant/PayrollBankReconciliation"));
const SpecialHours = React.lazy(() => import("@/pages/tenant/SpecialHours"));
const Otpremnina = React.lazy(() => import("@/pages/tenant/Otpremnina"));
const LeavePolicies = React.lazy(() => import("@/pages/tenant/LeavePolicies"));
const LeaveAnalytics = React.lazy(() => import("@/pages/tenant/reports/LeaveAnalytics"));
const EmployeeDashboard = React.lazy(() => import("@/pages/tenant/EmployeeDashboard"));
const MyPayslips = React.lazy(() => import("@/pages/tenant/MyPayslips"));
const MyLeaves = React.lazy(() => import("@/pages/tenant/MyLeaves"));
const MyAttendance = React.lazy(() => import("@/pages/tenant/MyAttendance"));

const m = "hr";
const B = PageErrorBoundary;

export const hrRoutes = (
  <>
    <Route path="hr" element={<ProtectedRoute requiredModule={m}><B><HrHub /></B></ProtectedRoute>} />
    <Route path="hr/employees" element={<ProtectedRoute requiredModule={m}><B><Employees /></B></ProtectedRoute>} />
    <Route path="hr/employees/:id" element={<ProtectedRoute requiredModule={m}><B><EmployeeDetail /></B></ProtectedRoute>} />
    <Route path="hr/contracts" element={<ProtectedRoute requiredModule={m}><B><EmployeeContracts /></B></ProtectedRoute>} />
    <Route path="hr/departments" element={<ProtectedRoute requiredModule={m}><B><Departments /></B></ProtectedRoute>} />
    <Route path="hr/attendance" element={<ProtectedRoute requiredModule={m}><B><Attendance /></B></ProtectedRoute>} />
    <Route path="hr/leave-requests" element={<ProtectedRoute requiredModule={m}><B><LeaveRequests /></B></ProtectedRoute>} />
    <Route path="hr/payroll" element={<ProtectedRoute requiredModule={m}><B><Payroll /></B></ProtectedRoute>} />
    <Route path="hr/payroll/categories" element={<ProtectedRoute requiredModule={m}><B><PayrollCategories /></B></ProtectedRoute>} />
    <Route path="hr/payroll/payment-types" element={<ProtectedRoute requiredModule={m}><B><PayrollPaymentTypes /></B></ProtectedRoute>} />
    <Route path="hr/payroll/pppd" element={<ProtectedRoute requiredModule={m}><B><PppdReview /></B></ProtectedRoute>} />
    <Route path="hr/payroll/:id" element={<ProtectedRoute requiredModule={m}><B><PayrollRunDetail /></B></ProtectedRoute>} />
    <Route path="hr/work-logs" element={<ProtectedRoute requiredModule={m}><B><WorkLogs /></B></ProtectedRoute>} />
    <Route path="hr/special-hours" element={<ProtectedRoute requiredModule={m}><B><SpecialHours /></B></ProtectedRoute>} />
    <Route path="hr/overtime" element={<ProtectedRoute requiredModule={m}><B><OvertimeHours /></B></ProtectedRoute>} />
    <Route path="hr/night-work" element={<ProtectedRoute requiredModule={m}><B><NightWork /></B></ProtectedRoute>} />
    <Route path="hr/annual-leave" element={<ProtectedRoute requiredModule={m}><B><AnnualLeaveBalances /></B></ProtectedRoute>} />
    <Route path="hr/holidays" element={<ProtectedRoute requiredModule={m}><B><HolidaysPage /></B></ProtectedRoute>} />
    <Route path="hr/deductions" element={<ProtectedRoute requiredModule={m}><B><Deductions /></B></ProtectedRoute>} />
    <Route path="hr/allowances" element={<ProtectedRoute requiredModule={m}><B><Allowances /></B></ProtectedRoute>} />
    <Route path="hr/external-workers" element={<ProtectedRoute requiredModule={m}><B><ExternalWorkers /></B></ProtectedRoute>} />
    <Route path="hr/salaries" element={<ProtectedRoute requiredModule={m}><B><EmployeeSalaries /></B></ProtectedRoute>} />
    <Route path="hr/insurance" element={<ProtectedRoute requiredModule={m}><B><InsuranceRecords /></B></ProtectedRoute>} />
    <Route path="hr/position-templates" element={<ProtectedRoute requiredModule={m}><B><PositionTemplates /></B></ProtectedRoute>} />
    <Route path="hr/reports" element={<ProtectedRoute requiredModule={m}><B><HrReports /></B></ProtectedRoute>} />
    <Route path="hr/ebolovanje" element={<ProtectedRoute requiredModule={m}><B><EBolovanje /></B></ProtectedRoute>} />
    <Route path="hr/non-employment-income" element={<ProtectedRoute requiredModule={m}><B><NonEmploymentIncome /></B></ProtectedRoute>} />
    <Route path="hr/travel-orders" element={<ProtectedRoute requiredModule={m}><B><TravelOrders /></B></ProtectedRoute>} />
    <Route path="hr/travel-orders/new" element={<ProtectedRoute requiredModule={m}><B><TravelOrderForm /></B></ProtectedRoute>} />
    <Route path="hr/travel-orders/:id" element={<ProtectedRoute requiredModule={m}><B><TravelOrderForm /></B></ProtectedRoute>} />
    <Route path="hr/employee-data-export" element={<ProtectedRoute requiredModule={m}><B><EmployeeDataExport /></B></ProtectedRoute>} />
    <Route path="hr/onboarding-checklists" element={<ProtectedRoute requiredModule={m}><B><OnboardingChecklists /></B></ProtectedRoute>} />
    <Route path="hr/payroll/bank-reconciliation" element={<ProtectedRoute requiredModule={m}><B><PayrollBankReconciliation /></B></ProtectedRoute>} />
    <Route path="hr/severance" element={<ProtectedRoute requiredModule={m}><B><Otpremnina /></B></ProtectedRoute>} />
    <Route path="hr/leave-policies" element={<ProtectedRoute requiredModule={m}><B><LeavePolicies /></B></ProtectedRoute>} />
    <Route path="hr/leave-analytics" element={<ProtectedRoute requiredModule={m}><B><LeaveAnalytics /></B></ProtectedRoute>} />
    <Route path="hr/my-dashboard" element={<ProtectedRoute requiredModule={m}><B><EmployeeDashboard /></B></ProtectedRoute>} />
    <Route path="hr/my-payslips" element={<ProtectedRoute requiredModule={m}><B><MyPayslips /></B></ProtectedRoute>} />
    <Route path="hr/my-leaves" element={<ProtectedRoute requiredModule={m}><B><MyLeaves /></B></ProtectedRoute>} />
    <Route path="hr/my-attendance" element={<ProtectedRoute requiredModule={m}><B><MyAttendance /></B></ProtectedRoute>} />
  </>
);

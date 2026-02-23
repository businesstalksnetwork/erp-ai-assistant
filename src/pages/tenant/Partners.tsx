import { Navigate } from "react-router-dom";

// Partners page now redirects to unified CRM companies (partners) page
export default function Partners() {
  return <Navigate to="/crm/companies" replace />;
}

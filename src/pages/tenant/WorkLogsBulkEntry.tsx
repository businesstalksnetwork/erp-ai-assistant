import { Navigate } from "react-router-dom";
export default function WorkLogsBulkEntry() {
  return <Navigate to="/hr/work-logs?tab=bulk" replace />;
}

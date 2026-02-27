import { Navigate } from "react-router-dom";
export default function DocumentBrowser() {
  return <Navigate to="/documents?tab=browser" replace />;
}

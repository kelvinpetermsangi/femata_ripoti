import { Navigate } from "react-router-dom";

type DashboardPageMode = "cases" | "analytics" | "access";

const resolveTarget = (mode: DashboardPageMode) => {
  if (mode === "analytics") return "/dashboard/analytics";
  if (mode === "access") return "/dashboard/access";
  return "/dashboard/cases";
};

const DashboardPage = ({ mode = "cases" }: { mode?: DashboardPageMode }) => (
  <Navigate replace to={resolveTarget(mode)} />
);

export default DashboardPage;

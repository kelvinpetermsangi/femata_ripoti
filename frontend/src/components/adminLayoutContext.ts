import { useOutletContext } from "react-router-dom";
import type { AdminLayoutContext } from "./AdminLayout";

export const useAdminLayoutContext = () => useOutletContext<AdminLayoutContext>();
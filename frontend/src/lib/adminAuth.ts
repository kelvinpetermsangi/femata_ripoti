import { API_BASE } from "./apiBase";
import { collectClientContext, type ClientContext } from "./clientContext";

export type AdminPermission = "view_reports" | "update_reports" | "manage_users" | "view_analytics" | "use_messages" | "manage_notifications";
export type AdminRole = "super_admin" | "case_manager" | "reviewer" | "analyst";

export type AdminUser = {
  user_id: string;
  username: string;
  display_name: string | null;
  full_name?: string | null;
  email: string | null;
  mobile_number: string | null;
  roles: AdminRole[];
  permissions: AdminPermission[];
  assigned_desks: string[];
  assigned_regions: string[];
  assigned_municipalities?: string[];
  assigned_zones?: string[];
  coverage_assignments?: Array<{
    desk: string;
    region: string;
    municipality?: string | null;
    zone?: string | null;
  }>;
  profile_image_url: string | null;
  profile_image_filename?: string | null;
  signature_image_url?: string | null;
  signature_image_filename?: string | null;
  organization_logo_url?: string | null;
  organization_logo_filename?: string | null;
  role_title?: string | null;
  reporting_line?: string | null;
  organization_name?: string | null;
  organization_address?: string | null;
  organization_email?: string | null;
  organization_phone?: string | null;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

export type AdminSession = {
  authenticated: true;
  username: string;
  display_name?: string | null;
  roles: AdminRole[];
  permissions: AdminPermission[];
  user: AdminUser;
  session_context?: {
    approximate_location_label: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    timezone: string | null;
    device_type: string | null;
    source: string | null;
  } | null;
  expires_at: string;
  idle_expires_at?: string;
  idle_timeout_minutes: number;
  tab_bound: boolean;
};

type RawAdminSession = Partial<AdminSession> & {
  authenticated?: boolean;
  username?: string;
  display_name?: string | null;
  roles?: AdminRole[];
  permissions?: AdminPermission[];
  user?: Partial<AdminUser>;
  session_context?: AdminSession["session_context"];
  expires_at?: string;
  idle_expires_at?: string;
  idle_timeout_minutes?: number;
  tab_bound?: boolean;
};

const ADMIN_SESSION_HEADER = "X-FEMATA-Session-Key";
const ADMIN_BROWSER_SESSION_STORAGE_KEY = "femata_admin_browser_session";

const parseErrorDetail = async (response: Response, fallback: string) => {
  const data = (await response.json().catch(() => ({}))) as { detail?: string };
  return data.detail || fallback;
};

const normalizeAdminSession = (raw: RawAdminSession): AdminSession => {
  const username = raw.username || raw.user?.username || "admin";
  const roles = Array.isArray(raw.roles) && raw.roles.length ? raw.roles : ["case_manager"];
  const permissions = Array.isArray(raw.permissions) && raw.permissions.length
    ? raw.permissions
    : username === "admin"
      ? ["view_reports", "update_reports", "manage_users", "view_analytics", "use_messages", "manage_notifications"]
      : ["view_reports", "update_reports", "use_messages"];
  const user: AdminUser = {
    user_id: raw.user?.user_id || username,
    username,
    display_name: raw.user?.display_name ?? raw.display_name ?? null,
    full_name: raw.user?.full_name ?? null,
    email: raw.user?.email ?? null,
    mobile_number: raw.user?.mobile_number ?? null,
    roles: (Array.isArray(raw.user?.roles) && raw.user?.roles.length ? raw.user.roles : roles) as AdminRole[],
    permissions: (Array.isArray(raw.user?.permissions) && raw.user?.permissions.length ? raw.user.permissions : permissions) as AdminPermission[],
    assigned_desks: Array.isArray(raw.user?.assigned_desks) ? raw.user.assigned_desks : [],
    assigned_regions: Array.isArray(raw.user?.assigned_regions) ? raw.user.assigned_regions : [],
    assigned_municipalities: Array.isArray(raw.user?.assigned_municipalities) ? raw.user.assigned_municipalities : [],
    assigned_zones: Array.isArray(raw.user?.assigned_zones) ? raw.user.assigned_zones : [],
    coverage_assignments: Array.isArray(raw.user?.coverage_assignments) ? raw.user.coverage_assignments : [],
    profile_image_url: raw.user?.profile_image_url ?? null,
    profile_image_filename: raw.user?.profile_image_filename ?? null,
    signature_image_url: raw.user?.signature_image_url ?? null,
    signature_image_filename: raw.user?.signature_image_filename ?? null,
    organization_logo_url: raw.user?.organization_logo_url ?? null,
    organization_logo_filename: raw.user?.organization_logo_filename ?? null,
    role_title: raw.user?.role_title ?? null,
    reporting_line: raw.user?.reporting_line ?? null,
    organization_name: raw.user?.organization_name ?? null,
    organization_address: raw.user?.organization_address ?? null,
    organization_email: raw.user?.organization_email ?? null,
    organization_phone: raw.user?.organization_phone ?? null,
    is_active: raw.user?.is_active ?? true,
    is_system: raw.user?.is_system ?? false,
    created_at: raw.user?.created_at || "",
    updated_at: raw.user?.updated_at || "",
    last_login_at: raw.user?.last_login_at ?? null,
  };

  return {
    authenticated: true,
    username,
    display_name: user.display_name,
    roles: roles as AdminRole[],
    permissions: permissions as AdminPermission[],
    user,
    session_context: raw.session_context ?? null,
    expires_at: raw.expires_at || "",
    idle_expires_at: raw.idle_expires_at,
    idle_timeout_minutes: raw.idle_timeout_minutes || 30,
    tab_bound: raw.tab_bound === true,
  };
};

const readBrowserSessionKey = () => {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(ADMIN_BROWSER_SESSION_STORAGE_KEY) || "";
};

const writeBrowserSessionKey = (value: string) => {
  if (typeof window === "undefined") return value;
  window.sessionStorage.setItem(ADMIN_BROWSER_SESSION_STORAGE_KEY, value);
  return value;
};

const createBrowserSessionKey = () => {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
};

export const ensureAdminBrowserSessionKey = () => {
  const existing = readBrowserSessionKey();
  if (existing) return existing;
  return writeBrowserSessionKey(createBrowserSessionKey());
};

export const rotateAdminBrowserSessionKey = () => writeBrowserSessionKey(createBrowserSessionKey());

export const clearAdminBrowserSessionKey = () => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ADMIN_BROWSER_SESSION_STORAGE_KEY);
};

const withAdminHeaders = (headers?: HeadersInit, browserSessionKey = ensureAdminBrowserSessionKey()) => {
  const nextHeaders = new Headers(headers);
  if (browserSessionKey) nextHeaders.set(ADMIN_SESSION_HEADER, browserSessionKey);
  return nextHeaders;
};

export const adminFetch = (input: RequestInfo | URL, init: RequestInit = {}) =>
  fetch(input, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: withAdminHeaders(init.headers),
  });

export const getAdminSession = async () => {
  const response = await adminFetch(`${API_BASE}/admin/auth/session`);
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, "Unable to verify administrator session."));
  }
  const data = (await response.json()) as RawAdminSession;
  return normalizeAdminSession(data);
};

export const loginAdmin = async (username: string, password: string, clientContext?: ClientContext) => {
  const browserSessionKey = rotateAdminBrowserSessionKey();
  const response = await fetch(`${API_BASE}/admin/auth/login`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: withAdminHeaders({ "Content-Type": "application/json" }, browserSessionKey),
    body: JSON.stringify({ username, password, client_context: clientContext ?? collectClientContext() }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, "Unable to sign in."));
  }
  const data = (await response.json()) as RawAdminSession;
  return normalizeAdminSession(data);
};

export const logoutAdmin = async () => {
  const response = await adminFetch(`${API_BASE}/admin/auth/logout`, {
    method: "POST",
  });
  clearAdminBrowserSessionKey();
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, "Unable to sign out."));
  }
  return response.json() as Promise<{ status: string }>;
};

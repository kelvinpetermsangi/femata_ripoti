import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import AnimatedSelect from "./AnimatedSelect";
import { API_BASE } from "../lib/apiBase";
import { adminFetch, getAdminSession, logoutAdmin, type AdminSession } from "../lib/adminAuth";
import { translateAdminRole } from "../lib/adminI18n";
import { adminSupportedLanguages, changeAppLanguage, resolveAdminLanguage } from "../i18n";
import { SYSTEM_VERSION } from "../lib/systemMeta";

export type AdminTheme = "dark" | "light";

export type AdminLayoutContext = {
  session: AdminSession;
  unreadNotifications: number;
  refreshNotifications: () => Promise<void>;
  refreshSession: () => Promise<void>;
  theme: AdminTheme;
  setTheme: (theme: AdminTheme) => void;
};

const ADMIN_THEME_STORAGE_KEY = "femataAdminTheme";

const AdminLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n, t } = useTranslation();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setThemeState] = useState<AdminTheme>("dark");
  const [clockNow, setClockNow] = useState(() => new Date());

  const canSeeCases = Boolean(session?.permissions.includes("view_reports")) && (Boolean(session?.roles.includes("super_admin")) || Boolean(session?.user.assigned_desks.length));
  const canSeeAnalytics = Boolean(session && (session.roles.includes("super_admin") || session.roles.includes("analyst")));
  const canManageUsers = Boolean(session?.permissions.includes("manage_users"));
  const canMessage = Boolean(session?.permissions.includes("use_messages"));
  const currentLanguage = resolveAdminLanguage(i18n.resolvedLanguage, i18n.language);
  const accountRegionLabel = useMemo(() => {
    const assignedRegions = session?.user.assigned_regions ?? [];
    if (assignedRegions.length === 1) return assignedRegions[0];
    if (assignedRegions.length > 1) return `${assignedRegions[0]} +${assignedRegions.length - 1}`;
    return t("adminShellNationalScope");
  }, [session?.user.assigned_regions, t]);
  const clockLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(currentLanguage || undefined, {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      }).format(clockNow),
    [clockNow, currentLanguage],
  );

  const setTheme = (nextTheme: AdminTheme) => {
    setThemeState(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, nextTheme);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTheme = window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      setThemeState(storedTheme);
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setClockNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const activeLanguage = i18n.resolvedLanguage || i18n.language;
    const adminLanguage = resolveAdminLanguage(activeLanguage);
    if (activeLanguage !== adminLanguage) {
      void changeAppLanguage(adminLanguage);
    }
  }, [i18n.language, i18n.resolvedLanguage]);

  const refreshSession = async () => {
    const current = await getAdminSession();
    setSession(current);
  };

  const refreshNotifications = async () => {
    try {
      const response = await adminFetch(`${API_BASE}/admin/notifications`);
      if (!response.ok) {
        setUnreadNotifications(0);
        return;
      }
      const notifications = (await response.json()) as Array<{ read_at?: string | null }>;
      setUnreadNotifications(notifications.filter((item) => !item.read_at).length);
    } catch {
      setUnreadNotifications(0);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const current = await getAdminSession();
        if (!active) return;
        setSession(current);
        const response = await adminFetch(`${API_BASE}/admin/notifications`);
        if (!active) return;
        if (response.ok) {
          const notifications = (await response.json()) as Array<{ read_at?: string | null }>;
          setUnreadNotifications(notifications.filter((item) => !item.read_at).length);
        }
      } catch {
        if (active) navigate("/admin/login", { replace: true, state: { from: `${location.pathname}${location.search}${location.hash}` } });
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [location.hash, location.pathname, location.search, navigate]);

  const navItems = useMemo(
    () =>
      [
        { to: "/dashboard", label: t("adminNavHome"), show: true },
        { to: "/dashboard/cases", label: t("adminNavCases"), show: canSeeCases },
        { to: "/dashboard/analytics", label: t("adminNavAnalytics"), show: canSeeAnalytics },
        { to: "/dashboard/access", label: t("adminNavAccess"), show: canManageUsers },
        { to: "/dashboard/zones", label: t("adminNavZones"), show: canManageUsers },
        { to: "/dashboard/inbox", label: t("adminNavInbox"), show: canMessage },
        { to: "/dashboard/training", label: t("adminNavTraining"), show: true },
      ].filter((item) => item.show),
    [canManageUsers, canMessage, canSeeAnalytics, canSeeCases, t],
  );

  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } finally {
      navigate("/admin/login", { replace: true });
    }
  };

  const themeRootClass =
    theme === "light"
      ? "min-h-screen bg-[linear-gradient(180deg,#eef4fb,#f8fbff)] text-slate-950"
      : "min-h-screen bg-slate-950 text-white";
  const shellCardClass =
    theme === "light"
      ? "border border-slate-200/80 bg-white/88 shadow-[0_18px_60px_rgba(148,163,184,0.18)] backdrop-blur-md"
      : "border border-white/10 bg-white/5 shadow-[0_18px_60px_rgba(2,6,23,0.26)] backdrop-blur-md";
  const secondaryCardClass =
    theme === "light"
      ? "border border-slate-200/80 bg-slate-50/80"
      : "border border-white/10 bg-slate-950/40";
  const mutedTextClass = theme === "light" ? "text-slate-600" : "text-slate-300";
  const subtleTextClass = theme === "light" ? "text-slate-500" : "text-slate-400";

  if (loading || !session) {
    return (
      <div className={themeRootClass}>
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
          <div className={`rounded-[32px] p-10 text-center ${shellCardClass}`}>
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
            <p className="mt-6 text-lg font-semibold">{t("adminLoginCheckingSession")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={themeRootClass} data-admin-theme={theme}>
      <div className="relative overflow-hidden">
        <div className={`absolute inset-0 ${theme === "light" ? "bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_30%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.10),transparent_28%)]" : "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_22%)]"}`} />
        <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <header className={`rounded-[34px] p-5 sm:p-6 ${shellCardClass}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <NavLink to="/dashboard" className="flex min-w-0 items-center gap-4 rounded-[24px] transition hover:opacity-90">
                <img src="/femata-logo.jpeg" alt="FEMATA" className="h-12 w-12 rounded-2xl object-cover ring-1 ring-white/10" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">{t("adminShellBrand")}</p>
                  <p className="mt-2 truncate text-lg font-semibold">{session.user.display_name || session.user.username}</p>
                  <p className={`mt-1 truncate text-sm ${mutedTextClass}`}>{session.roles.map((role) => translateAdminRole(t, role)).join(", ")}</p>
                </div>
              </NavLink>
              <div className="flex flex-wrap items-center gap-2">
                <NavLink
                  to="/dashboard/inbox?tab=notifications"
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${theme === "light" ? "border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100" : "border border-cyan-300/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15"}`}
                >
                  {t("adminShellNotifications")}
                  {unreadNotifications > 0 ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${theme === "light" ? "bg-white text-sky-900" : "bg-white/10 text-white"}`}>{unreadNotifications}</span> : null}
                </NavLink>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${theme === "light" ? "border border-slate-200 bg-white text-slate-900 hover:bg-slate-100" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                >
                  {t("adminShellSettings")}
                </button>
              </div>
            </div>

            <div className={`mt-5 flex flex-wrap gap-2 ${mutedTextClass}`}>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${theme === "light" ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : "border border-emerald-300/20 bg-emerald-400/10 text-emerald-100"}`}>
                {session.user.assigned_regions.length ? t("adminShellRegionAssignments", { count: session.user.assigned_regions.length }) : t("adminShellNoRegionAssignment")}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${theme === "light" ? "border border-amber-200 bg-amber-50 text-amber-800" : "border border-amber-300/20 bg-amber-400/10 text-amber-100"}`}>
                {session.user.assigned_desks.length ? t("adminShellDeskAssignments", { count: session.user.assigned_desks.length }) : t("adminShellNoDeskAssignment")}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${theme === "light" ? "border border-slate-200 bg-slate-100 text-slate-700" : "border border-white/10 bg-white/5 text-slate-200"}`}>
                {t("adminShellSessionActive")}
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <nav className="admin-shell-scroll overflow-x-auto">
                <div className="flex min-w-max gap-2">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/dashboard"}
                      className={({ isActive }) =>
                        `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                          isActive
                            ? "bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 text-slate-950"
                            : theme === "light"
                              ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                              : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                        }`
                      }
                    >
                      <span>{item.label}</span>
                      {item.to === "/dashboard/inbox" && unreadNotifications > 0 ? (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${theme === "light" ? "bg-slate-900 text-white" : "bg-white/10 text-white"}`}>{unreadNotifications}</span>
                      ) : null}
                    </NavLink>
                  ))}
                </div>
              </nav>

              <div className="flex justify-end">
                <span className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${theme === "light" ? "border border-sky-200 bg-white text-sky-800" : "border border-sky-300/20 bg-slate-950/40 text-sky-100"}`}>
                  {clockLabel} | {accountRegionLabel}
                </span>
              </div>
            </div>
          </header>

          <main className="mt-6">
            <Outlet context={{ session, unreadNotifications, refreshNotifications, refreshSession, theme, setTheme }} />
          </main>
        </div>
      </div>

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm">
          <div className={`admin-shell-scroll h-full w-full max-w-md overflow-y-auto border-l p-6 ${theme === "light" ? "border-slate-200 bg-white text-slate-950" : "border-white/10 bg-slate-950 text-white"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">{t("adminShellSettings")}</p>
                <h2 className="mt-3 text-2xl font-bold">{t("adminSettingsTitle")}</h2>
                <p className={`mt-3 text-sm leading-7 ${mutedTextClass}`}>{t("adminSettingsDesc")}</p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className={`rounded-full px-3 py-2 text-sm font-semibold ${theme === "light" ? "border border-slate-200 bg-slate-100 text-slate-700" : "border border-white/10 bg-white/5 text-white"}`}
              >
                  {t("adminSettingsClose")}
              </button>
            </div>

            <div className={`mt-6 rounded-[28px] p-5 ${secondaryCardClass}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{t("adminSettingsLanguage")}</p>
              <div className="mt-4">
                <AnimatedSelect
                  value={currentLanguage}
                  options={adminSupportedLanguages.map((language) => ({ value: language.code, label: language.label, note: language.displayName }))}
                  onChange={async (value) => {
                    await changeAppLanguage(value);
                  }}
                  placeholder={t("adminSettingsChooseLanguage")}
                  lightMode={theme === "light"}
                />
              </div>
            </div>

            <div className={`mt-4 rounded-[28px] p-5 ${secondaryCardClass}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{t("adminSettingsTheme")}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${theme === "light" ? "bg-gradient-to-r from-sky-200 via-sky-100 to-white text-slate-950" : theme === "dark" ? "border border-white/10 bg-white/5 text-white" : "border border-slate-200 bg-white text-slate-900"}`}
                >
                  {t("adminSettingsLightMode")}
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ${theme === "dark" ? "bg-gradient-to-r from-slate-800 via-slate-900 to-black text-white" : "border border-slate-200 bg-white text-slate-900"}`}
                >
                  {t("adminSettingsDarkMode")}
                </button>
              </div>
            </div>

            <div className={`mt-4 rounded-[28px] p-5 ${secondaryCardClass}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{t("adminSettingsCurrentAccess")}</p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className={`text-xs uppercase tracking-[0.16em] ${subtleTextClass}`}>{t("adminSettingsRoles")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {session.roles.map((role) => (
                      <span key={role} className={`rounded-full px-3 py-1 text-xs font-semibold ${theme === "light" ? "border border-amber-200 bg-amber-50 text-amber-800" : "border border-amber-300/20 bg-amber-400/10 text-amber-100"}`}>
                        {translateAdminRole(t, role)}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className={`text-xs uppercase tracking-[0.16em] ${subtleTextClass}`}>{t("adminSettingsAssignedDesks")}</p>
                  <p className={`mt-2 text-sm ${mutedTextClass}`}>{session.user.assigned_desks.length ? session.user.assigned_desks.join(", ") : t("adminShellNoDeskAssignment")}</p>
                </div>
                <div>
                  <p className={`text-xs uppercase tracking-[0.16em] ${subtleTextClass}`}>{t("adminSettingsAssignedRegions")}</p>
                  <p className={`mt-2 text-sm ${mutedTextClass}`}>{session.user.assigned_regions.length ? session.user.assigned_regions.join(", ") : t("adminShellNoRegionAssignment")}</p>
                </div>
              </div>
            </div>

            <div className={`mt-4 rounded-[28px] p-5 ${secondaryCardClass}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{t("adminSettingsProfile")}</p>
              <div className="mt-4 space-y-3">
                <NavLink
                  to="/dashboard/profile"
                  onClick={() => setSettingsOpen(false)}
                  className={`block rounded-2xl px-4 py-3 text-sm font-semibold ${theme === "light" ? "border border-slate-200 bg-white text-slate-900 hover:bg-slate-100" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                >
                  {t("adminSettingsOpenProfile")}
                </NavLink>
                <NavLink
                  to="/dashboard/training"
                  onClick={() => setSettingsOpen(false)}
                  className={`block rounded-2xl px-4 py-3 text-sm font-semibold ${theme === "light" ? "border border-slate-200 bg-white text-slate-900 hover:bg-slate-100" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                >
                  {t("adminSettingsOpenTraining")}
                </NavLink>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold ${theme === "light" ? "border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100" : "border border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15"}`}
                >
                  {t("adminSettingsSignOut")}
                </button>
                <div className={`rounded-2xl px-4 py-3 text-xs ${mutedTextClass} ${theme === "light" ? "border border-slate-200 bg-slate-50" : "border border-white/10 bg-slate-900/40"}`}>
                  {t("adminSettingsSystemVersion", { version: SYSTEM_VERSION })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`.admin-shell-scroll{scrollbar-width:none;-ms-overflow-style:none}.admin-shell-scroll::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
};

export default AdminLayout;

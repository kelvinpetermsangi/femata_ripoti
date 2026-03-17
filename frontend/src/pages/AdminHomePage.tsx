import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { API_BASE } from "../lib/apiBase";
import { adminFetch } from "../lib/adminAuth";
import { useAdminLayoutContext } from "../components/adminLayoutContext";

type HomeStats = {
  total: number;
  submitted: number;
  open: number;
  closed: number;
  drafts: number;
};

type ReportRow = {
  draft_id: string;
  is_submitted: boolean;
  status: string;
};

const AdminHomePage = () => {
  const { session, unreadNotifications, theme } = useAdminLayoutContext();
  const { t } = useTranslation();
  const [stats, setStats] = useState<HomeStats>({ total: 0, submitted: 0, open: 0, closed: 0, drafts: 0 });

  const canSeeCases = Boolean(session.permissions.includes("view_reports")) && (Boolean(session.roles.includes("super_admin")) || Boolean(session.user.assigned_desks.length));
  const canSeeAnalytics = session.roles.includes("super_admin") || session.roles.includes("analyst");
  const canManageUsers = Boolean(session.permissions.includes("manage_users"));
  const canMessage = Boolean(session.permissions.includes("use_messages"));

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!canSeeCases) return;
      const response = await adminFetch(`${API_BASE}/admin/reports`);
      if (!response.ok) return;
      const reports = (await response.json()) as ReportRow[];
      if (!active) return;
      const submitted = reports.filter((item) => item.is_submitted);
      setStats({
        total: reports.length,
        submitted: submitted.length,
        drafts: reports.length - submitted.length,
        open: submitted.filter((item) => item.status !== "Imefungwa").length,
        closed: submitted.filter((item) => item.status === "Imefungwa").length,
      });
    };
    void load();
    return () => {
      active = false;
    };
  }, [canSeeCases]);

  const shortcuts = useMemo(
    () =>
      [
        canSeeCases
          ? { to: "/dashboard/cases", title: t("adminHomeCardCasesTitle"), body: t("adminHomeCardCasesBody") }
          : null,
        canSeeAnalytics
          ? { to: "/dashboard/analytics", title: t("adminHomeCardAnalyticsTitle"), body: t("adminHomeCardAnalyticsBody") }
          : null,
        canManageUsers
          ? { to: "/dashboard/access", title: t("adminHomeCardAccessTitle"), body: t("adminHomeCardAccessBody") }
          : null,
        canManageUsers
          ? { to: "/dashboard/zones", title: t("adminHomeCardZonesTitle"), body: t("adminHomeCardZonesBody") }
          : null,
        canMessage
          ? { to: "/dashboard/inbox", title: t("adminHomeCardInboxTitle"), body: t("adminHomeCardInboxBody") }
          : null,
        { to: "/dashboard/training", title: t("adminHomeCardTrainingTitle"), body: t("adminHomeCardTrainingBody") },
        { to: "/dashboard/profile", title: t("adminHomeCardProfileTitle"), body: t("adminHomeCardProfileBody") },
      ].filter(Boolean) as Array<{ to: string; title: string; body: string }>,
    [canManageUsers, canMessage, canSeeAnalytics, canSeeCases, t],
  );

  const cardClass = theme === "light" ? "rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(148,163,184,0.12)]" : "rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-md";
  const heroClass = theme === "light" ? "rounded-[32px] border border-slate-200 bg-[linear-gradient(145deg,#ffffff,#eef6ff)] p-6 text-slate-950 shadow-[0_20px_60px_rgba(148,163,184,0.16)] sm:p-8" : "rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(7,20,38,0.95),rgba(10,30,48,0.9),rgba(10,18,34,0.96))] p-6 sm:p-8";
  const mutedClass = theme === "light" ? "text-slate-600" : "text-slate-300";
  const subtleClass = theme === "light" ? "text-slate-500" : "text-slate-400";
  const linkCardClass = theme === "light" ? "rounded-[28px] border border-slate-200/80 bg-white/90 p-5 transition hover:border-sky-300 hover:bg-sky-50/70" : "rounded-[28px] border border-white/10 bg-white/5 p-5 transition hover:bg-white/10";

  return (
    <div className="space-y-6">
      <section className={heroClass}>
        <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{t("adminHomeEyebrow")}</p>
        <h1 className={`mt-4 text-3xl font-bold ${theme === "light" ? "text-slate-950" : "text-white"}`}>{t("adminHomeWelcome", { name: session.user.display_name || session.user.username })}</h1>
        <p className={`mt-4 max-w-3xl text-sm leading-7 ${mutedClass}`}>
          {t("adminHomeDesc")}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${theme === "light" ? "border border-sky-200 bg-sky-50 text-sky-800" : "border border-cyan-300/20 bg-cyan-400/10 text-cyan-100"}`}>{session.user.assigned_regions.length ? t("adminHomeAssignedRegions", { count: session.user.assigned_regions.length }) : t("adminShellNoRegionAssignment")}</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${theme === "light" ? "border border-amber-200 bg-amber-50 text-amber-800" : "border border-amber-300/20 bg-amber-400/10 text-amber-100"}`}>{session.user.assigned_desks.length ? t("adminHomeAssignedDesks", { count: session.user.assigned_desks.length }) : t("adminShellNoDeskAssignment")}</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${theme === "light" ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : "border border-emerald-300/20 bg-emerald-400/10 text-emerald-100"}`}>{t("adminHomeUnreadNotifications", { count: unreadNotifications })}</span>
        </div>
      </section>

      {canSeeCases ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className={cardClass}><p className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminHomeMetricTotal")}</p><p className={`mt-3 text-3xl font-bold ${theme === "light" ? "text-slate-950" : "text-white"}`}>{stats.total}</p></div>
          <div className={cardClass}><p className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminHomeMetricSubmitted")}</p><p className={`mt-3 text-3xl font-bold ${theme === "light" ? "text-slate-950" : "text-white"}`}>{stats.submitted}</p></div>
          <div className={cardClass}><p className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminHomeMetricDraftOnly")}</p><p className={`mt-3 text-3xl font-bold ${theme === "light" ? "text-slate-950" : "text-white"}`}>{stats.drafts}</p></div>
          <div className={cardClass}><p className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminHomeMetricOpenSubmitted")}</p><p className={`mt-3 text-3xl font-bold ${theme === "light" ? "text-slate-950" : "text-white"}`}>{stats.open}</p></div>
          <div className={cardClass}><p className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminHomeMetricClosedSubmitted")}</p><p className={`mt-3 text-3xl font-bold ${theme === "light" ? "text-slate-950" : "text-white"}`}>{stats.closed}</p></div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {shortcuts.map((item) => (
          <Link key={item.to} to={item.to} className={linkCardClass}>
            <div className="flex items-start justify-between gap-3">
              <h2 className={`text-xl font-bold ${theme === "light" ? "text-slate-950" : "text-white"}`}>{item.title}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${theme === "light" ? "border border-slate-200 bg-slate-100 text-slate-700" : "border border-white/10 bg-white/5 text-slate-200"}`}>{t("adminHomeOpen")}</span>
            </div>
            <p className={`mt-3 text-sm leading-7 ${mutedClass}`}>{item.body}</p>
          </Link>
        ))}
      </section>
    </div>
  );
};

export default AdminHomePage;

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AnimatedSelect, { type AnimatedSelectOption } from "../components/AnimatedSelect";
import { useAdminLayoutContext } from "../components/adminLayoutContext";
import { normalizeLocation, regionMunicipalityMap, regions } from "../data/tanzaniaLocations";
import { API_BASE } from "../lib/apiBase";
import { adminFetch } from "../lib/adminAuth";
import {
  ADMIN_CASE_STATUSES,
  ADMIN_DESKS,
  formatAdminRelativeTime,
  formatAdminTimestamp,
  translateAdminDesk,
  translateAdminStatus,
  translateBooleanValue,
} from "../lib/adminI18n";

type ActivityLogItem = {
  id: string;
  created_at: string;
  event_type: string;
  title: string;
  detail: string;
};

type ReportRow = {
  draft_id: string;
  internal_tracking_number: string;
  public_reference_number: string;
  reporter_group: string | null;
  value_chain_role: string | null;
  issue_target_type: string | null;
  issue_types: string[];
  handling_level: string | null;
  severity: string | null;
  immediate_danger: boolean | null;
  affected_scope: string | null;
  region: string | null;
  municipality: string | null;
  short_title: string | null;
  status: string;
  assigned_desk: string;
  feedback: string;
  action_started: boolean;
  is_submitted: boolean;
  updated_at: string;
  created_at: string;
  submitted_at: string | null;
  closed_at: string | null;
  public_access_expires_at: string | null;
  public_tracking_disabled: boolean;
  public_tracking_disabled_reason: string | null;
  additional_information: Array<{ id: string; message: string; created_at: string; source: string }>;
  activity_log: ActivityLogItem[];
};

type QueueSort = "recent" | "oldest" | "openFirst" | "submittedFirst";
type RecordTypeFilter = "all" | "submitted" | "draft";
type PublicAccessFilter = "all" | "open" | "closed";
type CasesSurface = "queue" | "lookup" | "filters";
type CaseTab = "overview" | "public" | "history" | "actions";

const parseTimestamp = (value: string | null) => {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const normalizeText = (value: string | null | undefined) => (value ?? "").toLowerCase().trim();
const caseTitle = (report: ReportRow, fallback: string) => report.short_title || report.issue_target_type || report.reporter_group || fallback;

const statusTone = (status: string) =>
  status === "Imefungwa"
    ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
    : status === "Majibu yapo"
      ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-200"
      : "border-amber-300/20 bg-amber-400/10 text-amber-100";

const AdminCasesPage = () => {
  const { session, theme } = useAdminLayoutContext();
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || "sw";
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [surface, setSurface] = useState<CasesSurface>("queue");
  const [caseTab, setCaseTab] = useState<CaseTab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deskFilter, setDeskFilter] = useState("all");
  const [recordTypeFilter, setRecordTypeFilter] = useState<RecordTypeFilter>("all");
  const [publicAccessFilter, setPublicAccessFilter] = useState<PublicAccessFilter>("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [municipalityFilter, setMunicipalityFilter] = useState("all");
  const [regionQuery, setRegionQuery] = useState("");
  const [municipalityQuery, setMunicipalityQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(5);
  const [queueSort, setQueueSort] = useState<QueueSort>("recent");
  const [caseStatus, setCaseStatus] = useState<string>(ADMIN_CASE_STATUSES[0] || "");
  const [caseAssignedDesk, setCaseAssignedDesk] = useState<string>(ADMIN_DESKS[0] || "");
  const [feedback, setFeedback] = useState("");
  const [actionStarted, setActionStarted] = useState(false);

  const canSeeCases = session.permissions.includes("view_reports") && (session.roles.includes("super_admin") || Boolean(session.user.assigned_desks.length));
  const canUpdateReports = session.permissions.includes("update_reports");
  const selected = useMemo(() => reports.find((report) => report.draft_id === selectedId) ?? null, [reports, selectedId]);

  const regionOptions = useMemo(
    () =>
      [...new Set([...regions, ...reports.map((report) => report.region).filter((value): value is string => Boolean(value))])]
        .sort((left, right) => left.localeCompare(right)),
    [reports],
  );
  const municipalities = useMemo(
    () => (regionFilter === "all" ? [] : [...(regionMunicipalityMap[regionFilter] || [])].sort((left, right) => left.localeCompare(right))),
    [regionFilter],
  );
  const filteredRegionSuggestions = useMemo(
    () => (!regionQuery.trim() ? [] : regionOptions.filter((item) => normalizeLocation(item).includes(normalizeLocation(regionQuery)))),
    [regionOptions, regionQuery],
  );
  const filteredMunicipalitySuggestions = useMemo(
    () => (!municipalityQuery.trim() ? [] : municipalities.filter((item) => normalizeLocation(item).includes(normalizeLocation(municipalityQuery)))),
    [municipalities, municipalityQuery],
  );
  const deskOptions = useMemo(
    () =>
      [...new Set([...ADMIN_DESKS, ...reports.map((report) => report.assigned_desk)].filter(Boolean))]
        .sort((left, right) => left.localeCompare(right)),
    [reports],
  );
  const statusOptions = useMemo<AnimatedSelectOption[]>(
    () => [{ value: "all", label: t("adminCasesAllStatuses"), note: t("adminCasesAllStatusesNote") }, ...ADMIN_CASE_STATUSES.map((item) => ({ value: item, label: translateAdminStatus(t, item) }))],
    [t],
  );
  const deskFilterOptions = useMemo<AnimatedSelectOption[]>(
    () => [{ value: "all", label: t("adminCasesAllDesks"), note: t("adminCasesAllDesksNote") }, ...deskOptions.map((item) => ({ value: item, label: translateAdminDesk(t, item) }))],
    [deskOptions, t],
  );
  const queueSortOptions = useMemo<AnimatedSelectOption[]>(
    () => [
      { value: "recent", label: t("adminCasesSortRecent"), note: t("adminCasesSortRecentNote") },
      { value: "oldest", label: t("adminCasesSortOldest"), note: t("adminCasesSortOldestNote") },
      { value: "openFirst", label: t("adminCasesSortOpenFirst"), note: t("adminCasesSortOpenFirstNote") },
      { value: "submittedFirst", label: t("adminCasesSortSubmittedFirst"), note: t("adminCasesSortSubmittedFirstNote") },
    ],
    [t],
  );
  const caseStatusOptions = useMemo<AnimatedSelectOption[]>(
    () => ADMIN_CASE_STATUSES.map((item) => ({ value: item, label: translateAdminStatus(t, item) })),
    [t],
  );
  const caseDeskOptions = useMemo<AnimatedSelectOption[]>(
    () => deskOptions.map((item) => ({ value: item, label: translateAdminDesk(t, item) })),
    [deskOptions, t],
  );

  const filteredReports = useMemo(() => {
    const query = normalizeText(searchQuery);
    return reports
      .filter((report) => {
        if (recordTypeFilter === "submitted" && !report.is_submitted) return false;
        if (recordTypeFilter === "draft" && report.is_submitted) return false;
        if (statusFilter !== "all" && report.status !== statusFilter) return false;
        if (deskFilter !== "all" && report.assigned_desk !== deskFilter) return false;
        if (regionFilter !== "all" && (report.region || "") !== regionFilter) return false;
        if (municipalityFilter !== "all" && (report.municipality || "") !== municipalityFilter) return false;
        if (publicAccessFilter === "open" && report.public_tracking_disabled) return false;
        if (publicAccessFilter === "closed" && !report.public_tracking_disabled) return false;
        if (!query) return true;
        const haystack = [
          report.internal_tracking_number,
          report.public_reference_number,
          report.short_title,
          report.issue_target_type,
          report.reporter_group,
          report.region,
          report.municipality,
          report.assigned_desk,
          report.status,
          report.feedback,
          ...report.issue_types,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((left, right) => {
        if (queueSort === "oldest") return parseTimestamp(left.updated_at || left.created_at) - parseTimestamp(right.updated_at || right.created_at);
        if (queueSort === "openFirst") {
          const leftRank = left.status === "Imefungwa" ? 1 : 0;
          const rightRank = right.status === "Imefungwa" ? 1 : 0;
          return leftRank - rightRank || parseTimestamp(right.updated_at || right.created_at) - parseTimestamp(left.updated_at || left.created_at);
        }
        if (queueSort === "submittedFirst") {
          return Number(right.is_submitted) - Number(left.is_submitted) || parseTimestamp(right.updated_at || right.created_at) - parseTimestamp(left.updated_at || left.created_at);
        }
        return parseTimestamp(right.updated_at || right.created_at) - parseTimestamp(left.updated_at || left.created_at);
      });
  }, [deskFilter, municipalityFilter, publicAccessFilter, queueSort, recordTypeFilter, regionFilter, reports, searchQuery, statusFilter]);

  const visibleReports = useMemo(() => filteredReports.slice(0, visibleCount), [filteredReports, visibleCount]);
  const quickLookupMatches = useMemo(() => {
    const query = normalizeText(lookupQuery).replace(/\s+/g, "");
    if (!query) return [];
    return reports
      .filter((report) => {
        const internal = normalizeText(report.internal_tracking_number).replace(/\s+/g, "");
        const reference = normalizeText(report.public_reference_number).replace(/\s+/g, "");
        return internal.includes(query) || reference.includes(query);
      })
      .sort((left, right) => parseTimestamp(right.updated_at || right.created_at) - parseTimestamp(left.updated_at || left.created_at))
      .slice(0, 6);
  }, [lookupQuery, reports]);

  const stats = useMemo(
    () => ({
      total: reports.length,
      submitted: reports.filter((report) => report.is_submitted).length,
      open: reports.filter((report) => report.is_submitted && report.status !== "Imefungwa").length,
      closed: reports.filter((report) => report.is_submitted && report.status === "Imefungwa").length,
    }),
    [reports],
  );

  const load = useMemo(() => async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminFetch(`${API_BASE}/admin/reports`);
      const data = (await response.json().catch(() => ([]))) as ReportRow[] | { detail?: string };
      if (!response.ok) {
        throw new Error("detail" in data ? data.detail || t("adminCasesLoadError") : t("adminCasesLoadError"));
      }
      setReports(data as ReportRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminCasesLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!canSeeCases) return;
    void load();
  }, [canSeeCases, load]);

  useEffect(() => {
    if (!selected) return;
    setCaseStatus(selected.status || ADMIN_CASE_STATUSES[0]);
    setCaseAssignedDesk(selected.assigned_desk || ADMIN_DESKS[0]);
    setFeedback(selected.feedback || "");
    setActionStarted(Boolean(selected.action_started));
  }, [selected]);

  useEffect(() => {
    setVisibleCount(5);
  }, [deskFilter, municipalityFilter, publicAccessFilter, queueSort, recordTypeFilter, regionFilter, searchQuery, statusFilter]);

  const refreshReports = async () => {
    const response = await adminFetch(`${API_BASE}/admin/reports`);
    const data = (await response.json().catch(() => ([]))) as ReportRow[] | { detail?: string };
    if (!response.ok) {
      throw new Error("detail" in data ? data.detail || t("adminCasesRefreshError") : t("adminCasesRefreshError"));
    }
    setReports(data as ReportRow[]);
  };

  const openCase = (report: ReportRow, nextTab: CaseTab = "overview") => {
    setSelectedId(report.draft_id);
    setCaseTab(nextTab);
  };
  const openLookupMatch = () => {
    if (!lookupQuery.trim()) {
      setLookupError(t("adminCasesLookupMissing"));
      return;
    }
    if (!quickLookupMatches.length) {
      setLookupError(t("adminCasesLookupNoMatch"));
      return;
    }
    setLookupError("");
    openCase(quickLookupMatches[0]);
    setSurface("queue");
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDeskFilter("all");
    setRecordTypeFilter("all");
    setPublicAccessFilter("all");
    setRegionFilter("all");
    setMunicipalityFilter("all");
    setRegionQuery("");
    setMunicipalityQuery("");
    setQueueSort("recent");
  };

  const saveUpdate = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await adminFetch(`${API_BASE}/admin/reports/${selected.draft_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: caseStatus,
          assigned_desk: caseAssignedDesk,
          feedback,
          action_started: actionStarted,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) throw new Error(data.detail || t("adminCasesSaveError"));
      await refreshReports();
      setCaseTab("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminCasesSaveError"));
    } finally {
      setSaving(false);
    }
  };

  const shellClass = theme === "light" ? "border border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(148,163,184,0.18)]" : "border border-white/10 bg-white/5 shadow-[0_18px_50px_rgba(2,6,23,0.26)]";
  const softCardClass = theme === "light" ? "border border-slate-200/80 bg-slate-50/80" : "border border-white/10 bg-slate-950/35";
  const mutedTextClass = theme === "light" ? "text-slate-600" : "text-slate-300";
  const subtleTextClass = theme === "light" ? "text-slate-500" : "text-slate-400";
  const idleButtonClass = theme === "light" ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-100" : "border-white/10 bg-white/5 text-white hover:bg-white/10";
  const activeSurfaceClass = "border-cyan-300/20 bg-cyan-400/10 text-cyan-100";
  const activeTabClass = theme === "light" ? "bg-slate-900 text-white" : "bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 text-slate-950";
  const inputClass = theme === "light" ? "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400" : "w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500";

  if (!canSeeCases) {
    return <div className={`rounded-[32px] p-8 text-sm ${shellClass} ${mutedTextClass}`}>{t("adminCasesAccessDenied")}</div>;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className={`overflow-hidden rounded-[34px] p-6 sm:p-8 ${theme === "light" ? "border border-slate-200 bg-[linear-gradient(145deg,#ffffff,#eef6ff)] text-slate-950 shadow-[0_20px_60px_rgba(148,163,184,0.16)]" : "border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_28%),linear-gradient(160deg,rgba(7,20,38,0.98),rgba(8,31,47,0.94),rgba(10,18,34,0.98))] text-white shadow-[0_24px_80px_rgba(2,6,23,0.34)]"}`}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-4xl">
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{t("adminCasesHeroEyebrow")}</p>
            <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{t("adminCasesHeroTitle")}</h1>
            <p className={`mt-4 max-w-3xl text-sm leading-7 sm:text-base ${mutedTextClass}`}>{t("adminCasesHeroDesc")}</p>
          </div>
          <button type="button" onClick={() => void refreshReports()} className="rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950">
            {t("adminCasesRefresh")}
          </button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className={`rounded-[24px] p-4 ${softCardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>{t("adminCasesRecords")}</p><p className="mt-3 text-3xl font-bold">{stats.total}</p></div>
          <div className={`rounded-[24px] p-4 ${softCardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>{t("adminCasesSubmitted")}</p><p className="mt-3 text-3xl font-bold">{stats.submitted}</p></div>
          <div className={`rounded-[24px] p-4 ${softCardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>{t("adminCasesOpen")}</p><p className="mt-3 text-3xl font-bold">{stats.open}</p></div>
          <div className={`rounded-[24px] p-4 ${softCardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>{t("adminCasesClosed")}</p><p className="mt-3 text-3xl font-bold">{stats.closed}</p></div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
        <section className={`rounded-[32px] p-5 sm:p-6 ${shellClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{t("adminCasesControlDeck")}</p>
              <h2 className="mt-3 text-2xl font-bold">{t("adminCasesControlTitle")}</h2>
            </div>
            <span className={`rounded-full px-4 py-2 text-xs font-semibold ${softCardClass}`}>{loading ? t("adminCasesLoading") : t("adminCasesVisibleCount", { visible: visibleReports.length, total: filteredReports.length })}</span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { value: "queue", label: t("adminCasesSurfaceQueue"), detail: t("adminCasesSurfaceQueueDetail") },
              { value: "lookup", label: t("adminCasesSurfaceLookup"), detail: t("adminCasesSurfaceLookupDetail") },
              { value: "filters", label: t("adminCasesSurfaceFilters"), detail: t("adminCasesSurfaceFiltersDetail") },
            ].map((item) => (
              <button key={item.value} type="button" onClick={() => setSurface(item.value as CasesSurface)} className={`rounded-[24px] border px-4 py-4 text-left transition ${surface === item.value ? activeSurfaceClass : idleButtonClass}`}>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="mt-2 text-sm leading-6 opacity-80">{item.detail}</p>
              </button>
            ))}
          </div>

          {surface === "queue" ? (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">{t("adminCasesSearchQueue")}</span>
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t("adminCasesSearchPlaceholder")} className={inputClass} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">{t("adminCasesStatusField")}</span>
                  <AnimatedSelect value={statusFilter} options={statusOptions} onChange={setStatusFilter} lightMode={theme === "light"} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">{t("adminCasesAssignedDeskField")}</span>
                  <AnimatedSelect value={deskFilter} options={deskFilterOptions} onChange={setDeskFilter} lightMode={theme === "light"} />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "all", label: t("adminCasesAllRecords") },
                    { value: "submitted", label: t("adminCasesSubmittedOnly") },
                    { value: "draft", label: t("adminCasesDraftOnly") },
                  ].map((item) => (
                    <button key={item.value} type="button" onClick={() => setRecordTypeFilter(item.value as RecordTypeFilter)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${recordTypeFilter === item.value ? activeTabClass : `border ${idleButtonClass}`}`}>
                      {item.label}
                    </button>
                  ))}
                  {[
                    { value: "all", label: t("adminCasesPublicAccessAll") },
                    { value: "open", label: t("adminCasesPublicAccessOpen") },
                    { value: "closed", label: t("adminCasesPublicAccessClosed") },
                  ].map((item) => (
                    <button key={item.value} type="button" onClick={() => setPublicAccessFilter(item.value as PublicAccessFilter)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${publicAccessFilter === item.value ? activeSurfaceClass : `border ${idleButtonClass}`}`}>
                      {item.label}
                    </button>
                  ))}
                  <button type="button" onClick={clearFilters} className="rounded-full border border-rose-300/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15">
                    {t("adminCasesResetFilters")}
                  </button>
                </div>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">{t("adminCasesSortLabel")}</span>
                  <AnimatedSelect value={queueSort} options={queueSortOptions} onChange={(value) => setQueueSort(value as QueueSort)} lightMode={theme === "light"} />
                </label>
              </div>

              <div className={`rounded-[26px] px-4 py-3 text-sm ${softCardClass} ${mutedTextClass}`}>
                {loading ? t("adminCasesLoadingQueue") : filteredReports.length ? t("adminCasesQueueSummary", { visible: visibleReports.length, total: filteredReports.length }) : t("adminCasesNoQueuedMatches")}
              </div>

              <div className="space-y-4">
                {visibleReports.map((report) => (
                  <article key={report.draft_id} className={`rounded-[28px] p-5 transition ${selectedId === report.draft_id ? (theme === "light" ? "border border-sky-300 bg-sky-50" : "border border-amber-300/20 bg-amber-400/10") : shellClass}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`font-mono text-sm ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{report.internal_tracking_number}</p>
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${report.is_submitted ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-cyan-300/20 bg-cyan-400/10 text-cyan-200"}`}>{report.is_submitted ? t("adminCasesSubmitted") : t("adminCasesDraftOnly")}</span>
                        </div>
                        <p className={`mt-2 text-sm ${subtleTextClass}`}>{t("adminCasesPublicReferenceLabel", { reference: report.public_reference_number })}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusTone(report.status)}`}>{translateAdminStatus(t, report.status)}</span>
                    </div>
                    <h3 className="mt-4 text-2xl font-bold">{caseTitle(report, t("adminCasesUntitled"))}</h3>
                    <p className={`mt-3 text-sm leading-7 ${mutedTextClass}`}>{report.issue_types.length ? report.issue_types.join(", ") : t("adminCasesThemesPending")} | {translateAdminDesk(t, report.assigned_desk)} | {report.region || t("adminCasesRegionPending")}{report.municipality ? ` / ${report.municipality}` : ""}</p>
                    <div className={`mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.16em] ${subtleTextClass}`}>
                      <span>{t("adminCasesPublicNotesCount", { count: report.additional_information.length })}</span>
                      <span>{t("adminCasesEventsCount", { count: report.activity_log.length })}</span>
                      <span>{t("adminCasesUpdatedRelative", { value: formatAdminRelativeTime(report.updated_at || report.created_at, t) })}</span>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button type="button" onClick={() => openCase(report)} className="rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-4 py-2.5 text-sm font-semibold text-slate-950">
                        {selectedId === report.draft_id ? t("adminCasesCaseOpen") : t("adminCasesOpenCase")}
                      </button>
                      <button type="button" onClick={() => openCase(report, "history")} className={`rounded-full border px-4 py-2.5 text-sm font-semibold ${idleButtonClass}`}>
                        {t("adminCasesOpenHistory")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {!loading && filteredReports.length > visibleReports.length ? (
                <div className="flex justify-center">
                  <button type="button" onClick={() => setVisibleCount((current) => Math.min(current + 5, filteredReports.length))} className={`rounded-full border px-5 py-3 text-sm font-semibold ${idleButtonClass}`}>
                    {t("adminCasesShowMore")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {surface === "lookup" ? (
            <div className="mt-6 space-y-5">
              <div className={`rounded-[26px] p-5 ${softCardClass}`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{t("adminCasesRapidLookup")}</p>
                <p className={`mt-3 text-sm leading-7 ${mutedTextClass}`}>{t("adminCasesRapidLookupBody")}</p>
                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <input value={lookupQuery} onChange={(event) => setLookupQuery(event.target.value)} placeholder={t("adminCasesLookupPlaceholder")} className={inputClass} />
                  <button type="button" onClick={openLookupMatch} className="rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950">
                    {t("adminCasesOpenMatchingCase")}
                  </button>
                </div>
                {lookupError ? <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{lookupError}</div> : null}
              </div>
              <div className="space-y-4">
                {quickLookupMatches.length ? quickLookupMatches.map((report) => (
                  <button key={report.draft_id} type="button" onClick={() => { setLookupError(""); openCase(report); setSurface("queue"); }} className={`w-full rounded-[26px] p-4 text-left transition ${softCardClass}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className={`font-mono text-sm ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{report.internal_tracking_number}</p>
                        <p className={`mt-1 text-sm ${subtleTextClass}`}>{report.public_reference_number}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusTone(report.status)}`}>{translateAdminStatus(t, report.status)}</span>
                    </div>
                    <p className="mt-3 text-lg font-semibold">{caseTitle(report, t("adminCasesUntitled"))}</p>
                  </button>
                )) : <div className={`rounded-[26px] p-5 text-sm ${softCardClass} ${mutedTextClass}`}>{lookupQuery.trim() ? t("adminCasesNoLiveMatches") : t("adminCasesLookupHint")}</div>}
              </div>
            </div>
          ) : null}

          {surface === "filters" ? (
            <div className="mt-6 space-y-5">
              <div className={`rounded-[26px] p-5 ${softCardClass}`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{t("adminCasesRegionFilter")}</p>
                {regionFilter !== "all" ? (
                  <div className={`mt-4 rounded-[22px] p-4 ${theme === "light" ? "border border-emerald-300 bg-emerald-50" : "border border-emerald-300/20 bg-emerald-400/10"}`}>
                    <p className={`text-xs uppercase tracking-[0.18em] ${theme === "light" ? "text-emerald-700" : "text-emerald-200"}`}>{t("adminCasesSelectedRegion")}</p>
                    <p className="mt-2 text-lg font-semibold">{regionFilter}</p>
                    <button type="button" onClick={() => { setRegionFilter("all"); setMunicipalityFilter("all"); setRegionQuery(""); setMunicipalityQuery(""); }} className={`mt-4 rounded-full border px-4 py-2 text-sm font-semibold ${idleButtonClass}`}>
                      {t("adminCasesChangeRegion")}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <input value={regionQuery} onChange={(event) => setRegionQuery(event.target.value)} placeholder={t("adminCasesRegionSearchPlaceholder")} className={inputClass} />
                    {regionQuery.trim() ? (
                      <div className={`admin-cases-scroll max-h-72 space-y-2 overflow-y-auto rounded-[24px] p-3 ${theme === "light" ? "border border-slate-200 bg-white" : "border border-white/10 bg-slate-950/60"}`}>
                        {filteredRegionSuggestions.length ? filteredRegionSuggestions.map((item) => (
                          <button key={item} type="button" onClick={() => { setRegionFilter(item); setRegionQuery(item); setMunicipalityFilter("all"); setMunicipalityQuery(""); }} className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition ${theme === "light" ? "bg-slate-50 text-slate-900 hover:bg-slate-100" : "bg-white/5 text-white hover:bg-white/10"}`}>
                            {item}
                          </button>
                        )) : <div className={`rounded-2xl border border-dashed px-4 py-5 text-sm ${subtleTextClass}`}>{t("adminCasesNoRegionMatches")}</div>}
                      </div>
                    ) : <p className={`text-sm ${subtleTextClass}`}>{t("adminCasesNationwideHint")}</p>}
                  </div>
                )}
              </div>

              {regionFilter !== "all" ? (
                <div className={`rounded-[26px] p-5 ${softCardClass}`}>
                  <button type="button" onClick={() => { setMunicipalityFilter("all"); setMunicipalityQuery(""); }} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${municipalityFilter === "all" ? activeTabClass : `border ${idleButtonClass}`}`}>
                    {t("adminCommonAllMunicipalsInRegion", { region: regionFilter })}
                  </button>
                  {municipalityFilter !== "all" ? (
                    <div className={`mt-4 rounded-[22px] p-4 ${theme === "light" ? "border border-sky-300 bg-sky-50" : "border border-cyan-300/20 bg-cyan-400/10"}`}>
                      <p className={`text-xs uppercase tracking-[0.18em] ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{t("adminCasesSelectedMunicipality")}</p>
                      <p className="mt-2 text-lg font-semibold">{municipalityFilter}</p>
                    </div>
                  ) : null}
                  <div className="mt-4 space-y-3">
                    <input value={municipalityQuery} onChange={(event) => setMunicipalityQuery(event.target.value)} placeholder={t("adminCasesMunicipalitySearchPlaceholder", { region: regionFilter })} className={inputClass} />
                    {municipalityQuery.trim() ? (
                      <div className={`admin-cases-scroll max-h-72 space-y-2 overflow-y-auto rounded-[24px] p-3 ${theme === "light" ? "border border-slate-200 bg-white" : "border border-white/10 bg-slate-950/60"}`}>
                        {filteredMunicipalitySuggestions.length ? filteredMunicipalitySuggestions.map((item) => (
                          <button key={item} type="button" onClick={() => { setMunicipalityFilter(item); setMunicipalityQuery(item); }} className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition ${theme === "light" ? "bg-slate-50 text-slate-900 hover:bg-slate-100" : "bg-white/5 text-white hover:bg-white/10"}`}>
                            {item}
                          </button>
                        )) : <div className={`rounded-2xl border border-dashed px-4 py-5 text-sm ${subtleTextClass}`}>{t("adminCasesNoMunicipalityMatches")}</div>}
                      </div>
                    ) : <p className={`text-sm ${subtleTextClass}`}>{t("adminCasesMunicipalityHint")}</p>}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className={`rounded-[32px] p-5 sm:p-6 ${shellClass} xl:sticky xl:top-24 xl:self-start`}>
          {selected ? (
            <div className="space-y-5">
              <div className={`rounded-[26px] p-5 ${softCardClass}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className={`font-mono text-sm ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{selected.internal_tracking_number}</p>
                    <p className={`mt-1 text-sm ${subtleTextClass}`}>{t("adminCasesPublicReferenceLabel", { reference: selected.public_reference_number })}</p>
                    <h2 className="mt-4 text-2xl font-bold">{caseTitle(selected, t("adminCasesUntitled"))}</h2>
                    <p className={`mt-3 text-sm leading-7 ${mutedTextClass}`}>{translateAdminDesk(t, selected.assigned_desk)} | {selected.region || t("adminCasesRegionPending")}{selected.municipality ? ` / ${selected.municipality}` : ""}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusTone(selected.status)}`}>{translateAdminStatus(t, selected.status)}</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    { value: "overview", label: t("adminCasesTabOverview") },
                    { value: "public", label: t("adminCasesTabPublic") },
                    { value: "history", label: t("adminCasesTabHistory") },
                    { value: "actions", label: t("adminCasesTabActions") },
                  ].map((item) => (
                    <button key={item.value} type="button" onClick={() => setCaseTab(item.value as CaseTab)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${caseTab === item.value ? activeTabClass : `border ${idleButtonClass}`}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {caseTab === "overview" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={`rounded-[24px] p-4 ${softCardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>{t("adminCasesReporterGroup")}</p><p className="mt-2 text-sm font-semibold">{selected.reporter_group || t("adminCommonNotSet")}</p></div>
                  <div className={`rounded-[24px] p-4 ${softCardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>{t("adminCasesValueChainRole")}</p><p className="mt-2 text-sm font-semibold">{selected.value_chain_role || t("adminCommonNotSet")}</p></div>
                  <div className={`rounded-[24px] p-4 ${softCardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>{t("adminCasesTarget")}</p><p className="mt-2 text-sm font-semibold">{selected.issue_target_type || t("adminCommonNotSet")}</p></div>
                  <div className={`rounded-[24px] p-4 ${softCardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>{t("adminCasesThemes")}</p><p className="mt-2 text-sm font-semibold">{selected.issue_types.length ? selected.issue_types.join(", ") : t("adminCommonNotSet")}</p></div>
                  <div className={`rounded-[24px] p-4 ${softCardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>{t("adminCasesSeverity")}</p><p className="mt-2 text-sm font-semibold">{selected.severity || t("adminCommonNotSet")}</p></div>
                  <div className={`rounded-[24px] p-4 ${softCardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>{t("adminCasesImmediateDanger")}</p><p className="mt-2 text-sm font-semibold">{selected.immediate_danger === null ? t("adminCommonNotSet") : translateBooleanValue(t, selected.immediate_danger)}</p></div>
                  <div className={`rounded-[24px] p-4 ${softCardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>{t("adminCasesCreated")}</p><p className="mt-2 text-sm font-semibold">{formatAdminTimestamp(selected.created_at, language, t)}</p></div>
                  <div className={`rounded-[24px] p-4 ${softCardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>{t("adminCasesUpdated")}</p><p className="mt-2 text-sm font-semibold">{formatAdminTimestamp(selected.updated_at, language, t)}</p></div>
                  <div className={`rounded-[24px] p-4 sm:col-span-2 ${softCardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>{t("adminCasesCurrentResponse")}</p><p className={`mt-3 text-sm leading-7 ${mutedTextClass}`}>{selected.feedback.trim() ? selected.feedback : t("adminCasesNoOfficialResponse")}</p></div>
                </div>
              ) : null}

              {caseTab === "public" ? (
                <div className="space-y-4">
                  <div className={`rounded-[26px] p-5 ${softCardClass}`}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div><p className={`text-xs uppercase tracking-[0.16em] ${subtleTextClass}`}>{t("adminCasesPublicTracking")}</p><p className="mt-2 text-sm font-semibold">{selected.public_tracking_disabled ? t("adminCasesPublicTrackingClosed") : t("adminCasesPublicTrackingOpen")}</p></div>
                      <div><p className={`text-xs uppercase tracking-[0.16em] ${subtleTextClass}`}>{t("adminCasesPublicAccessExpiry")}</p><p className="mt-2 text-sm font-semibold">{selected.public_access_expires_at ? formatAdminTimestamp(selected.public_access_expires_at, language, t) : t("adminCasesPublicAccessActiveUntilClosed")}</p></div>
                    </div>
                    <p className={`mt-4 text-sm leading-7 ${mutedTextClass}`}>{selected.public_tracking_disabled_reason || t("adminCasesNoClosureReason")}</p>
                  </div>
                  <div className={`rounded-[26px] p-5 ${softCardClass}`}>
                    <p className="text-sm font-semibold">{t("adminCasesPublicAdditionalInformation")}</p>
                    <div className="mt-4 space-y-3">
                      {selected.additional_information.length ? selected.additional_information.map((item) => (
                        <div key={item.id} className={`rounded-[22px] p-4 ${theme === "light" ? "border border-slate-200 bg-white" : "border border-white/10 bg-white/5"}`}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{item.source}</p>
                            <p className={`text-xs ${subtleTextClass}`}>{formatAdminTimestamp(item.created_at, language, t)}</p>
                          </div>
                          <p className={`mt-3 text-sm leading-7 ${mutedTextClass}`}>{item.message}</p>
                        </div>
                      )) : <p className={`text-sm ${mutedTextClass}`}>{t("adminCasesNoPublicNotes")}</p>}
                    </div>
                  </div>
                </div>
              ) : null}

              {caseTab === "history" ? (
                <div className={`rounded-[26px] p-5 ${softCardClass}`}>
                  <p className="text-sm font-semibold">{t("adminCasesActivityHistory")}</p>
                  <div className="mt-4 space-y-3">
                    {selected.activity_log.length ? selected.activity_log.slice().reverse().map((item) => (
                      <div key={item.id} className={`rounded-[22px] p-4 ${theme === "light" ? "border border-slate-200 bg-white" : "border border-white/10 bg-white/5"}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{item.title}</p>
                            <p className={`mt-2 text-sm leading-7 ${mutedTextClass}`}>{item.detail}</p>
                          </div>
                          <p className={`text-xs ${subtleTextClass}`}>{formatAdminTimestamp(item.created_at, language, t)}</p>
                        </div>
                      </div>
                    )) : <p className={`text-sm ${mutedTextClass}`}>{t("adminCasesNoActivity")}</p>}
                  </div>
                </div>
              ) : null}

              {caseTab === "actions" ? (
                <div className={`rounded-[26px] p-5 ${softCardClass}`}>
                  {!canUpdateReports ? <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{t("adminCasesReadOnlyActions")}</div> : null}
                  <div className="mt-5 space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold">{t("adminCasesStatusField")}</span>
                      <AnimatedSelect value={caseStatus} options={caseStatusOptions} onChange={setCaseStatus} disabled={!canUpdateReports} lightMode={theme === "light"} />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold">{t("adminCasesAssignedDeskField")}</span>
                      <AnimatedSelect value={caseAssignedDesk} options={caseDeskOptions} onChange={setCaseAssignedDesk} disabled={!canUpdateReports} lightMode={theme === "light"} />
                    </label>
                    <label className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ${theme === "light" ? "border border-slate-200 bg-white text-slate-900" : "border border-white/10 bg-slate-950/40 text-white"}`}>
                      <input type="checkbox" checked={actionStarted} disabled={!canUpdateReports} onChange={(event) => setActionStarted(event.target.checked)} className="h-4 w-4 rounded border-white/20 bg-transparent" />
                      {t("adminCasesActionStarted")}
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold">{t("adminCasesFeedbackField")}</span>
                      <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} disabled={!canUpdateReports} rows={6} className={`${inputClass} min-h-[160px] resize-y leading-7 disabled:opacity-60`} />
                    </label>
                    <button type="button" disabled={!canUpdateReports || saving} onClick={() => void saveUpdate()} className="w-full rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
                      {saving ? t("adminCasesSaving") : t("adminCasesSaveUpdate")}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`rounded-[26px] p-5 ${softCardClass}`}>
                <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{t("adminCasesFocusEyebrow")}</p>
                <h2 className="mt-3 text-2xl font-bold">{t("adminCasesFocusTitle")}</h2>
                <p className={`mt-4 text-sm leading-7 ${mutedTextClass}`}>{t("adminCasesFocusBody")}</p>
              </div>
              <div className={`rounded-[26px] p-5 ${softCardClass}`}>
                <p className="text-sm font-semibold">{t("adminCasesSuggestedFlow")}</p>
                <div className={`mt-4 space-y-3 text-sm leading-7 ${mutedTextClass}`}>
                  <p>{t("adminCasesSuggestedFlow1")}</p>
                  <p>{t("adminCasesSuggestedFlow2")}</p>
                  <p>{t("adminCasesSuggestedFlow3")}</p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <style>{`.admin-cases-scroll{scrollbar-width:none;-ms-overflow-style:none}.admin-cases-scroll::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
};

export default AdminCasesPage;

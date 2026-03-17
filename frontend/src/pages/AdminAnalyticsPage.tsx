import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import AnimatedSelect from "../components/AnimatedSelect";
import { useAdminLayoutContext } from "../components/adminLayoutContext";
import { regionMunicipalityMap, regions } from "../data/tanzaniaLocations";
import { API_BASE } from "../lib/apiBase";
import { adminFetch } from "../lib/adminAuth";
import { supportedLanguages } from "../i18n";

type ZoneRecord = {
  zone_id: string;
  name: string;
  regions: string[];
};

type BreakdownItem = {
  label: string;
  value: number;
  detail?: string;
};

type TrendPoint = {
  key: string;
  label: string;
  created: number;
  submitted: number;
  closed: number;
};

type OverviewResponse = {
  generated_at: string;
  executive_summary: string;
  recommendations: string[];
  totals: {
    all_records: number;
    submitted: number;
    drafts: number;
    open: number;
    closed: number;
    action_start_median_days: number;
    response_median_days: number;
    closure_average_days: number;
  };
  breakdowns: {
    stakeholder_groups: BreakdownItem[];
    issue_types: BreakdownItem[];
    target_entities: BreakdownItem[];
    zones: BreakdownItem[];
    regions: BreakdownItem[];
    municipalities: BreakdownItem[];
    severities: BreakdownItem[];
    statuses: BreakdownItem[];
    desks: BreakdownItem[];
  };
  recent_trend: TrendPoint[];
  case_examples: Array<{ summary: string; severity: string; status: string; zone: string; region: string; municipality: string }>;
  session_insights: {
    session_count: number;
    average_duration_hours: number;
    median_duration_hours: number;
    top_users: Array<{ label: string; value: number; session_count: number; role: string }>;
  };
};

type ReportPayload = {
  start_at: string | null;
  end_at: string | null;
  scope: "national" | "zone" | "region" | "municipality";
  zone: string | null;
  region: string | null;
  municipality: string | null;
  include_drafts: boolean;
  issue_types: string[];
  language: string;
  include_charts: boolean;
  include_examples: boolean;
};

type AnalyticsView = "summary" | "drivers" | "operations" | "workforce";

const sumValues = (items: BreakdownItem[]) => items.reduce((total, item) => total + item.value, 0);
const percentage = (value: number, total: number) => (total > 0 ? value / total : 0);
const formatPercent = (value: number, locale?: string) =>
  new Intl.NumberFormat(locale || undefined, { style: "percent", maximumFractionDigits: 0 }).format(value);
const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
const formatNumber = (value: number, locale?: string) =>
  new Intl.NumberFormat(locale || undefined, { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value);

const topShare = (items: BreakdownItem[], count = 1) => {
  const total = sumValues(items);
  if (!total) return 0;
  return items.slice(0, count).reduce((sum, item) => sum + item.value, 0) / total;
};

const standardDeviation = (values: number[]) => {
  if (!values.length) return 0;
  const avg = average(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
};

const linearSlope = (values: number[]) => {
  if (values.length < 2) return 0;
  const meanX = (values.length - 1) / 2;
  const meanY = average(values);
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - meanX) * (value - meanY);
    denominator += (index - meanX) ** 2;
  });
  return denominator ? numerator / denominator : 0;
};

const describeMomentum = (slope: number) => {
  if (slope > 0.35) return "rising";
  if (slope < -0.35) return "falling";
  return "stable";
};

const describeConcentration = (share: number) => {
  if (share >= 0.6) return "highly concentrated";
  if (share >= 0.4) return "moderately concentrated";
  return "broadly distributed";
};

const concentrationIndex = (items: BreakdownItem[]) => {
  const total = sumValues(items);
  if (!total) return 0;
  return items.reduce((sum, item) => {
    const share = item.value / total;
    return sum + share * share;
  }, 0);
};

const describeHhi = (value: number) => {
  if (value >= 0.25) return "high concentration";
  if (value >= 0.15) return "moderate concentration";
  return "distributed concentration";
};

const zScore = (latest: number, values: number[]) => {
  if (values.length < 2) return 0;
  const deviation = standardDeviation(values);
  if (!deviation) return 0;
  return (latest - average(values)) / deviation;
};

const describeDeviation = (value: number) => {
  if (value >= 1.5) return "well above typical";
  if (value >= 0.75) return "above typical";
  if (value <= -1.5) return "well below typical";
  if (value <= -0.75) return "below typical";
  return "near typical";
};

const severityWeight: Record<string, number> = {
  Low: 1,
  Moderate: 2,
  High: 3,
  Critical: 4,
};

const computeSeverityIndex = (items: BreakdownItem[]) => {
  const total = sumValues(items);
  if (!total) return 0;
  const weightedTotal = items.reduce((sum, item) => sum + (severityWeight[item.label] || 0) * item.value, 0);
  return weightedTotal / (total * 4);
};

const joinLabels = (items: BreakdownItem[], limit = 3) => {
  const parts = items.slice(0, limit).map((item) => `${item.label} (${item.value})`);
  if (!parts.length) return "no dominant values";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
};

const buildPolyline = (values: number[], width = 320, height = 150, padding = 18) => {
  if (!values.length) return { line: "", area: "" };
  const max = Math.max(...values, 1);
  const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  const points = values.map((value, index) => {
    const x = padding + index * stepX;
    const y = height - padding - (value / max) * (height - padding * 2);
    return { x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = [`M ${points[0].x} ${height - padding}`, ...points.map((point) => `L ${point.x} ${point.y}`), `L ${points[points.length - 1].x} ${height - padding}`, "Z"].join(" ");
  return { line, area };
};

const Panel = ({ eyebrow, title, body, children }: { eyebrow: string; title: string; body?: string; children: React.ReactNode }) => (
  <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.035))] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.22)] backdrop-blur-md sm:p-6">
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{eyebrow}</p>
    <div className="mt-3">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      {body ? <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{body}</p> : null}
    </div>
    <div className="mt-6">{children}</div>
  </section>
);

const MetricCard = ({ label, value, note }: { label: string; value: string; note: string }) => (
  <div className="rounded-[26px] border border-white/10 bg-slate-950/35 p-5">
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
    <p className="mt-3 text-3xl font-bold text-white">{value}</p>
    <p className="mt-3 text-sm leading-6 text-slate-300">{note}</p>
  </div>
);

const GaugeCard = ({ label, value, note, tone }: { label: string; value: number; note: string; tone: string }) => (
  <div className="rounded-[26px] border border-white/10 bg-slate-950/35 p-5">
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
    <div className="mt-4 flex items-center gap-5">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full" style={{ background: `conic-gradient(${tone} ${Math.max(0, Math.min(360, value * 360))}deg, rgba(255,255,255,0.08) 0deg)` }}>
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">{formatPercent(value)}</div>
      </div>
      <p className="text-sm leading-7 text-slate-300">{note}</p>
    </div>
  </div>
);

const InsightCard = ({ label, value, detail }: { label: string; value: string; detail: string }) => (
  <div className="rounded-[24px] border border-white/10 bg-slate-950/35 p-5">
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">{label}</p>
    <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    <p className="mt-3 text-sm leading-7 text-slate-300">{detail}</p>
  </div>
);

const RankedBars = ({ title, subtitle, items, accent }: { title: string; subtitle: string; items: BreakdownItem[]; accent: string }) => {
  const visible = items.slice(0, 6);
  const max = Math.max(...visible.map((item) => item.value), 1);
  return (
    <div className="rounded-[26px] border border-white/10 bg-slate-950/35 p-5">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p>
      <div className="mt-5 space-y-4">
        {visible.map((item) => (
          <div key={`${title}-${item.label}`} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm text-white">
              <span className="truncate">{item.label}</span>
              <span className="font-semibold text-slate-200">{item.value}</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/10">
              <div className="h-2.5 rounded-full" style={{ width: `${(item.value / max) * 100}%`, background: accent }} />
            </div>
            {item.detail ? <p className="text-xs text-slate-500">{item.detail}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
};

const TrendCard = ({
  title,
  subtitle,
  values,
  total,
  stroke,
  fill,
  footerLabel,
  peakLabel,
  latestLabel,
}: {
  title: string;
  subtitle: string;
  values: number[];
  total: number;
  stroke: string;
  fill: string;
  footerLabel: string;
  peakLabel: string;
  latestLabel: string;
}) => {
  const { line, area } = buildPolyline(values);
  const peak = Math.max(...values, 0);
  const latest = values[values.length - 1] || 0;
  const gradientId = `trend-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="rounded-[26px] border border-white/10 bg-slate-950/35 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{total}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{footerLabel}</p>
        </div>
      </div>
      <svg viewBox="0 0 320 150" className="mt-5 h-44 w-full overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity="0.35" />
            <stop offset="100%" stopColor={fill} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <polyline fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={line} />
      </svg>
      <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
        <span>{peakLabel}: {peak}</span>
        <span>{latestLabel}: {latest}</span>
      </div>
    </div>
  );
};

const SessionTrendCard = ({
  title,
  subtitle,
  points,
  hoursLabel,
  sessionsLabel,
}: {
  title: string;
  subtitle: string;
  points: Array<{ label: string; value: number; session_count: number; role: string }>;
  hoursLabel: string;
  sessionsLabel: string;
}) => {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <div className="rounded-[26px] border border-white/10 bg-slate-950/35 p-5">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p>
      <div className="mt-5 space-y-4">
        {points.map((point) => (
          <div key={point.label} className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">{point.label}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{point.role}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-cyan-100">{(point.value / 3600).toFixed(1)} {hoursLabel}</p>
                <p className="text-xs text-slate-400">{point.session_count} {sessionsLabel}</p>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-white/10">
              <div className="h-2.5 rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300" style={{ width: `${(point.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SectionButton = ({
  active,
  label,
  caption,
  onClick,
}: {
  active: boolean;
  label: string;
  caption: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${active ? "border-cyan-300/20 bg-cyan-400/10 text-white shadow-[0_16px_40px_rgba(34,211,238,0.08)]" : "border-white/10 bg-slate-950/35 text-slate-200 hover:bg-white/5"}`}
  >
    <p className="text-sm font-semibold">{label}</p>
    <p className="mt-2 text-sm leading-6 text-slate-400">{caption}</p>
  </button>
);

const SignalPill = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-full border border-white/10 bg-slate-950/35 px-4 py-2.5">
    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span>
    <span className="ml-2 text-sm font-semibold text-white">{value}</span>
  </div>
);

const AdminAnalyticsPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { session, theme } = useAdminLayoutContext();
  const uiLanguage = i18n.resolvedLanguage || i18n.language || "sw";
  const formatMetric = useCallback((value: number) => formatNumber(value, uiLanguage), [uiLanguage]);
  const formatMetricPercent = useCallback((value: number) => formatPercent(value, uiLanguage), [uiLanguage]);
  const momentumLabel = useCallback((slope: number) => {
    const key = describeMomentum(slope);
    if (key === "rising") return t("adminAnalyticsMomentumRising");
    if (key === "falling") return t("adminAnalyticsMomentumFalling");
    return t("adminAnalyticsMomentumStable");
  }, [t]);
  const concentrationLabel = useCallback((share: number) => {
    const key = describeConcentration(share);
    if (key === "highly concentrated") return t("adminAnalyticsConcentrationHigh");
    if (key === "moderately concentrated") return t("adminAnalyticsConcentrationModerate");
    return t("adminAnalyticsConcentrationBroad");
  }, [t]);
  const hhiLabel = (value: number) => {
    const key = describeHhi(value);
    if (key === "high concentration") return t("adminAnalyticsHhiHigh");
    if (key === "moderate concentration") return t("adminAnalyticsHhiModerate");
    return t("adminAnalyticsHhiDistributed");
  };
  const deviationLabel = useCallback((value: number) => {
    const key = describeDeviation(value);
    if (key === "well above typical") return t("adminAnalyticsDeviationWellAbove");
    if (key === "above typical") return t("adminAnalyticsDeviationAbove");
    if (key === "well below typical") return t("adminAnalyticsDeviationWellBelow");
    if (key === "below typical") return t("adminAnalyticsDeviationBelow");
    return t("adminAnalyticsDeviationNear");
  }, [t]);
  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [scope, setScope] = useState<ReportPayload["scope"]>("national");
  const [zone, setZone] = useState("");
  const [region, setRegion] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [issueFilterInput, setIssueFilterInput] = useState("");
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [language, setLanguage] = useState(uiLanguage);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeExamples, setIncludeExamples] = useState(true);
  const [activeView, setActiveView] = useState<AnalyticsView>("summary");
  const [showFilters, setShowFilters] = useState(false);

  const canSeeAnalytics = session.roles.includes("super_admin") || session.roles.includes("analyst");
  const zoneOptions = useMemo(() => zones.map((item) => ({ value: item.name, label: item.name })), [zones]);
  const regionOptions = useMemo(() => regions.map((item) => ({ value: item, label: item })), []);
  const municipalityOptions = useMemo(() => (region ? (regionMunicipalityMap[region] || []).map((item) => ({ value: item, label: item })) : []), [region]);

  const buildPayload = useMemo((): (() => ReportPayload) => {
    return () => ({
      start_at: startAt ? new Date(startAt).toISOString() : null,
      end_at: endAt ? new Date(endAt).toISOString() : null,
      scope,
      zone: zone || null,
      region: region || null,
      municipality: municipality || null,
      include_drafts: includeDrafts,
      issue_types: issueFilterInput.split(",").map((item) => item.trim()).filter(Boolean),
      language,
      include_charts: includeCharts,
      include_examples: includeExamples,
    });
  }, [startAt, endAt, scope, zone, region, municipality, includeDrafts, issueFilterInput, language, includeCharts, includeExamples]);

  const loadOverview = useMemo(() => async () => {
    setLoading(true);
    setError("");
    try {
      const [zonesResponse, overviewResponse] = await Promise.all([
        adminFetch(`${API_BASE}/meta/zones`),
        adminFetch(`${API_BASE}/admin/analytics/overview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        }),
      ]);
      if (!zonesResponse.ok) throw new Error(t("adminAnalyticsZoneLoadError"));
      if (!overviewResponse.ok) {
        const data = (await overviewResponse.json().catch(() => ({}))) as { detail?: string };
        throw new Error(data.detail || t("adminAnalyticsLoadError"));
      }
      const [zonesData, overviewData] = await Promise.all([zonesResponse.json(), overviewResponse.json()]);
      setZones(((zonesData as { zones?: ZoneRecord[] }).zones || []) as ZoneRecord[]);
      setOverview(overviewData as OverviewResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminAnalyticsLoadError"));
    } finally {
      setLoading(false);
    }
  }, [buildPayload, t]);

  useEffect(() => {
    if (!canSeeAnalytics) return;
    void loadOverview();
  }, [canSeeAnalytics, loadOverview]);

  useEffect(() => {
    setLanguage((current) => (current === (i18n.resolvedLanguage || i18n.language || "sw") ? current : i18n.resolvedLanguage || i18n.language || "sw"));
  }, [i18n.language, i18n.resolvedLanguage, uiLanguage]);

  useEffect(() => {
    if (scope === "national") {
      setZone("");
      setRegion("");
      setMunicipality("");
      return;
    }
    if (scope === "zone") {
      setRegion("");
      setMunicipality("");
      return;
    }
    if (scope === "region") {
      setZone("");
      setMunicipality("");
      return;
    }
    setZone("");
  }, [scope]);

  const analytics = useMemo(() => {
    if (!overview) return null;

    const totalRecords = Math.max(overview.totals.all_records, 1);
    const scopeItems =
      scope === "municipality"
        ? overview.breakdowns.municipalities
        : scope === "region"
          ? overview.breakdowns.regions
          : overview.breakdowns.zones;
    const submittedShare = percentage(overview.totals.submitted, totalRecords);
    const draftShare = percentage(overview.totals.drafts, totalRecords);
    const closureRate = percentage(overview.totals.closed, Math.max(overview.totals.submitted, 1));
    const backlogRate = percentage(overview.totals.open, Math.max(overview.totals.submitted, 1));
    const responseGap = Math.max(overview.totals.response_median_days - overview.totals.action_start_median_days, 0);
    const severityIndex = computeSeverityIndex(overview.breakdowns.severities);
    const issueTop3Share = topShare(overview.breakdowns.issue_types, 3);
    const zoneTop2Share = topShare(scopeItems, 2);
    const deskTop2Share = topShare(overview.breakdowns.desks, 2);
    const submittedSeries = overview.recent_trend.map((item) => item.submitted);
    const closedSeries = overview.recent_trend.map((item) => item.closed);
    const createdSeries = overview.recent_trend.map((item) => item.created);
    const createdTotal = createdSeries.reduce((sum, value) => sum + value, 0);
    const submittedTotal = submittedSeries.reduce((sum, value) => sum + value, 0);
    const closedTotal = closedSeries.reduce((sum, value) => sum + value, 0);
    const submittedAverage = average(submittedSeries);
    const submissionVolatility = standardDeviation(submittedSeries);
    const throughputRatio = percentage(closedTotal, Math.max(submittedTotal, 1));
    const submissionCv = submittedAverage ? submissionVolatility / submittedAverage : 0;
    const issueHhi = concentrationIndex(overview.breakdowns.issue_types);
    const geographicHhi = concentrationIndex(scopeItems);
    const deskHhi = concentrationIndex(overview.breakdowns.desks);
    const latestSubmitted = submittedSeries[submittedSeries.length - 1] || 0;
    const latestClosed = closedSeries[closedSeries.length - 1] || 0;
    const latestCreated = createdSeries[createdSeries.length - 1] || 0;
    const submissionSignal = zScore(latestSubmitted, submittedSeries);
    const closureSignal = zScore(latestClosed, closedSeries);
    const intakeSignal = zScore(latestCreated, createdSeries);
    const engagedBase = Math.max(overview.totals.submitted || overview.totals.all_records, 1);
    const workloadIntensity = overview.session_insights.session_count
      ? (overview.session_insights.average_duration_hours * overview.session_insights.session_count) / engagedBase
      : 0;
    const topUserSeconds = overview.session_insights.top_users[0]?.value || 0;
    const topUsersTotalSeconds = overview.session_insights.top_users.reduce((sum, item) => sum + item.value, 0);
    const topUserShare = percentage(topUserSeconds, Math.max(topUsersTotalSeconds, 1));
    const pressureIndex = Math.min(1, average([backlogRate, severityIndex, Math.min(submissionCv, 1), Math.min(responseGap / 10, 1)]));
    const readinessIndex = Math.min(1, average([closureRate, throughputRatio, Math.max(0, 1 - Math.min(responseGap / 10, 1))]));

    return {
      scopeItems,
      submittedShare,
      draftShare,
      closureRate,
      backlogRate,
      severityIndex,
      issueHhi,
      geographicHhi,
      deskHhi,
      submissionVolatility,
      submissionCv,
      throughputRatio,
      submissionSignal,
      closureSignal,
      intakeSignal,
      workloadIntensity,
      topUserShare,
      pressureIndex,
      readinessIndex,
      insights: [
        {
          label: t("adminAnalyticsInsightIssueConcentration"),
          value: formatMetricPercent(issueTop3Share),
          detail: t("adminAnalyticsInsightIssueConcentrationDetail", { share: formatMetricPercent(issueTop3Share), concentration: concentrationLabel(issueTop3Share) }),
        },
        {
          label: t("adminAnalyticsInsightGeographicConcentration"),
          value: formatMetricPercent(zoneTop2Share),
          detail: t("adminAnalyticsInsightGeographicConcentrationDetail", { share: formatMetricPercent(zoneTop2Share) }),
        },
        {
          label: t("adminAnalyticsInsightDeskConcentration"),
          value: formatMetricPercent(deskTop2Share),
          detail: t("adminAnalyticsInsightDeskConcentrationDetail", { share: formatMetricPercent(deskTop2Share) }),
        },
        {
          label: t("adminAnalyticsInsightSeverityIndex"),
          value: formatMetricPercent(severityIndex),
          detail: t("adminAnalyticsInsightSeverityIndexDetail", { value: formatMetricPercent(severityIndex) }),
        },
        {
          label: t("adminAnalyticsInsightResponseFriction"),
          value: `${formatMetric(responseGap)}d`,
          detail: t("adminAnalyticsInsightResponseFrictionDetail", { days: formatMetric(responseGap) }),
        },
        {
          label: t("adminAnalyticsInsightSubmissionVolatility"),
          value: formatMetric(submissionVolatility),
          detail: t("adminAnalyticsInsightSubmissionVolatilityDetail"),
        },
      ],
      narrative: [
        t("adminAnalyticsNarrative1", {
          records: formatMetric(overview.totals.all_records),
          submitted: formatMetric(overview.totals.submitted),
          draftShare: formatMetricPercent(draftShare),
          closureRate: formatMetricPercent(closureRate),
        }),
        t("adminAnalyticsNarrative2", {
          submissionMomentum: momentumLabel(linearSlope(submittedSeries)),
          closureMomentum: momentumLabel(linearSlope(closedSeries)),
          throughputRatio: formatMetricPercent(throughputRatio),
          throughputState: throughputRatio >= 1 ? t("adminAnalyticsThroughputKeepingPace") : t("adminAnalyticsThroughputLagging"),
        }),
        t("adminAnalyticsNarrative3", {
          issueConcentration: concentrationLabel(issueTop3Share),
          issueLeaders: joinLabels(overview.breakdowns.issue_types),
          geographicConcentration: concentrationLabel(zoneTop2Share),
          geographyLeaders: joinLabels(scopeItems, 2),
        }),
        t("adminAnalyticsNarrative4", {
          severityIndex: formatMetricPercent(severityIndex),
          firstAction: formatMetric(overview.totals.action_start_median_days),
          response: formatMetric(overview.totals.response_median_days),
          closureCycle: formatMetric(overview.totals.closure_average_days),
        }),
        t("adminAnalyticsNarrative5", {
          variability: formatMetricPercent(Math.min(submissionCv, 1)),
          submissionSignal: deviationLabel(submissionSignal),
          closureSignal: deviationLabel(closureSignal),
        }),
        t("adminAnalyticsNarrative6", {
          sessions: formatMetric(overview.session_insights.session_count),
          averageDuration: formatMetric(overview.session_insights.average_duration_hours),
          workloadIntensity: formatMetric(workloadIntensity),
        }),
      ],
      momentum: {
        created: describeMomentum(linearSlope(createdSeries)),
        submitted: describeMomentum(linearSlope(submittedSeries)),
        closed: describeMomentum(linearSlope(closedSeries)),
      },
      totals: {
        createdTotal,
        submittedTotal,
        closedTotal,
      },
    };
  }, [formatMetric, formatMetricPercent, overview, scope, t, concentrationLabel, deviationLabel, momentumLabel]);

  if (!canSeeAnalytics) {
    return <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 text-sm text-slate-300">{t("adminAnalyticsAccessDenied")}</div>;
  }

  if (loading || !overview || !analytics) {
    return <div className="rounded-[30px] border border-white/10 bg-white/5 p-10 text-center text-sm text-slate-300">{t("adminAnalyticsLoading")}</div>;
  }

  const scopeLabel =
    scope === "national"
      ? t("adminAnalyticsScopeNational")
      : scope === "zone"
        ? zone || t("adminAnalyticsScopeZone")
        : scope === "region"
          ? region || t("adminAnalyticsScopeRegion")
          : municipality || t("adminAnalyticsScopeMunicipality");
  const languageLabel = supportedLanguages.find((item) => item.code === language)?.label || language;
  const generatedLabel = new Date(overview.generated_at).toLocaleString(uiLanguage || undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const activeFilters = [startAt, endAt, scope !== "national" ? scopeLabel : "", issueFilterInput, includeDrafts ? t("adminAnalyticsDraftsIncludedShort") : ""].filter(Boolean).length;
  const viewOptions: Array<{ value: AnalyticsView; label: string; caption: string }> = [
    { value: "summary", label: t("adminAnalyticsViewSummary"), caption: t("adminAnalyticsViewSummaryCaption") },
    { value: "drivers", label: t("adminAnalyticsViewDrivers"), caption: t("adminAnalyticsViewDriversCaption") },
    { value: "operations", label: t("adminAnalyticsViewOperations"), caption: t("adminAnalyticsViewOperationsCaption") },
    { value: "workforce", label: t("adminAnalyticsViewWorkforce"), caption: t("adminAnalyticsViewWorkforceCaption") },
  ];

  let viewContent: React.ReactNode;
  if (activeView === "summary") {
    viewContent = (
      <>
        <section className="grid gap-4 lg:grid-cols-3">
          <GaugeCard label={t("adminAnalyticsClosureRate")} value={analytics.closureRate} tone="rgba(56,189,248,0.95)" note={t("adminAnalyticsClosureRateNote", { closed: formatMetric(overview.totals.closed), submitted: formatMetric(overview.totals.submitted) })} />
          <GaugeCard label={t("adminAnalyticsBacklogPressure")} value={analytics.backlogRate} tone="rgba(251,191,36,0.95)" note={t("adminAnalyticsBacklogPressureNote", { open: formatMetric(overview.totals.open) })} />
          <GaugeCard label={t("adminAnalyticsDraftShare")} value={analytics.draftShare} tone="rgba(52,211,153,0.95)" note={t("adminAnalyticsDraftShareNote", { drafts: formatMetric(overview.totals.drafts) })} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={t("adminAnalyticsRecordsInScope")} value={formatMetric(overview.totals.all_records)} note={t("adminAnalyticsRecordsInScopeNote", { share: formatMetricPercent(analytics.submittedShare) })} />
          <MetricCard label={t("adminAnalyticsMedianFirstAction")} value={`${formatMetric(overview.totals.action_start_median_days)}d`} note={t("adminAnalyticsMedianFirstActionNote")} />
          <MetricCard label={t("adminAnalyticsMedianResponse")} value={`${formatMetric(overview.totals.response_median_days)}d`} note={t("adminAnalyticsMedianResponseNote")} />
          <MetricCard label={t("adminAnalyticsAverageClosureCycle")} value={`${formatMetric(overview.totals.closure_average_days)}d`} note={t("adminAnalyticsAverageClosureCycleNote")} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_400px]">
          <Panel eyebrow={t("adminAnalyticsStatisticalBriefing")} title={t("adminAnalyticsStatisticalBriefingTitle")} body={t("adminAnalyticsStatisticalBriefingBody")}>
            <div className="space-y-4">
              {analytics.narrative.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-8 text-slate-200">
                  {paragraph}
                </p>
              ))}
            </div>
          </Panel>
          <div className="grid gap-4">
            {analytics.insights.slice(0, 4).map((item) => (
              <InsightCard key={item.label} label={item.label} value={item.value} detail={item.detail} />
            ))}
          </div>
        </section>

        <Panel
          eyebrow={t("adminAnalyticsTrendIntelligence")}
          title={t("adminAnalyticsTrendIntelligenceTitle")}
          body={t("adminAnalyticsTrendIntelligenceBody", {
            created: momentumLabel(linearSlope(overview.recent_trend.map((item) => item.created))),
            submitted: momentumLabel(linearSlope(overview.recent_trend.map((item) => item.submitted))),
            closed: momentumLabel(linearSlope(overview.recent_trend.map((item) => item.closed))),
          })}
        >
          <div className="grid gap-4 xl:grid-cols-3">
            <TrendCard title={t("adminAnalyticsTrendNewRecords")} subtitle={t("adminAnalyticsTrendNewRecordsSubtitle")} values={overview.recent_trend.map((item) => item.created)} total={analytics.totals.createdTotal} stroke="#67e8f9" fill="#22d3ee" footerLabel={t("adminAnalyticsLast14Days")} peakLabel={t("adminAnalyticsPeak")} latestLabel={t("adminAnalyticsLatest")} />
            <TrendCard title={t("adminAnalyticsTrendSubmittedCases")} subtitle={t("adminAnalyticsTrendSubmittedCasesSubtitle")} values={overview.recent_trend.map((item) => item.submitted)} total={analytics.totals.submittedTotal} stroke="#86efac" fill="#34d399" footerLabel={t("adminAnalyticsLast14Days")} peakLabel={t("adminAnalyticsPeak")} latestLabel={t("adminAnalyticsLatest")} />
            <TrendCard title={t("adminAnalyticsTrendClosedCases")} subtitle={t("adminAnalyticsTrendClosedCasesSubtitle")} values={overview.recent_trend.map((item) => item.closed)} total={analytics.totals.closedTotal} stroke="#fbbf24" fill="#f59e0b" footerLabel={t("adminAnalyticsLast14Days")} peakLabel={t("adminAnalyticsPeak")} latestLabel={t("adminAnalyticsLatest")} />
          </div>
        </Panel>
      </>
    );
  } else if (activeView === "drivers") {
    viewContent = (
      <>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard label={t("adminAnalyticsIssueHhi")} value={analytics.issueHhi.toFixed(2)} detail={t("adminAnalyticsIssueHhiDetail", { concentration: hhiLabel(analytics.issueHhi) })} />
          <InsightCard label={t("adminAnalyticsGeographicHhi")} value={analytics.geographicHhi.toFixed(2)} detail={t("adminAnalyticsGeographicHhiDetail", { concentration: hhiLabel(analytics.geographicHhi) })} />
          <InsightCard label={t("adminAnalyticsLatestIntakeSignal")} value={analytics.intakeSignal.toFixed(1)} detail={t("adminAnalyticsLatestIntakeSignalDetail", { signal: deviationLabel(analytics.intakeSignal) })} />
          <InsightCard label={t("adminAnalyticsSubmissionSignal")} value={analytics.submissionSignal.toFixed(1)} detail={t("adminAnalyticsSubmissionSignalDetail", { signal: deviationLabel(analytics.submissionSignal) })} />
        </section>

        <Panel eyebrow={t("adminAnalyticsComplaintDrivers")} title={t("adminAnalyticsComplaintDriversTitle")} body={t("adminAnalyticsComplaintDriversBody")}>
          <div className="grid gap-4 xl:grid-cols-2">
            <RankedBars title={t("adminAnalyticsStakeholderGroups")} subtitle={t("adminAnalyticsStakeholderGroupsSubtitle", { leaders: joinLabels(overview.breakdowns.stakeholder_groups) })} items={overview.breakdowns.stakeholder_groups} accent="linear-gradient(90deg, rgba(34,211,238,0.95), rgba(96,165,250,0.95), rgba(52,211,153,0.95))" />
            <RankedBars title={t("adminAnalyticsIssueTypes")} subtitle={t("adminAnalyticsIssueTypesSubtitle", { concentration: concentrationLabel(topShare(overview.breakdowns.issue_types, 3)) })} items={overview.breakdowns.issue_types} accent="linear-gradient(90deg, rgba(251,191,36,0.95), rgba(249,115,22,0.95), rgba(244,114,182,0.95))" />
            <RankedBars title={t("adminAnalyticsTargetInstitutions")} subtitle={t("adminAnalyticsTargetInstitutionsSubtitle", { leaders: joinLabels(overview.breakdowns.target_entities) })} items={overview.breakdowns.target_entities} accent="linear-gradient(90deg, rgba(96,165,250,0.95), rgba(34,211,238,0.95), rgba(165,180,252,0.95))" />
            <RankedBars title={t("adminAnalyticsGeographicHotspots")} subtitle={t("adminAnalyticsGeographicHotspotsSubtitle", { leaders: joinLabels(analytics.scopeItems) })} items={analytics.scopeItems} accent="linear-gradient(90deg, rgba(52,211,153,0.95), rgba(45,212,191,0.95), rgba(34,197,94,0.95))" />
          </div>
        </Panel>

        <Panel eyebrow={t("adminAnalyticsDriverInterpretation")} title={t("adminAnalyticsDriverInterpretationTitle")} body={t("adminAnalyticsDriverInterpretationBody")}>
          <div className="space-y-4 text-sm leading-8 text-slate-200">
            <p>{t("adminAnalyticsDriverParagraph1", { concentration: concentrationLabel(topShare(overview.breakdowns.issue_types, 3)), score: analytics.issueHhi.toFixed(2), hhi: hhiLabel(analytics.issueHhi) })}</p>
            <p>{t("adminAnalyticsDriverParagraph2", { concentration: concentrationLabel(topShare(analytics.scopeItems, 2)), leaders: joinLabels(analytics.scopeItems, 2) })}</p>
            <p>{t("adminAnalyticsDriverParagraph3", { intake: deviationLabel(analytics.intakeSignal), submitted: deviationLabel(analytics.submissionSignal) })}</p>
          </div>
        </Panel>
      </>
    );
  } else if (activeView === "operations") {
    viewContent = (
      <>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={t("adminAnalyticsPressureIndex")} value={formatMetricPercent(analytics.pressureIndex)} note={t("adminAnalyticsPressureIndexNote")} />
          <MetricCard label={t("adminAnalyticsReadinessIndex")} value={formatMetricPercent(analytics.readinessIndex)} note={t("adminAnalyticsReadinessIndexNote")} />
          <MetricCard label={t("adminAnalyticsThroughputRatio")} value={formatMetricPercent(analytics.throughputRatio)} note={t("adminAnalyticsThroughputRatioNote")} />
          <MetricCard label={t("adminAnalyticsResponseGap")} value={`${formatMetric(Math.max(overview.totals.response_median_days - overview.totals.action_start_median_days, 0))}d`} note={t("adminAnalyticsResponseGapNote")} />
        </section>

        <Panel eyebrow={t("adminAnalyticsOperationalStructure")} title={t("adminAnalyticsOperationalStructureTitle")} body={t("adminAnalyticsOperationalStructureBody")}>
          <div className="grid gap-4 xl:grid-cols-3">
            <RankedBars title={t("adminAnalyticsStatuses")} subtitle={t("adminAnalyticsStatusesSubtitle")} items={overview.breakdowns.statuses} accent="linear-gradient(90deg, rgba(34,211,238,0.95), rgba(59,130,246,0.95))" />
            <RankedBars title={t("adminAnalyticsSeverity")} subtitle={t("adminAnalyticsSeveritySubtitle", { value: formatMetricPercent(analytics.severityIndex) })} items={overview.breakdowns.severities} accent="linear-gradient(90deg, rgba(251,191,36,0.95), rgba(248,113,113,0.95))" />
            <RankedBars title={t("adminAnalyticsDeskDistribution")} subtitle={t("adminAnalyticsDeskDistributionSubtitle", { leaders: joinLabels(overview.breakdowns.desks) })} items={overview.breakdowns.desks} accent="linear-gradient(90deg, rgba(52,211,153,0.95), rgba(34,211,238,0.95))" />
          </div>
        </Panel>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Panel eyebrow={t("adminAnalyticsOperationalReading")} title={t("adminAnalyticsOperationalReadingTitle")} body={t("adminAnalyticsOperationalReadingBody")}>
            <div className="space-y-4 text-sm leading-8 text-slate-200">
              <p>{t("adminAnalyticsOperationalParagraph1", { value: formatMetricPercent(analytics.pressureIndex) })}</p>
              <p>{t("adminAnalyticsOperationalParagraph2", { hhi: hhiLabel(analytics.deskHhi), leaders: joinLabels(overview.breakdowns.desks, 2) })}</p>
              <p>{t("adminAnalyticsOperationalParagraph3", { days: formatMetric(Math.max(overview.totals.response_median_days - overview.totals.action_start_median_days, 0)) })}</p>
              {overview.recommendations.map((item, index) => (
                <p key={item}>
                  <span className="font-semibold text-white">{t("adminAnalyticsOperationalNote", { count: index + 1 })} </span>{item}
                </p>
              ))}
            </div>
          </Panel>

          {overview.case_examples.length ? (
            <Panel eyebrow={t("adminAnalyticsAnonymizedCaseReading")} title={t("adminAnalyticsAnonymizedCaseReadingTitle")} body={t("adminAnalyticsAnonymizedCaseReadingBody")}>
              <div className="space-y-4">
                {overview.case_examples.slice(0, 3).map((example, index) => (
                  <div key={`${example.zone}-${example.region}-${example.summary}`} className="rounded-[22px] border border-white/10 bg-slate-950/35 p-4">
                    <p className="text-sm font-semibold text-white">{t("adminAnalyticsExampleLabel", { count: index + 1, severity: example.severity, status: example.status, zone: example.zone })}</p>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{example.summary}</p>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
        </section>
      </>
    );
  } else {
    viewContent = (
      <>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={t("adminAnalyticsTrackedSessions")} value={formatMetric(overview.session_insights.session_count)} note={t("adminAnalyticsTrackedSessionsNote")} />
          <MetricCard label={t("adminAnalyticsAverageSessionLength")} value={`${formatMetric(overview.session_insights.average_duration_hours)} ${t("adminAnalyticsHoursShort")}`} note={t("adminAnalyticsAverageSessionLengthNote")} />
          <MetricCard label={t("adminAnalyticsMedianSessionLength")} value={`${formatMetric(overview.session_insights.median_duration_hours)} ${t("adminAnalyticsHoursShort")}`} note={t("adminAnalyticsMedianSessionLengthNote")} />
          <MetricCard label={t("adminAnalyticsTopUserShare")} value={formatMetricPercent(analytics.topUserShare)} note={t("adminAnalyticsTopUserShareNote")} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_0.9fr]">
          <Panel eyebrow={t("adminAnalyticsWorkforceUsage")} title={t("adminAnalyticsWorkforceUsageTitle")} body={t("adminAnalyticsWorkforceUsageBody")}>
            <div className="space-y-4 text-sm leading-8 text-slate-200">
              <p>{t("adminAnalyticsWorkforceParagraph1", { sessions: formatMetric(overview.session_insights.session_count), average: formatMetric(overview.session_insights.average_duration_hours), median: formatMetric(overview.session_insights.median_duration_hours) })}</p>
              <p>{t("adminAnalyticsWorkforceParagraph2", { share: formatMetricPercent(analytics.topUserShare), intensity: formatMetric(analytics.workloadIntensity) })}</p>
              <p>{t("adminAnalyticsWorkforceParagraph3", { signal: deviationLabel(analytics.closureSignal) })}</p>
            </div>
          </Panel>
          {overview.session_insights.top_users.length ? (
            <SessionTrendCard title={t("adminAnalyticsTopActiveUsers")} subtitle={t("adminAnalyticsTopActiveUsersSubtitle")} points={overview.session_insights.top_users} hoursLabel={t("adminAnalyticsHoursShort")} sessionsLabel={t("adminAnalyticsSessionsShort")} />
          ) : (
            <div className="rounded-[26px] border border-white/10 bg-slate-950/35 p-5 text-sm leading-7 text-slate-300">{t("adminAnalyticsNoRankedSessionActivity")}</div>
          )}
        </section>

        <Panel eyebrow={t("adminAnalyticsUsageInterpretation")} title={t("adminAnalyticsUsageInterpretationTitle")} body={t("adminAnalyticsUsageInterpretationBody")}>
          <div className="grid gap-4 md:grid-cols-3">
            <InsightCard label={t("adminAnalyticsWorkloadIntensity")} value={formatMetric(analytics.workloadIntensity)} detail={t("adminAnalyticsWorkloadIntensityDetail")} />
            <InsightCard label={t("adminAnalyticsClosureSignal")} value={analytics.closureSignal.toFixed(1)} detail={t("adminAnalyticsClosureSignalDetail", { signal: deviationLabel(analytics.closureSignal) })} />
            <InsightCard label={t("adminAnalyticsDeskConcentration")} value={analytics.deskHhi.toFixed(2)} detail={t("adminAnalyticsDeskConcentrationDetail", { concentration: hhiLabel(analytics.deskHhi) })} />
          </div>
        </Panel>
      </>
    );
  }

  const topShellClass =
    theme === "light"
      ? "border border-slate-200 bg-[linear-gradient(145deg,#ffffff,#eef6ff)] text-slate-950 shadow-[0_20px_60px_rgba(148,163,184,0.16)]"
      : "border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_28%),linear-gradient(160deg,rgba(7,20,38,0.98),rgba(8,31,47,0.94),rgba(10,18,34,0.98))] text-white shadow-[0_24px_80px_rgba(2,6,23,0.34)]";
  const infoCardClass = theme === "light" ? "border border-slate-200/80 bg-white/90 text-slate-950" : "border border-white/10 bg-white/5 text-white";
  const mutedClass = theme === "light" ? "text-slate-600" : "text-slate-300";
  const subtleClass = theme === "light" ? "text-slate-500" : "text-slate-400";

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className={`overflow-hidden rounded-[34px] p-6 sm:p-8 ${topShellClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-4xl">
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{t("adminAnalyticsHeroEyebrow")}</p>
            <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{t("adminAnalyticsHeroTitle")}</h1>
            <p className={`mt-4 max-w-3xl text-sm leading-7 sm:text-base ${mutedClass}`}>{t("adminAnalyticsHeroDesc")}</p>
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:min-w-[300px]">
            <button type="button" onClick={() => void loadOverview()} className="rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950">{t("adminAnalyticsRefresh")}</button>
            <button type="button" onClick={() => navigate("/dashboard/analytics/report", { state: { payload: buildPayload() } })} className="rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-5 py-3 text-sm font-semibold text-slate-950">{t("adminAnalyticsGeneratePrintableReport")}</button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_360px]">
          <div className={`rounded-[28px] p-5 ${infoCardClass}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${subtleClass}`}>{t("adminAnalyticsExecutiveRead")}</p>
            <p className={`mt-4 text-sm leading-7 ${mutedClass}`}>{overview.executive_summary}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <SignalPill label={t("adminAnalyticsScopeLabel")} value={scopeLabel} />
              <SignalPill label={t("adminAnalyticsGeneratedLabel")} value={generatedLabel} />
              <SignalPill label={t("adminAnalyticsPressureIndex")} value={formatMetricPercent(analytics.pressureIndex)} />
              <SignalPill label={t("adminAnalyticsReadinessIndex")} value={formatMetricPercent(analytics.readinessIndex)} />
            </div>
          </div>

          <div className={`rounded-[28px] p-5 ${infoCardClass}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${theme === "light" ? "text-amber-700" : "text-amber-200"}`}>{t("adminAnalyticsCurrentReportSetup")}</p>
            <div className={`mt-4 space-y-3 text-sm leading-7 ${mutedClass}`}>
              <p><span className="font-semibold">{t("adminAnalyticsLanguageLabel")}:</span> {languageLabel}</p>
              <p><span className="font-semibold">{t("adminAnalyticsActiveFiltersLabel")}:</span> {activeFilters}</p>
              <p><span className="font-semibold">{t("adminAnalyticsModeLabel")}:</span> {includeDrafts ? t("adminAnalyticsDraftsIncluded") : t("adminAnalyticsSubmittedFocus")}</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setIncludeCharts((current) => !current)} className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${includeCharts ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300"}`}>{includeCharts ? t("adminAnalyticsChartsIncluded") : t("adminAnalyticsChartsExcluded")}</button>
              <button type="button" onClick={() => setIncludeExamples((current) => !current)} className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${includeExamples ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-white/5 text-slate-300"}`}>{includeExamples ? t("adminAnalyticsExamplesIncluded") : t("adminAnalyticsExamplesExcluded")}</button>
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <section className={`rounded-[32px] p-5 sm:p-6 ${infoCardClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{t("adminAnalyticsAnalysisViews")}</p>
            <h2 className="mt-3 text-2xl font-bold">{t("adminAnalyticsAnalysisViewsTitle")}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowFilters((current) => !current)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${theme === "light" ? "border-slate-200 bg-slate-100 text-slate-700" : "border-white/10 bg-white/5 text-white"}`}>
              {showFilters ? t("adminAnalyticsHideFilters") : t("adminAnalyticsShowFilters")}
            </button>
            <button
              type="button"
              onClick={() => {
                setStartAt("");
                setEndAt("");
                setScope("national");
                setZone("");
                setRegion("");
                setMunicipality("");
                setIssueFilterInput("");
                setIncludeDrafts(false);
                setIncludeCharts(true);
                setIncludeExamples(true);
              }}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${theme === "light" ? "border-slate-200 bg-white text-slate-700" : "border-white/10 bg-slate-950/35 text-slate-200"}`}
            >
              {t("adminAnalyticsResetReportInputs")}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          {viewOptions.map((item) => (
            <SectionButton key={item.value} active={activeView === item.value} label={item.label} caption={item.caption} onClick={() => setActiveView(item.value)} />
          ))}
        </div>
      </section>

      {showFilters ? (
        <Panel eyebrow={t("adminAnalyticsReportFilters")} title={t("adminAnalyticsReportFiltersTitle")} body={t("adminAnalyticsReportFiltersBody")}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white">{t("adminAnalyticsReportStart")}</span>
              <input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white">{t("adminAnalyticsReportEnd")}</span>
              <input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white">{t("adminAnalyticsScopeField")}</span>
              <AnimatedSelect value={scope} options={[{ value: "national", label: t("adminAnalyticsScopeNational") }, { value: "zone", label: t("adminAnalyticsScopeZone") }, { value: "region", label: t("adminAnalyticsScopeRegion") }, { value: "municipality", label: t("adminAnalyticsScopeMunicipality") }]} onChange={(value) => setScope(value as ReportPayload["scope"])} lightMode={theme === "light"} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white">{t("adminAnalyticsExportLanguage")}</span>
              <AnimatedSelect value={language} options={supportedLanguages.map((item) => ({ value: item.code, label: item.label, note: item.displayName }))} onChange={setLanguage} lightMode={theme === "light"} />
            </label>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {scope === "zone" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white">{t("adminAnalyticsZoneField")}</span>
                <AnimatedSelect value={zone} options={zoneOptions} onChange={setZone} placeholder={t("adminAnalyticsChooseZone")} lightMode={theme === "light"} />
              </label>
            ) : null}
            {scope === "region" || scope === "municipality" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white">{t("adminAnalyticsRegionField")}</span>
                <AnimatedSelect value={region} options={regionOptions} onChange={(value) => { setRegion(value); setMunicipality(""); }} placeholder={t("adminAnalyticsChooseRegion")} lightMode={theme === "light"} />
              </label>
            ) : null}
            {scope === "municipality" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white">{t("adminAnalyticsMunicipalityField")}</span>
                <AnimatedSelect value={municipality} options={municipalityOptions} onChange={setMunicipality} placeholder={t("adminAnalyticsChooseMunicipality")} lightMode={theme === "light"} />
              </label>
            ) : null}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white">{t("adminAnalyticsIssueFilter")}</span>
              <input type="text" value={issueFilterInput} onChange={(event) => setIssueFilterInput(event.target.value)} placeholder={t("adminAnalyticsIssueFilterPlaceholder")} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
            </label>
            <button type="button" onClick={() => setIncludeDrafts((current) => !current)} className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${includeDrafts ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-slate-950/35 text-slate-300"}`}>{includeDrafts ? t("adminAnalyticsDraftsIncluded") : t("adminAnalyticsSubmittedOnly")}</button>
            <button type="button" onClick={() => void loadOverview()} className="rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950">{t("adminAnalyticsApplyFilters")}</button>
          </div>
        </Panel>
      ) : null}

      <div className="space-y-6">{viewContent}</div>
    </div>
  );
};

export default AdminAnalyticsPage;

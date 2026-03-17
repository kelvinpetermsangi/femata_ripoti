import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { API_BASE } from "../lib/apiBase";
import { adminFetch } from "../lib/adminAuth";
import { supportedLanguages } from "../i18n";

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

type ReportResponse = {
  language: string;
  include_charts: boolean;
  include_examples: boolean;
  header: {
    organization_name: string | null;
    organization_address: string | null;
    organization_email: string | null;
    organization_phone: string | null;
    organization_logo_url: string | null;
  };
  analyst: {
    full_name: string | null;
    role_title: string | null;
    signature_image_url: string | null;
    generated_at: string;
  };
  overview: {
    generated_at: string;
    executive_summary: string;
    scope: {
      start_at: string | null;
      end_at: string | null;
      timezone: string;
      label: string;
    };
  };
  sections: Array<{
    key: string;
    title: string;
    description: string;
    insight: string;
    implication: string;
    narrative: string[];
    items: Array<{ label: string; value: number; detail?: string }>;
    secondary_items?: Array<{ label: string; value: number; detail?: string }>;
  }>;
  case_examples: Array<{ summary: string; severity: string; status: string; zone: string; region: string; municipality: string }>;
  recommendations: string[];
};

const describeTopItems = (
  items: Array<{ label: string; value: number }>,
  t: (key: string, options?: Record<string, unknown>) => string,
  limit = 3,
) => {
  const visible = items.slice(0, limit);
  if (!visible.length) return t("adminAnalyticsReportNoDominantValues");
  const parts = visible.map((item) => `${item.label} (${item.value})`);
  if (parts.length === 1) return t("adminAnalyticsReportTopItemsOne", { item: parts[0] });
  if (parts.length === 2) return t("adminAnalyticsReportTopItemsTwo", { first: parts[0], second: parts[1] });
  return t("adminAnalyticsReportTopItemsMany", { items: parts.slice(0, -1).join(", "), last: parts[parts.length - 1] });
};

const AdminAnalyticsReportPage = () => {
  const { i18n, t } = useTranslation();
  const location = useLocation();
  const payload = useMemo(() => ((location.state as { payload?: ReportPayload } | null)?.payload ?? null), [location.state]);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reportT = useMemo(() => i18n.getFixedT(report?.language || i18n.resolvedLanguage || i18n.language || "sw"), [i18n, report?.language]);

  useEffect(() => {
    if (!payload) {
      setLoading(false);
      setError(t("adminAnalyticsReportOpenFromDashboard"));
      return;
    }
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await adminFetch(`${API_BASE}/admin/analytics/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await response.json().catch(() => ({}))) as ReportResponse & { detail?: string };
        if (!response.ok) throw new Error(data.detail || t("adminAnalyticsReportGenerateError"));
        if (!active) return;
        setReport(data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : t("adminAnalyticsReportGenerateError"));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [payload, t]);

  const languageLabel = supportedLanguages.find((item) => item.code === report?.language)?.label || report?.language || "";

  if (loading) {
    return <div className="min-h-screen bg-white px-4 py-10 text-slate-900"><div className="mx-auto max-w-5xl rounded-[28px] border border-slate-200 p-10 text-center">{reportT("adminAnalyticsReportPreparing")}</div></div>;
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-white px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-5xl rounded-[28px] border border-rose-200 bg-rose-50 p-10">
          <p className="text-lg font-semibold">{error || reportT("adminAnalyticsReportOpenError")}</p>
          <Link to="/dashboard/analytics" className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            {reportT("adminAnalyticsReportBackToAnalytics")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6 text-slate-900 print:bg-white print:px-0 print:py-0">
      <style>{`@media print {.print-hidden{display:none !important;} .print-card{box-shadow:none !important; border-color:#d4d4d8 !important; break-inside:avoid;}}`}</style>
      <div className="mx-auto max-w-5xl space-y-6" style={{ fontFamily: '"Georgia","Times New Roman",serif' }}>
        <div className="print-hidden flex flex-wrap items-center justify-between gap-3">
          <Link to="/dashboard/analytics" className="inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            {reportT("adminAnalyticsReportBackToAnalytics")}
          </Link>
          <button type="button" onClick={() => window.print()} className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            {reportT("adminAnalyticsReportPrint")}
          </button>
        </div>

        <article className="space-y-8">
          <header className="print-card rounded-[18px] border border-slate-300 px-10 py-12">
            <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-300 pb-8">
              <div className="flex items-start gap-5">
                {report.header.organization_logo_url ? <img src={report.header.organization_logo_url} alt={reportT("adminAnalyticsReportOrganizationLogo")} className="h-20 w-20 object-contain" /> : null}
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">{report.header.organization_name || "FEMATA"}</p>
                  <h1 className="mt-4 text-4xl font-semibold leading-tight">{reportT("adminAnalyticsReportTitle")}</h1>
                  <p className="mt-4 text-sm leading-7 text-slate-700">{report.header.organization_address || reportT("adminAnalyticsReportNoOfficeAddress")}</p>
                  <p className="mt-1 text-sm leading-7 text-slate-700">{report.header.organization_email || reportT("adminAnalyticsReportNoOfficeEmail")} | {report.header.organization_phone || reportT("adminAnalyticsReportNoOfficePhone")}</p>
                </div>
              </div>
              <div className="max-w-sm text-sm leading-7 text-slate-700">
                <p><span className="font-semibold">{reportT("adminAnalyticsReportDateGenerated")}:</span> {new Date(report.analyst.generated_at).toLocaleDateString(report.language || undefined)}</p>
                <p><span className="font-semibold">{reportT("adminAnalyticsReportTimeGenerated")}:</span> {new Date(report.analyst.generated_at).toLocaleTimeString(report.language || undefined)}</p>
                <p><span className="font-semibold">{reportT("adminAnalyticsReportExportLanguage")}:</span> {languageLabel}</p>
                <p><span className="font-semibold">{reportT("adminAnalyticsReportPreparedBy")}:</span> {report.analyst.full_name || reportT("adminAnalyticsReportUnattributedAnalyst")}</p>
                <p><span className="font-semibold">{reportT("adminAnalyticsReportRole")}:</span> {report.analyst.role_title || reportT("adminAnalyticsReportAnalystRole")}</p>
              </div>
            </div>

            <div className="mt-8 space-y-4 text-[15px] leading-8 text-slate-800">
              <p><span className="font-semibold">{reportT("adminAnalyticsReportReportingPeriod")}:</span> {reportT("adminAnalyticsReportReportingPeriodBody", { start: report.overview.scope.start_at ? new Date(report.overview.scope.start_at).toLocaleString(report.language || undefined) : reportT("adminAnalyticsReportSystemStart"), end: report.overview.scope.end_at ? new Date(report.overview.scope.end_at).toLocaleString(report.language || undefined) : reportT("adminAnalyticsReportNow") })}</p>
              <p><span className="font-semibold">{reportT("adminAnalyticsReportTimezone")}:</span> {report.overview.scope.timezone}.</p>
              <p><span className="font-semibold">{reportT("adminAnalyticsReportGeographicScope")}:</span> {report.overview.scope.label}.</p>
            </div>

            <section className="mt-10">
              <h2 className="text-2xl font-semibold">{reportT("adminAnalyticsReportExecutiveSummary")}</h2>
              <p className="mt-4 text-[15px] leading-8 text-slate-800">{report.overview.executive_summary}</p>
            </section>
          </header>

          {report.sections.map((section, index) => (
            <section key={section.key} className="print-card rounded-[18px] border border-slate-300 px-10 py-10">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">{reportT("adminAnalyticsReportSectionLabel", { count: index + 1 })}</p>
              <h2 className="mt-3 text-2xl font-semibold leading-tight">{section.title}</h2>
              <div className="mt-6 space-y-4">
                {section.narrative.map((paragraph) => (
                  <p key={`${section.key}-${paragraph.slice(0, 40)}`} className="text-[15px] leading-8 text-slate-800">
                    {paragraph}
                  </p>
                ))}
              </div>

              {report.include_charts && section.items.length ? (
                <figure className="mt-8 border-t border-slate-200 pt-6">
                  <figcaption className="text-sm italic leading-7 text-slate-600">
                    {reportT("adminAnalyticsReportFigureLabel", { count: index + 1, title: section.title, summary: describeTopItems(section.items, reportT) })}
                  </figcaption>
                  <div className="mt-5 space-y-4">
                    {section.items.slice(0, 6).map((item) => {
                      const max = Math.max(...section.items.map((entry) => entry.value), 1);
                      return (
                        <div key={`${section.key}-${item.label}`} className="space-y-1.5">
                          <div className="flex items-baseline justify-between gap-3 text-sm leading-6 text-slate-800">
                            <span>{item.label}</span>
                            <span className="font-semibold">{item.value}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200">
                            <div className="h-2 rounded-full bg-slate-700" style={{ width: `${(item.value / max) * 100}%` }} />
                          </div>
                          {item.detail ? <p className="text-xs leading-6 text-slate-500">{item.detail}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                </figure>
              ) : null}

              {section.secondary_items?.length ? (
                <p className="mt-6 text-[15px] leading-8 text-slate-800">
                  {reportT("adminAnalyticsReportSupplementaryView", { summary: describeTopItems(section.secondary_items, reportT) })}
                </p>
              ) : null}
            </section>
          ))}

          {report.case_examples.length ? (
            <section className="print-card rounded-[18px] border border-slate-300 px-10 py-10">
              <h2 className="text-2xl font-semibold">{reportT("adminAnalyticsReportExampleIncidents")}</h2>
              <p className="mt-4 text-[15px] leading-8 text-slate-800">{reportT("adminAnalyticsReportExampleIncidentsBody")}</p>
              <div className="mt-6 space-y-6">
                {report.case_examples.map((example, index) => (
                  <div key={`${example.zone}-${example.summary}`} className="space-y-2 border-l-2 border-slate-300 pl-5">
                    <p className="text-sm font-semibold text-slate-700">{reportT("adminAnalyticsReportExampleItem", { count: index + 1, severity: example.severity, status: example.status, zone: example.zone })}</p>
                    <p className="text-[15px] leading-8 text-slate-800">{example.summary}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="print-card rounded-[18px] border border-slate-300 px-10 py-10">
            <h2 className="text-2xl font-semibold">{reportT("adminAnalyticsReportRecommendations")}</h2>
            <div className="mt-6 space-y-4">
              {report.recommendations.map((item, index) => (
                <p key={item} className="text-[15px] leading-8 text-slate-800">
                  <span className="font-semibold">{reportT("adminAnalyticsReportRecommendationItem", { count: index + 1 })} </span>{item}
                </p>
              ))}
            </div>
          </section>

          <section className="print-card rounded-[18px] border border-slate-300 px-10 py-10">
            <h2 className="text-2xl font-semibold">{reportT("adminAnalyticsReportSignature")}</h2>
            <div className="mt-6 space-y-4 text-[15px] leading-8 text-slate-800">
              <p>{reportT("adminAnalyticsReportSignatureBody1")}</p>
              <p>{reportT("adminAnalyticsReportSignatureBody2", { name: report.analyst.full_name || reportT("adminAnalyticsReportAnalystNameNotSet"), role: report.analyst.role_title || reportT("adminAnalyticsReportAnalystRole"), time: new Date(report.analyst.generated_at).toLocaleString(report.language || undefined) })}</p>
              <p>{reportT("adminAnalyticsReportSignatureBody3")}</p>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
              <div className="border-t border-slate-300 pt-6">
                <p className="text-sm font-semibold">{report.analyst.full_name || reportT("adminAnalyticsReportAnalystNameNotSet")}</p>
                <p className="mt-1 text-sm text-slate-600">{report.analyst.role_title || reportT("adminAnalyticsReportAnalystRole")}</p>
              </div>
              <div className="min-h-[120px] border-b border-slate-300 pb-4">
                {report.analyst.signature_image_url ? <img src={report.analyst.signature_image_url} alt={reportT("adminAnalyticsReportAnalystSignature")} className="h-24 w-full object-contain" /> : <div className="flex h-24 items-end justify-center text-xs uppercase tracking-[0.18em] text-slate-400">{reportT("adminAnalyticsReportSignaturePending")}</div>}
              </div>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
};

export default AdminAnalyticsReportPage;

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { API_BASE } from "../lib/apiBase";
import {
  ADMIN_CASE_STATUSES,
  translateAdminDesk,
  translateAdminStatus,
  translateBooleanValue,
} from "../lib/adminI18n";

type AdditionalInfoItem = {
  id: string;
  message: string;
  created_at: string;
  source: string;
};

type TrackResult = {
  reference_number: string;
  status: string;
  assigned_desk: string;
  feedback: string;
  updated_at: string;
  action_started?: boolean;
  public_access_expires_at?: string | null;
  additional_information: AdditionalInfoItem[];
};

type TrackedQueueItem = {
  reference_number: string;
  status: string;
  assigned_desk: string;
  updated_at: string;
};

type LookupErrorState = {
  kind: "not_found" | "closed" | "expired" | "generic";
  title: string;
  body: string;
};

const TRACK_QUEUE_STORAGE_KEY = "femata_public_track_queue";
const publicStatusOrder: string[] = [...ADMIN_CASE_STATUSES];

const toneForStatus = (status: string) =>
  status === "Imefungwa"
    ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
    : status === "Majibu yapo"
      ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-200"
      : "border-amber-300/20 bg-amber-400/10 text-amber-200";

const readTrackedQueue = (): TrackedQueueItem[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(TRACK_QUEUE_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is TrackedQueueItem =>
          Boolean(item) &&
          typeof item.reference_number === "string" &&
          typeof item.status === "string" &&
          typeof item.assigned_desk === "string" &&
          typeof item.updated_at === "string",
      )
      .slice(0, 12);
  } catch {
    return [];
  }
};

const writeTrackedQueue = (items: TrackedQueueItem[]) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(TRACK_QUEUE_STORAGE_KEY, JSON.stringify(items.slice(0, 12)));
  } catch {
    // Ignore storage failures and keep the in-memory state.
  }
};

const upsertTrackedQueueItem = (items: TrackedQueueItem[], result: TrackResult): TrackedQueueItem[] => {
  const nextItem: TrackedQueueItem = {
    reference_number: result.reference_number,
    status: result.status,
    assigned_desk: result.assigned_desk,
    updated_at: result.updated_at,
  };

  return [nextItem, ...items.filter((item) => item.reference_number !== result.reference_number)].slice(0, 12);
};

const removeTrackedQueueItem = (items: TrackedQueueItem[], reference: string) =>
  items.filter((item) => item.reference_number !== reference);

const formatTimestamp = (value: string, language: string) => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString(language || undefined);
};

const fetchTrackedReport = async (reference: string): Promise<TrackResult> => {
  const response = await fetch(`${API_BASE}/track-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference_number: reference }),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<TrackResult> & { detail?: string };
  if (!response.ok) throw new Error(data.detail || "Lookup failed");

  return {
    reference_number: data.reference_number ?? reference,
    status: data.status ?? publicStatusOrder[0],
    assigned_desk: data.assigned_desk ?? "Intake Desk",
    feedback: data.feedback ?? "",
    updated_at: data.updated_at ?? "",
    action_started: data.action_started ?? false,
    public_access_expires_at: data.public_access_expires_at ?? null,
    additional_information: Array.isArray(data.additional_information) ? data.additional_information : [],
  };
};

const TrackDashboardPage = () => {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlReference = (searchParams.get("reference") ?? "").trim().toUpperCase();
  const loadingPhrases = useMemo(
    () => [
      t("trackLoadingPhrase1", "Verifying reference integrity"),
      t("trackLoadingPhrase2", "Opening secure follow-up channel"),
      t("trackLoadingPhrase3", "Preparing case timeline"),
    ],
    [t],
  );
  const destroyPhrases = useMemo(
    () => [
      t("trackDestroyPhrase1", "Removing public login access"),
      t("trackDestroyPhrase2", "Archiving this reference privately"),
      t("trackDestroyPhrase3", "Closing public follow-up window"),
    ],
    [t],
  );

  const [referenceNumber, setReferenceNumber] = useState(urlReference);
  const [trackResult, setTrackResult] = useState<TrackResult | null>(null);
  const [trackedQueue, setTrackedQueue] = useState<TrackedQueueItem[]>([]);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [lookupError, setLookupError] = useState<LookupErrorState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const [showAddInfoPanel, setShowAddInfoPanel] = useState(false);
  const [additionalInfoText, setAdditionalInfoText] = useState("");
  const [addInfoLoading, setAddInfoLoading] = useState(false);
  const [addInfoMessage, setAddInfoMessage] = useState("");
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [closingReference, setClosingReference] = useState(false);
  const [destroyPhraseIndex, setDestroyPhraseIndex] = useState(0);
  const [closureComplete, setClosureComplete] = useState(false);

  useEffect(() => {
    setTrackedQueue(readTrackedQueue());
  }, []);

  useEffect(() => {
    setReferenceNumber(urlReference);
  }, [urlReference]);

  useEffect(() => {
    if (!loading) return undefined;

    const interval = window.setInterval(() => {
      setLoadingPhraseIndex((current) => (current + 1) % loadingPhrases.length);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [loading, loadingPhrases]);

  useEffect(() => {
    if (!closingReference) return undefined;

    const interval = window.setInterval(() => {
      setDestroyPhraseIndex((current) => (current + 1) % destroyPhrases.length);
    }, 950);

    return () => window.clearInterval(interval);
  }, [closingReference, destroyPhrases]);

  const makeLookupError = (message: string): LookupErrorState => {
    const normalized = message.toLowerCase();
    if (normalized.includes("closed for public tracking")) {
      return {
        kind: "closed",
        title: t("trackLookupClosedTitle", "This reference is no longer available for public login"),
        body: t(
          "trackLookupClosedBody",
          "This case was closed from the public tracking side, so it can no longer be opened again with the same reference number. FEMATA administrators can still see the protected institutional record.",
        ),
      };
    }
    if (normalized.includes("expired")) {
      return {
        kind: "expired",
        title: t("trackLookupExpiredTitle", "The public follow-up window has expired"),
        body: t(
          "trackLookupExpiredBody",
          "This reference can no longer be viewed from the public tracker. If you still need support or want to continue the matter, please submit a new confidential report.",
        ),
      };
    }
    if (normalized.includes("not found")) {
      return {
        kind: "not_found",
        title: t("trackLookupNotFoundTitle", "No query was found with this reference number"),
        body: t(
          "trackLookupNotFoundBody",
          "Please check the number and try again. If you misplaced the correct reference or still need help, you can submit a new confidential query and FEMATA will handle it with discretion.",
        ),
      };
    }
    return {
      kind: "generic",
      title: t("trackLookupGenericTitle", "We could not open this query right now"),
      body: t(
        "trackLookupGenericBody",
        "The tracker could not load this reference at the moment. Please try again shortly or submit a new confidential report if you still need help.",
      ),
    };
  };

  const resetToLookup = () => {
    setShowWorkspace(false);
    setTrackResult(null);
    setLookupError(null);
    setReferenceNumber("");
    setAdditionalInfoText("");
    setAddInfoMessage("");
    setShowAddInfoPanel(false);
    setSearchParams({}, { replace: true });
  };

  const loadReference = async (reference: string) => {
    setShowWorkspace(true);
    setLoading(true);
    setLookupError(null);
    setTrackResult(null);
    setAddInfoMessage("");
    setShowAddInfoPanel(false);
    setSearchParams({ reference }, { replace: true });

    try {
      const result = await fetchTrackedReport(reference);
      setTrackResult(result);
      setTrackedQueue((current) => {
        const next = upsertTrackedQueueItem(current, result);
        writeTrackedQueue(next);
        return next;
      });
    } catch (err) {
      setLookupError(makeLookupError(err instanceof Error ? err.message : t("trackError")));
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async () => {
    const trimmedRef = referenceNumber.trim().toUpperCase();
    if (!trimmedRef) {
      setLookupError({
        kind: "generic",
        title: t("trackReferenceRequiredTitle", "Reference number required"),
        body: t("trackAlert1"),
      });
      setShowWorkspace(true);
      return;
    }

    await loadReference(trimmedRef);
  };

  const handleSelectTrackedReference = async (reference: string) => {
    setReferenceNumber(reference);
    await loadReference(reference);
  };

  const handleSubmitAdditionalInfo = async () => {
    const message = additionalInfoText.trim();
    if (!trackResult || message.length < 5) {
      setAddInfoMessage(t("trackAdditionalInfoTooShort", "Please add a little more detail before sending."));
      return;
    }

    setAddInfoLoading(true);
    setAddInfoMessage("");
    try {
      const response = await fetch(`${API_BASE}/track-report/additional-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference_number: trackResult.reference_number, message }),
      });
      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) {
        throw new Error(data.detail || t("trackAdditionalInfoSaveError", "Could not save your additional information"));
      }

      setAdditionalInfoText("");
      setAddInfoMessage(t("trackAdditionalInfoSuccess", "Your additional information was added successfully."));
      await loadReference(trackResult.reference_number);
      setShowAddInfoPanel(true);
    } catch (err) {
      setAddInfoMessage(
        err instanceof Error ? err.message : t("trackAdditionalInfoSaveError", "Could not save your additional information"),
      );
    } finally {
      setAddInfoLoading(false);
    }
  };

  const handleConfirmClose = async () => {
    if (!trackResult) return;

    setShowClosePrompt(false);
    setClosingReference(true);
    try {
      const response = await fetch(`${API_BASE}/track-report/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference_number: trackResult.reference_number }),
      });
      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) {
        throw new Error(data.detail || t("trackCloseReferenceError", "Could not close this public reference"));
      }

      setTrackedQueue((current) => {
        const next = removeTrackedQueueItem(current, trackResult.reference_number);
        writeTrackedQueue(next);
        return next;
      });
      setTrackResult(null);
      setLookupError(null);
      setReferenceNumber("");
      setSearchParams({}, { replace: true });

      window.setTimeout(() => {
        setClosingReference(false);
        setClosureComplete(true);
      }, 2200);
    } catch (err) {
      setClosingReference(false);
      setLookupError(
        makeLookupError(err instanceof Error ? err.message : t("trackCloseReferenceError", "Could not close this public reference")),
      );
      setShowWorkspace(true);
    }
  };

  const handleBackHome = () => {
    navigate("/", { replace: true });
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }, 0);
    }
  };

  const currentStatusIndex = trackResult ? Math.max(publicStatusOrder.indexOf(trackResult.status), 0) : -1;
  const progressWidth = currentStatusIndex >= 0 ? `${((currentStatusIndex + 1) / publicStatusOrder.length) * 100}%` : "0%";

  if (closureComplete) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <style>{`@keyframes gratitudeRise { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } } @keyframes haloPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,211,238,0.18); } 50% { box-shadow: 0 0 0 24px rgba(34,211,238,0); } }`}</style>
        <div className="relative min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.14),transparent_26%)]" />
          <div className="relative mx-auto flex min-h-screen max-w-4xl items-center px-4 py-12">
            <div className="w-full rounded-[38px] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl" style={{ animation: "gratitudeRise 380ms ease-out" }}>
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-emerald-200" style={{ animation: "haloPulse 2.2s ease-in-out infinite" }}>
                <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">{t("trackClosureEyebrow", "Public follow-up closed")}</p>
              <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl">{t("trackClosureTitle", "Thank you for following up")}</h1>
              <div className="mt-5 space-y-4 text-sm leading-8 text-slate-200 sm:text-base">
                <p>{t("trackClosureBody1", "If this issue has already been resolved, thank you for taking action. You still have the right to share updates with the federation, and every concern is handled with strong confidentiality whether or not you keep using public follow-up.")}</p>
                <p>{t("trackClosureBody2", "If you were worried, wanted to close public tracking, or now have new information, you can still submit a fresh confidential report through the FEMATA secure system. The internal institutional record remains stored safely for administrative review.")}</p>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/?openReportWizard=1" className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-6 py-3 text-sm font-semibold text-slate-950">
                  {t("trackClosureNewReport", "File a new confidential report")}
                </Link>
                <button type="button" onClick={handleBackHome} className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  {t("backToHome")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <style>{`@keyframes riseIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } @keyframes orbFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } } @keyframes shimmerSweep { 0% { transform: translateX(-130%); opacity: 0; } 18% { opacity: 0.9; } 100% { transform: translateX(240%); opacity: 0; } } @keyframes statusPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,211,238,0.14); } 50% { box-shadow: 0 0 0 16px rgba(34,211,238,0); } }`}</style>
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_28%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.14),transparent_24%)]" />
        <div className="absolute left-[-4rem] top-20 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" style={{ animation: "orbFloat 8s ease-in-out infinite" }} />
        <div className="absolute bottom-16 right-0 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" style={{ animation: "orbFloat 10s ease-in-out infinite reverse" }} />

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {!showWorkspace ? (
            <div className="mx-auto max-w-6xl rounded-[38px] border border-cyan-300/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.88),rgba(17,24,39,0.94),rgba(12,18,35,0.98))] p-8 shadow-[0_35px_90px_rgba(2,6,23,0.5)] backdrop-blur-xl" style={{ animation: "riseIn 360ms ease-out" }}>
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                  <img src="/femata-logo.jpeg" alt={t("logoAlt")} className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/10" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">{t("trackResponsesEyebrow", "Track responses")}</p>
                    <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">{t("trackModalTitle")}</h1>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">{t("trackDesc")}</p>
                  </div>
                </div>
                <Link to="/" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  {t("trackGoBack", "Go back")}
                </Link>
              </div>

              <div className="relative mt-10 overflow-hidden rounded-[34px] border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(10,18,34,0.92),rgba(12,24,44,0.82))] p-5 sm:p-6">
                <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-cyan-200/15 to-transparent" style={{ animation: "shimmerSweep 3.1s linear infinite" }} />
                <label className="mb-3 block text-sm font-semibold text-slate-100">{t("trackInputLabel")}</label>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px]">
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(event) => setReferenceNumber(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleLookup();
                      }
                    }}
                    placeholder={t("trackInputPlaceholder")}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-lg text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/25"
                  />
                  <button
                    type="button"
                    onClick={() => void handleLookup()}
                    className="rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-cyan-500 px-5 py-4 text-base font-semibold text-slate-950 transition hover:opacity-95"
                  >
                    {t("trackAction")}
                  </button>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="mx-auto max-w-4xl rounded-[36px] border border-cyan-300/20 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-cyan-100" style={{ animation: "statusPulse 2s ease-in-out infinite" }}>
                <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
                  <path d="M8 12h8" />
                </svg>
              </div>
              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">{t("trackWorkspaceLoadingEyebrow", "Opening case space")}</p>
              <h2 className="mt-4 text-3xl font-bold text-white">{t("trackWorkspaceLoadingTitle", "Preparing your reference dashboard")}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">{loadingPhrases[loadingPhraseIndex]}</p>
              <div className="mt-8 overflow-hidden rounded-full border border-white/10 bg-white/5 p-1">
                <div className="h-3 rounded-full bg-gradient-to-r from-cyan-300 via-amber-300 to-emerald-300" style={{ width: `${34 + loadingPhraseIndex * 22}%`, transition: "width 500ms ease" }} />
              </div>
            </div>
          ) : lookupError ? (
            <div className="mx-auto max-w-5xl grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="rounded-[36px] border border-rose-300/20 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(28,25,49,0.94))] p-8 shadow-2xl backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-200">{t("trackLookupResultEyebrow", "Reference check result")}</p>
                <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 font-mono text-sm text-slate-200">
                  {referenceNumber || urlReference || t("trackInputPlaceholder")}
                </div>
                <h1 className="mt-6 text-3xl font-bold text-white">{lookupError.title}</h1>
                <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-300">{lookupError.body}</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={resetToLookup} className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                    {t("trackTryAnotherReference", "Try another reference")}
                  </button>
                  <Link to="/?openReportWizard=1" className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-6 py-3 text-sm font-semibold text-slate-950">
                    {t("trackRefileConfidential", "Re-file a confidential report")}
                  </Link>
                </div>
              </div>

              <aside className="rounded-[36px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">{t("trackNeedHelpTitle", "Need help?")}</p>
                <div className="mt-5 space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-7 text-slate-300">
                    {t("trackNeedHelpBody1", "If the reference number is wrong, the tracker will not open the query.")}
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-7 text-slate-300">
                    {t("trackNeedHelpBody2", "Filing a new confidential report will reopen the protected reporting flow so FEMATA can route the issue to the right regional desk.")}
                  </div>
                </div>
              </aside>
            </div>
          ) : trackResult ? (
            <div className="grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="space-y-6">
                <div className="rounded-[34px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">{t("trackTrackedReferencesTitle", "Tracked references")}</p>
                  <div className="mt-5 space-y-3">
                    {trackedQueue.map((item) => (
                      <button
                        key={item.reference_number}
                        type="button"
                        onClick={() => void handleSelectTrackedReference(item.reference_number)}
                        className={`w-full rounded-3xl border p-4 text-left transition ${
                          item.reference_number === trackResult.reference_number ? "border-cyan-300/30 bg-cyan-400/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        <p className="break-all font-mono text-sm font-semibold text-white">{item.reference_number}</p>
                        <p className="mt-2 text-xs text-slate-400">{formatTimestamp(item.updated_at, language)}</p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${toneForStatus(item.status)}`}>
                            {translateAdminStatus(t, item.status)}
                          </span>
                          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{translateAdminDesk(t, item.assigned_desk)}</span>
                        </div>
                      </button>
                    ))}
                    {trackedQueue.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-white/10 px-4 py-8 text-center text-sm leading-7 text-slate-300">
                        {t("trackTrackedReferencesEmpty", "References you successfully open will appear here for quick access.")}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[34px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">{t("trackAdditionalInfoPromptTitle", "Need to say more?")}</p>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{t("trackAdditionalInfoPromptBody", "If there is a new development, missing context, or a clarification you want FEMATA to see, you can add more information below.")}</p>
                  <button
                    type="button"
                    onClick={() => setShowAddInfoPanel((current) => !current)}
                    className="mt-5 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                  >
                    {showAddInfoPanel ? t("trackHideAdditionalInfo", "Hide extra information form") : t("trackShowAdditionalInfo", "Add more information")}
                  </button>
                </div>
              </aside>

              <main className="space-y-6">
                <div className="relative overflow-hidden rounded-[36px] border border-cyan-300/20 bg-[linear-gradient(165deg,rgba(15,23,42,0.96),rgba(16,24,44,0.92),rgba(10,16,32,0.98))] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-transparent via-cyan-200/10 to-transparent" style={{ animation: "shimmerSweep 3.4s linear infinite" }} />
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">{t("trackPublicDashboardEyebrow", "Public case dashboard")}</p>
                      <h1 className="mt-4 break-all font-mono text-2xl font-bold text-white sm:text-4xl">{trackResult.reference_number}</h1>
                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <span className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${toneForStatus(trackResult.status)}`}>
                          {translateAdminStatus(t, trackResult.status)}
                        </span>
                        <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
                          {translateAdminDesk(t, trackResult.assigned_desk)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={resetToLookup} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                        {t("trackUseAnotherReference", "Use another reference")}
                      </button>
                      <button type="button" onClick={() => setShowClosePrompt(true)} className="rounded-full border border-rose-300/20 bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15">
                        {t("trackCloseReferenceButton", "Close this reference")}
                      </button>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t("updatedLabel")}</p>
                      <p className="mt-3 text-sm font-semibold text-white">{formatTimestamp(trackResult.updated_at, language)}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t("trackActionStartedLabel", "Action started")}</p>
                      <p className="mt-3 text-sm font-semibold text-white">{translateBooleanValue(t, Boolean(trackResult.action_started))}</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t("trackPublicAccessWindowLabel", "Public access window")}</p>
                      <p className="mt-3 text-sm font-semibold text-white">{trackResult.public_access_expires_at ? formatTimestamp(trackResult.public_access_expires_at, language) : t("trackPublicAccessWindowActive", "Active while this public case space stays open")}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[36px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl sm:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">{t("statusLabel")}</p>
                      <h2 className="mt-3 text-2xl font-bold text-white">{t("trackTimelineTitle", "Where your query is now")}</h2>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
                      {currentStatusIndex >= 0 ? `${currentStatusIndex + 1} / ${publicStatusOrder.length}` : `0 / ${publicStatusOrder.length}`}
                    </span>
                  </div>

                  <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
                    <div className="h-3 rounded-full bg-gradient-to-r from-amber-300 via-cyan-300 to-emerald-300 transition-all duration-500" style={{ width: progressWidth }} />
                  </div>

                  <div className="mt-8 space-y-4">
                    {publicStatusOrder.map((status, index) => {
                      const isComplete = index < currentStatusIndex;
                      const isCurrent = index === currentStatusIndex;
                      const isPending = index > currentStatusIndex;

                      return (
                        <div key={status} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div
                              className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm font-bold ${
                                isCurrent
                                  ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100"
                                  : isComplete
                                    ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                                    : "border-white/10 bg-white/5 text-slate-500"
                              }`}
                              style={isCurrent ? { animation: "statusPulse 1.9s ease-in-out infinite" } : undefined}
                            >
                              {index + 1}
                            </div>
                            {index < publicStatusOrder.length - 1 ? (
                              <div className={`mt-2 h-14 w-px ${isComplete ? "bg-emerald-300/45" : "bg-white/10"}`} />
                            ) : null}
                          </div>
                          <div
                            className={`flex-1 rounded-3xl border p-4 ${
                              isCurrent
                                ? "border-cyan-300/20 bg-cyan-400/10"
                                : isComplete
                                  ? "border-emerald-300/20 bg-emerald-400/10"
                                  : "border-white/10 bg-white/5"
                            }`}
                          >
                            <p className={`text-sm font-semibold ${isPending ? "text-slate-300" : "text-white"}`}>{translateAdminStatus(t, status)}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-300">
                              {isCurrent
                                ? `${t("statusLabel")}: ${translateAdminStatus(t, trackResult.status)}`
                                : isComplete
                                  ? t("trackTimelineCompleted", "Completed")
                                  : t("trackTimelinePending", "Pending")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-6">
                    <div className="rounded-[36px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">{t("feedbackLabel")}</p>
                      <p className="mt-5 text-sm leading-8 text-slate-200">{trackResult.feedback || t("noFeedback")}</p>
                    </div>

                    <div className="rounded-[36px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">{t("trackAdditionalInfoTitle", "Additional information")}</p>
                          <h3 className="mt-3 text-xl font-bold text-white">{t("trackAdditionalInfoSubtitle", "What else you have added")}</h3>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200">
                          {trackResult.additional_information.length}
                        </span>
                      </div>

                      {showAddInfoPanel ? (
                        <div className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4">
                          <label className="mb-3 block text-sm font-semibold text-white">{t("trackAdditionalInfoLabel", "Add more information for FEMATA")}</label>
                          <textarea
                            value={additionalInfoText}
                            onChange={(event) => setAdditionalInfoText(event.target.value)}
                            rows={5}
                            placeholder={t("trackAdditionalInfoPlaceholder", "Share any new development, correction, or detail that can help this query move forward.")}
                            className="w-full rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-slate-500"
                          />
                          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                            <button
                              type="button"
                              onClick={() => void handleSubmitAdditionalInfo()}
                              disabled={addInfoLoading}
                              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-95 disabled:opacity-70"
                            >
                              {addInfoLoading ? t("chatSending", "Sending...") : t("trackAdditionalInfoSend", "Send additional information")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddInfoPanel(false);
                                setAdditionalInfoText("");
                                setAddInfoMessage("");
                              }}
                              className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                            >
                              {t("trackAdditionalInfoCancel", "Cancel")}
                            </button>
                          </div>
                          {addInfoMessage ? <p className="mt-4 text-sm text-cyan-100">{addInfoMessage}</p> : null}
                        </div>
                      ) : null}

                      <div className="mt-6 space-y-3">
                        {trackResult.additional_information.map((item) => (
                          <div key={item.id} className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                {item.source === "public_close" ? t("trackAdditionalInfoNoteClose", "Public closure note") : t("trackAdditionalInfoNoteFollowup", "Public follow-up note")}
                              </span>
                              <span className="text-xs text-slate-500">{formatTimestamp(item.created_at, language)}</span>
                            </div>
                            <p className="mt-3 text-sm leading-7 text-slate-200">{item.message}</p>
                          </div>
                        ))}
                        {trackResult.additional_information.length === 0 ? (
                          <div className="rounded-3xl border border-dashed border-white/10 px-4 py-8 text-center text-sm leading-7 text-slate-300">
                            {t("trackAdditionalInfoEmpty", "No additional information has been added yet.")}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[36px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">{t("trackGuideTitle", "Public follow-up guide")}</p>
                    <div className="mt-5 space-y-4">
                      <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t("trackGuideReferenceLabel", "Reference")}</p>
                        <p className="mt-3 break-all font-mono text-sm font-semibold text-white">{trackResult.reference_number}</p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t("trackGuideActionsLabel", "What you can do here")}</p>
                        <p className="mt-3 text-sm leading-7 text-slate-300">{t("trackGuideActionsBody", "Track progress, read feedback, add more context, or close this public reference if you no longer want it visible on the public side.")}</p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t("trackGuideConfidentialityLabel", "Confidentiality note")}</p>
                        <p className="mt-3 text-sm leading-7 text-slate-300">{t("trackGuideConfidentialityBody", "Even if you close this public reference, the internal administrative record remains available only to the protected FEMATA review side.")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          ) : null}
        </div>
      </div>

      {showClosePrompt && trackResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 px-4">
          <div className="w-full max-w-xl overflow-hidden rounded-[34px] border border-rose-300/20 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.15),transparent_30%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_22%)] px-6 py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-200">{t("trackClosePromptEyebrow", "Close public reference")}</p>
              <h2 className="mt-3 text-2xl font-bold text-white">{t("trackClosePromptTitle", "Do you want to close this reference for public tracking?")}</h2>
            </div>
            <div className="px-6 py-6">
              <p className="text-sm leading-8 text-slate-200">{t("trackClosePromptBody", "If you continue, this reference number will be removed from your public dashboard and it will no longer work for public login. FEMATA administrators will still keep the protected institutional record and the history of what happened.")}</p>
              <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t("trackReferenceNumberLabel", "Reference number")}</p>
                <p className="mt-3 break-all font-mono text-sm font-semibold text-white">{trackResult.reference_number}</p>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setShowClosePrompt(false)} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  {t("trackKeepOpen", "Keep it open")}
                </button>
                <button type="button" onClick={() => void handleConfirmClose()} className="rounded-full bg-gradient-to-r from-rose-300 via-rose-400 to-amber-300 px-5 py-3 text-sm font-semibold text-slate-950">
                  {t("trackAgreeAndClose", "Agree and close")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {closingReference ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/92 px-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-[36px] border border-rose-300/20 bg-[linear-gradient(160deg,rgba(15,23,42,0.96),rgba(17,24,39,0.94),rgba(10,15,28,0.98))] shadow-[0_30px_90px_rgba(2,6,23,0.6)]">
            <div className="p-8 text-center">
              <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-rose-300/20 bg-rose-500/10 text-rose-100" style={{ animation: "statusPulse 2s ease-in-out infinite" }}>
                <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 11a7 7 0 1114 0v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7z" />
                  <path d="M12 14v2" />
                  <path d="M12 8v3" />
                </svg>
              </div>
              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-rose-200">{t("trackClosingEyebrow", "Closing public query")}</p>
              <h2 className="mt-4 text-3xl font-bold text-white">{t("trackClosingTitle", "Removing this reference from public access")}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">{destroyPhrases[destroyPhraseIndex]}</p>
              <div className="mt-8 overflow-hidden rounded-full border border-white/10 bg-white/5 p-1">
                <div className="h-3 rounded-full bg-gradient-to-r from-rose-300 via-amber-300 to-cyan-300" style={{ width: `${34 + destroyPhraseIndex * 23}%`, transition: "width 450ms ease" }} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TrackDashboardPage;

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { normalizeLocation, regionMunicipalityMap, regions } from "../data/tanzaniaLocations";
import { API_BASE } from "../lib/apiBase";
import { collectClientContext } from "../lib/clientContext";
import {
  REPORT_QUEUE_EVENT,
  createLocalInternalTrackingNumber,
  createLocalQueueId,
  createLocalReferenceNumber,
  deleteQueuedReport,
  saveQueuedReport,
  type QueuedReportRecord,
  type ReportQueueStatus,
} from "../db/queueStore";
import { requestQueuedReportSync } from "../services/syncQueue";
const stepDefaults = ["Start", "Reporter", "Target", "Themes", "Location", "Focused", "Details", "Review"];
const groups = [
  ["Artisanal miner", "Site access, safety, and market barriers.", "miner"],
  ["Small-scale miner", "Operational, levy, and enforcement issues.", "miner"],
  ["PML holder", "Licensing, compliance, title, and boundary issues.", "license"],
  ["Investor", "Permits, taxation, certainty, and commercial environment.", "investor"],
  ["Mining worker / employee", "Wages, safety, labor rights, or employer conduct.", "worker"],
  ["Cooperative member", "Leadership, shared operations, and governance.", "association"],
  ["Association leader / member", "Member-wide or sector-wide issues.", "association"],
  ["Vendor / supplier", "Contracts, payment, or procurement barriers.", "vendor"],
  ["Buyer / trader / broker", "Trade access, pricing, or market conduct.", "vendor"],
  ["Contractor / service provider", "Service, payment, or site access barriers.", "vendor"],
  ["Transport / logistics actor", "Transport restrictions and delivery disputes.", "vendor"],
  ["Community member", "Environment, land, safety, or community relations.", "community"],
  ["Landowner / local resident", "Land, compensation, or local impact issues.", "community"],
  ["CSO / advocate", "Rights, accountability, or advocacy concerns.", "community"],
  ["Other", "A reporting group not listed above.", "general"],
] as const;
const valueRoles = ["Extraction / production", "Licensing / compliance", "Trade / buying", "Service / supply", "Community / land interface", "Worker welfare / labor", "Association / governance", "Policy / regulation", "Other"];
const targets = ["Mining company / mining entity", "Municipal / district authority", "Village / ward authority", "Mining office / mining officer", "Ministry / regulator", "Tax / levy authority", "Licensing authority / process", "Parliament / legal framework", "Policy / regulation", "Mining association", "Cooperative leadership", "Buyer / broker / trader", "Vendor / supplier", "Security actor", "Land / boundary actor", "Another stakeholder in the value chain", "Unsure", "Other"];
const themes = ["Taxation / levies / fees", "Licensing / permits", "Delay in approvals", "PML / title / boundary dispute", "Access to land", "Environmental issue", "Safety / accident / hazardous condition", "Labor / wage / worker welfare", "Harassment / intimidation", "Corruption / bribery / extortion", "Confiscation / seizure", "Unfair enforcement", "Discrimination / exclusion", "Market access / pricing", "Payment dispute", "Contract dispute", "Equipment / supply issue", "Association governance issue", "Policy / legal reform issue", "Parliamentary / legislative concern", "Local government by-law issue", "Administrative abuse / misconduct", "Gender-related issue", "Child labor concern", "Community conflict", "Human rights concern", "Other"];
const levels = ["Mine site / local operations", "Municipal / district level", "Regional level", "National ministry / regulator", "Policy / law reform level", "Unsure"];
const severities = ["Low", "Moderate", "High", "Critical"] as const;
const affectedScopes = ["Only me", "Small group", "Many miners", "Community", "Sector-wide", "Unsure"] as const;
const questionSets: Record<string, Array<{ id: string; label: string; options: string[] }>> = {
  miner: [
    { id: "q1", label: "Main obstacle", options: ["Site access blocked", "Levy / fee pressure", "Security / harassment", "Market / buying conditions", "Safety risk", "Other"] },
    { id: "q2", label: "Main stage affected", options: ["Before production", "During active mining", "Selling minerals", "Transporting output", "Unsure"] },
    { id: "q3", label: "Impact width", options: ["One miner", "A few miners", "Many miners at one site", "Multiple sites", "Unsure"] },
  ],
  license: [
    { id: "q1", label: "Title or permit stage", options: ["Application", "Renewal", "Transfer / change", "Boundary / title security", "Compliance / inspection", "Unsure"] },
    { id: "q2", label: "Process issue", options: ["Delay", "Conflicting instructions", "Unexpected fee / levy", "Rejection without clarity", "Boundary conflict", "Other"] },
    { id: "q3", label: "Document status", options: ["Active documents exist", "Documents expired", "Application pending", "No", "Unsure"] },
  ],
  investor: [
    { id: "q1", label: "Issue stage", options: ["Entry / registration", "Permit processing", "Tax / levy burden", "Operations scaling", "Exit / restructuring", "Unsure"] },
    { id: "q2", label: "Main uncertainty", options: ["Regulatory certainty", "Approvals timeline", "Local authority requirements", "Tax predictability", "Contract enforcement", "Other"] },
    { id: "q3", label: "Investment impact", options: ["Planning only", "Delayed activity", "Capital already committed", "Operations at risk", "Unsure"] },
  ],
  worker: [
    { id: "q1", label: "Worker issue", options: ["Wages / unpaid work", "Unsafe conditions", "Harassment / abuse", "Dismissal / retaliation", "Protective equipment", "Other"] },
    { id: "q2", label: "Frequency", options: ["One incident", "Occasionally", "Repeatedly", "Ongoing right now", "Unsure"] },
    { id: "q3", label: "Raised internally", options: ["Yes, no response", "Yes, inadequate response", "No", "Unsure"] },
  ],
  association: [
    { id: "q1", label: "Who is affected", options: ["One member", "Several members", "Whole cooperative / association", "Sector network", "Unsure"] },
    { id: "q2", label: "Association issue", options: ["Leadership / governance", "Member access / exclusion", "Funds / payments", "Representation", "Dispute resolution", "Other"] },
    { id: "q3", label: "Most needed response", options: ["Guidance", "Mediation", "Policy escalation", "Formal follow-up", "Unsure"] },
  ],
  vendor: [
    { id: "q1", label: "Business issue", options: ["Payment delay", "Contract dispute", "Access to site", "Procurement exclusion", "Transport restriction", "Other"] },
    { id: "q2", label: "Who controls the blockage", options: ["Company / operator", "Authority", "Broker / buyer", "Security actor", "Multiple parties", "Unsure"] },
    { id: "q3", label: "Commercial exposure", options: ["Small unpaid balance", "Large unpaid balance", "Contract at risk", "Service interrupted", "Unsure"] },
  ],
  community: [
    { id: "q1", label: "Main concern", options: ["Land / boundary", "Environment", "Safety", "Community relations", "Compensation / benefit sharing", "Other"] },
    { id: "q2", label: "Scale", options: ["One household", "A few households", "A village / ward area", "Several communities", "Unsure"] },
    { id: "q3", label: "Current state", options: ["Past incident", "Still ongoing", "Worsening", "Threatened / likely", "Unsure"] },
  ],
  general: [
    { id: "q1", label: "Current stage", options: ["Just started", "Ongoing", "Repeated many times", "Already escalated elsewhere", "Unsure"] },
    { id: "q2", label: "Strongest impact", options: ["Financial", "Safety", "Administrative", "Legal / policy", "Community", "Other"] },
    { id: "q3", label: "Needed follow-up", options: ["Advice", "Case review", "Mediation", "Escalation", "Unsure"] },
  ],
};

type ReportDraft = {
  reporter_group: string;
  value_chain_role: string;
  issue_target_type: string;
  issue_target_name: string;
  issue_types: string[];
  handling_level: string;
  severity: string;
  immediate_danger: boolean | null;
  affected_scope: string;
  region: string;
  municipality: string;
  zone: string;
  local_area: string;
  short_title: string;
  narrative: string;
  desired_outcome: string;
  conditional_answers: Record<string, string>;
};

type DraftMeta = {
  draft_id: string;
  internal_tracking_number: string;
  public_reference_number: string;
  status: string;
};

type ZoneMetaResponse = {
  region_to_zone: Record<string, string>;
};

const initialDraft: ReportDraft = {
  reporter_group: "",
  value_chain_role: "",
  issue_target_type: "",
  issue_target_name: "",
  issue_types: [],
  handling_level: "",
  severity: "",
  immediate_danger: null,
  affected_scope: "",
  region: "",
  municipality: "",
  zone: "",
  local_area: "",
  short_title: "",
  narrative: "",
  desired_outcome: "",
  conditional_answers: {},
};

const getBranch = (group: string) => groups.find((item) => item[0] === group)?.[2] ?? "general";
const stepPayload = (step: number, draft: ReportDraft) => {
  if (step === 2) return { reporter_group: draft.reporter_group, value_chain_role: draft.value_chain_role };
  if (step === 3) return { issue_target_type: draft.issue_target_type, issue_target_name: draft.issue_target_name || null };
  if (step === 4) return { issue_types: draft.issue_types };
  if (step === 5) {
    return {
      handling_level: draft.handling_level,
      severity: draft.severity,
      immediate_danger: draft.immediate_danger,
      affected_scope: draft.affected_scope,
      region: draft.region,
      municipality: draft.municipality,
      local_area: draft.local_area || null,
    };
  }
  if (step === 6) return { conditional_answers: draft.conditional_answers };
  if (step === 7) return { narrative: draft.narrative, desired_outcome: draft.desired_outcome || null };
  return null;
};

const copyText = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

const Card = ({ active, title, body, onClick }: { active: boolean; title: string; body?: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-3xl border p-3 text-left transition sm:p-4 ${active ? "border-amber-300 bg-amber-400/15 text-white" : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {body ? <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p> : null}
      </div>
      <span className={`mt-1 h-3 w-3 rounded-full ${active ? "bg-amber-300" : "bg-white/20"}`} />
    </div>
  </button>
);

const Shell = ({ children }: { children: React.ReactNode }) => (
  <section className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur-md sm:rounded-[32px] sm:p-6 lg:p-8">{children}</section>
);

const AnimatedStage = ({ stageKey, children }: { stageKey: string; children: React.ReactNode }) => (
  <div
    key={stageKey}
    className="animate-[stageFade_280ms_ease-out]"
    style={{
      animation: "stageFade 280ms ease-out",
    }}
  >
    {children}
  </div>
);

const celebrationParticles = Array.from({ length: 28 }, (_, index) => ({
  id: index,
  left: `${4 + ((index * 9) % 92)}%`,
  delay: `${(index % 6) * 0.28}s`,
  duration: `${3.8 + (index % 5) * 0.45}s`,
  color:
    index % 4 === 0
      ? "bg-amber-300"
      : index % 4 === 1
        ? "bg-emerald-300"
        : index % 4 === 2
          ? "bg-cyan-300"
          : "bg-rose-300",
  size: index % 3 === 0 ? "h-4 w-4" : index % 3 === 1 ? "h-3 w-3" : "h-2.5 w-2.5",
}));

const fireworkBursts = Array.from({ length: 4 }, (_, index) => ({
  id: index,
  left: `${18 + index * 20}%`,
  top: `${10 + (index % 2) * 10}%`,
  delay: `${index * 0.65}s`,
}));

const ReportPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as { region?: string; municipality?: string } | null) ?? null;
  const { t } = useTranslation();
  const steps = stepDefaults.map((_, index) => t(`reportStep${index + 1}`));
  const text = {
    eyebrow: t("reportShellEyebrow"),
    title: t("reportShellTitle"),
    subtitle: t("reportShellSubtitle"),
    refTitle: t("reportReferenceTitle"),
    refBody: t("reportReferenceBody"),
    copy: t("reportCopy"),
    copied: t("reportCopied"),
    back: t("reportBack"),
    save: t("reportSave"),
    submit: t("reportSubmit"),
    home: t("reportHome"),
    submitted: t("reportSubmittedTitle"),
    submittedBody: t("reportSubmittedBody"),
    submittedThanks: t("reportSubmittedThanks"),
    note: t("reportAnonymousNote"),
    retention: t("reportRetention"),
    region: t("reportRegionPlaceholder"),
    municipality: t("reportMunicipalityPlaceholder"),
    noAccountRequired: t("reportNoAccountRequired"),
    progress: t("reportProgress"),
    step: t("reportStepLabelWord"),
    anonymousSafeguards: t("reportAnonymousSafeguards"),
    anonymousSafeguard1: t("reportAnonymousSafeguard1"),
    anonymousSafeguard2: t("reportAnonymousSafeguard2"),
    anonymousSafeguard3: t("reportAnonymousSafeguard3"),
    publicFollowUp: t("reportPublicFollowUp"),
    referenceNumber: t("reportReferenceNumber"),
    whatVisibleLater: t("reportWhatVisibleLater"),
    visibleLaterBody: t("reportVisibleLaterBody"),
    publicLookupRetention: t("reportPublicLookupRetention"),
    startVaultEyebrow: t("reportStartVaultEyebrow"),
    startVaultTitle: t("reportStartVaultTitle"),
    startVaultBody: t("reportStartVaultBody"),
    startVaultButton: t("reportStartVaultButton"),
    closeDraft: t("reportCloseDraft"),
    closeDraftTitle: t("reportCloseDraftTitle"),
    closeDraftBody: t("reportCloseDraftBody"),
    closeDraftConfirm: t("reportCloseDraftConfirm"),
    closeDraftKeep: t("reportCloseDraftKeep"),
    closeDraftDeleting: t("reportCloseDraftDeleting"),
    brandTitle: t("reportBrandTitle"),
    brandSubtitle: t("reportBrandSubtitle"),
    secureLayer: t("reportSecureLayer"),
    vaultCard1Title: t("reportVaultCard1Title"),
    vaultCard1Body: t("reportVaultCard1Body"),
    vaultCard2Title: t("reportVaultCard2Title"),
    vaultCard2Body: t("reportVaultCard2Body"),
    vaultCard3Title: t("reportVaultCard3Title"),
    vaultCard3Body: t("reportVaultCard3Body"),
  };
  const prompts = {
    chooseGroup: t("reportPromptChooseGroup"),
    valueChain: t("reportPromptValueChain"),
    searchTargets: t("reportSearchTargets"),
    targetName: t("reportTargetName"),
    targetNamePlaceholder: t("reportTargetNamePlaceholder"),
    selectedRegion: t("reportSelectedRegion"),
    changeRegion: t("reportChangeRegion"),
    selectedCouncil: t("reportSelectedCouncil"),
    selectedZone: "Auto-derived zone",
    changeCouncil: t("reportChangeCouncil"),
    localArea: t("reportLocalArea"),
    localAreaPlaceholder: t("reportLocalAreaPlaceholder"),
    narrative: t("reportNarrative"),
    desiredOutcome: t("reportDesiredOutcome"),
    reporterGroup: t("reportReviewReporterGroup"),
    notSelected: t("reportNotSelected"),
    noValueChainRole: t("reportNoValueChainRole"),
    issueTarget: t("reportReviewIssueTarget"),
    noTargetName: t("reportNoTargetName"),
    themesAndSeriousness: t("reportReviewThemesAndSeriousness"),
    noThemes: t("reportNoThemes"),
    noSeverity: t("reportNoSeverity"),
    noLevel: t("reportNoLevel"),
    dangerUnset: t("reportDangerUnset"),
    immediateDanger: t("reportImmediateDanger"),
    noImmediateDanger: t("reportNoImmediateDanger"),
    location: t("reportReviewLocation"),
    noRegion: t("reportNoRegion"),
    noMunicipality: t("reportNoMunicipality"),
    noZone: "No zone",
    noLocalArea: t("reportNoLocalArea"),
    narrativeSummary: t("reportNarrativeSummary"),
    noNarrative: t("reportNoNarrative"),
    noDesiredOutcome: t("reportNoDesiredOutcome"),
    saving: t("reportSaving"),
    stored: t("reportStored"),
    referenceAlert: t("reportReferenceAlert"),
    referencePulse: t("reportReferencePulse"),
    selectedTarget: t("reportSelectedTarget"),
    changeTarget: t("reportChangeTarget"),
    panelProgress: t("reportPanelProgress"),
    nextQuestion: t("reportNextQuestion"),
    reviewDetails: t("reportReviewDetails"),
    seriousnessQuestion: t("reportSeriousnessQuestion"),
    dangerQuestion: t("reportDangerQuestion"),
    affectedQuestion: t("reportAffectedQuestion"),
    levelQuestion: t("reportLevelQuestion"),
    locationQuestion: t("reportLocationQuestion"),
  };
  const validationText = {
    chooseGroup: t("reportValidationChooseGroup"),
    chooseTarget: t("reportValidationChooseTarget"),
    chooseTheme: t("reportValidationChooseTheme"),
    completeLocation: t("reportValidationCompleteLocation"),
    focusedAnswers: t("reportValidationFocusedAnswers"),
    details: t("reportValidationDetails"),
  };
  const groupOptions = groups.map(([value, , branch], index) => ({
    value,
    branch,
    title: t(`reportGroup${index + 1}Title`),
    body: t(`reportGroup${index + 1}Body`),
  }));
  const valueRoleOptions = valueRoles.map((value, index) => ({
    value,
    label: t(`reportValueRole${index + 1}`),
  }));
  const targetOptions = targets.map((value, index) => ({
    value,
    label: t(`reportTarget${index + 1}`),
  }));
  const themeOptions = themes.map((value, index) => ({
    value,
    label: t(`reportTheme${index + 1}`),
  }));
  const handlingLevelOptions = levels.map((value, index) => ({
    value,
    label: t(`reportHandlingLevel${index + 1}`),
  }));
  const severityOptions = severities.map((value, index) => ({
    value,
    label: t(`reportSeverity${index + 1}`),
  }));
  const affectedScopeOptions = affectedScopes.map((value, index) => ({
    value,
    label: t(`reportAffectedScope${index + 1}`),
  }));
  const dangerOptions = [
    { value: true, label: t("reportDangerYes") },
    { value: false, label: t("reportDangerNo") },
  ];
  const serviceText = {
    loading: t("reportInitLoading"),
    error: t("reportInitError"),
    errorHelp: t("reportInitErrorHelp"),
    retry: t("reportRetry"),
    protectedComplete: t("reportSubmitComplete"),
    submitLoadingTitle: t("reportSubmitLoadingTitle"),
    submitLoadingDesc: t("reportSubmitLoadingDesc"),
    submitTransferLabel: t("reportSubmitTransferLabel"),
    submitBadges: [
      t("reportSubmitBadge1"),
      t("reportSubmitBadge2"),
      t("reportSubmitBadge3"),
    ],
    submitStates: [
      t("reportSubmitState1"),
      t("reportSubmitState2"),
      t("reportSubmitState3"),
    ],
    submitSeal: t("reportSubmitSeal"),
  };
  const offlineText = {
    savedOffline: "Saved offline. Will send when connection is available.",
    queuedBadge: "Queued for sync",
    draftBadge: "Offline draft",
    syncingBadge: "Syncing",
    sentBadge: "Sent",
    failedBadge: "Sync failed",
  };

  const [meta, setMeta] = useState<DraftMeta | null>(null);
  const [draft, setDraft] = useState<ReportDraft>({ ...initialDraft, region: routeState?.region ?? "", municipality: routeState?.municipality ?? "" });
  const [zoneLookup, setZoneLookup] = useState<Record<string, string>>({});
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regionQuery, setRegionQuery] = useState(routeState?.region ?? "");
  const [municipalityQuery, setMunicipalityQuery] = useState(routeState?.municipality ?? "");
  const [targetQuery, setTargetQuery] = useState("");
  const [initAttempt, setInitAttempt] = useState(0);
  const [panelIndex, setPanelIndex] = useState(0);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [destroyingDraft, setDestroyingDraft] = useState(false);
  const [clientContext] = useState(() => collectClientContext());
  const [queueId, setQueueId] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<ReportQueueStatus | null>(null);
  const [queueNotice, setQueueNotice] = useState("");

  const branch = getBranch(draft.reporter_group);
  const questions = questionSets[branch].map((question, questionIndex) => ({
    ...question,
    label: t(`reportQuestion${branch}${questionIndex + 1}Label`),
    options: question.options.map((option, optionIndex) => ({
      value: option,
      label: t(`reportQuestion${branch}${questionIndex + 1}Option${optionIndex + 1}`),
    })),
  }));
  const filteredTargets = useMemo(() => {
    if (!targetQuery.trim()) return targetOptions;
    const query = normalizeLocation(targetQuery);
    return targetOptions.filter((item) => normalizeLocation(item.label).includes(query) || normalizeLocation(item.value).includes(query));
  }, [targetOptions, targetQuery]);
  const filteredRegions = useMemo(() => !regionQuery.trim() ? [] : regions.filter((item) => normalizeLocation(item).includes(normalizeLocation(regionQuery))), [regionQuery]);
  const municipalities = useMemo(() => !draft.region ? [] : [...(regionMunicipalityMap[draft.region] || [])].sort((a, b) => a.localeCompare(b)), [draft.region]);
  const filteredMunicipalities = useMemo(() => !municipalityQuery.trim() ? [] : municipalities.filter((item) => normalizeLocation(item).includes(normalizeLocation(municipalityQuery))), [municipalityQuery, municipalities]);
  const getLocalizedLabel = (items: Array<{ value: string; label: string }>, value: string) => items.find((item) => item.value === value)?.label ?? value;
  const panelsPerStep = useMemo(() => {
    if (step === 2) return 2;
    if (step === 3) return draft.issue_target_type ? 2 : 1;
    if (step === 4) return 1;
    if (step === 5) return 6;
    if (step === 6) return Math.max(questions.length, 1);
    if (step === 7) return 2;
    return 1;
  }, [draft.issue_target_type, questions.length, step]);
  const activeQuestionIndex = Math.min(panelIndex, panelsPerStep - 1);
  const panelCueLabel = useMemo(() => {
    if (step === 2) return activeQuestionIndex === 0 ? prompts.chooseGroup : prompts.valueChain;
    if (step === 3) return activeQuestionIndex === 0 ? prompts.issueTarget : prompts.targetName;
    if (step === 5) {
      if (activeQuestionIndex === 0) return prompts.levelQuestion;
      if (activeQuestionIndex === 1) return prompts.seriousnessQuestion;
      if (activeQuestionIndex === 2) return prompts.dangerQuestion;
      if (activeQuestionIndex === 3) return prompts.affectedQuestion;
      if (activeQuestionIndex === 4) return prompts.locationQuestion;
      return prompts.localArea;
    }
    if (step === 6) return questions[activeQuestionIndex]?.label ?? "";
    if (step === 7) return activeQuestionIndex === 0 ? prompts.narrative : prompts.desiredOutcome;
    return "";
  }, [activeQuestionIndex, prompts.affectedQuestion, prompts.chooseGroup, prompts.dangerQuestion, prompts.desiredOutcome, prompts.issueTarget, prompts.levelQuestion, prompts.localArea, prompts.locationQuestion, prompts.narrative, prompts.seriousnessQuestion, prompts.targetName, prompts.valueChain, questions, step]);

  useEffect(() => {
    let active = true;
    const loadZones = async () => {
      try {
        const response = await fetch(`${API_BASE}/meta/zones`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as ZoneMetaResponse;
        if (!active) return;
        setZoneLookup(data.region_to_zone || {});
      } catch {
        if (active) setZoneLookup({});
      }
    };
    void loadZones();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const response = await fetch(`${API_BASE}/reports/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            region: routeState?.region ?? null,
            municipality: routeState?.municipality ?? null,
            client_context: clientContext,
          }),
        });
        if (!response.ok) throw new Error();
        const data = (await response.json()) as DraftMeta & Partial<ReportDraft>;
        if (!active) return;
        setMeta({ draft_id: data.draft_id, internal_tracking_number: data.internal_tracking_number, public_reference_number: data.public_reference_number, status: data.status });
        setDraft((prev) => ({ ...prev, region: data.region ?? prev.region, municipality: data.municipality ?? prev.municipality, zone: data.zone ?? prev.zone }));
      } catch (error) {
        if (!active) return;

        if (!navigator.onLine || error instanceof TypeError) {
          const offlineMeta = {
            draft_id: createLocalQueueId(),
            internal_tracking_number: createLocalInternalTrackingNumber(),
            public_reference_number: createLocalReferenceNumber(),
            status: "draft",
          };

          setMeta(offlineMeta);
          setDraft((prev) => ({
            ...prev,
            region: routeState?.region ?? prev.region,
            municipality: routeState?.municipality ?? prev.municipality,
          }));
          setQueueId(offlineMeta.draft_id);
          setQueueStatus("draft");
          setQueueNotice(offlineText.savedOffline);
          await saveQueuedReport(offlineMeta.draft_id, (current) => ({
            id: offlineMeta.draft_id,
            createdAt: current?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: "draft",
            draft: {
              ...initialDraft,
              region: routeState?.region ?? "",
              municipality: routeState?.municipality ?? "",
            },
            routeState: {
              region: routeState?.region ?? null,
              municipality: routeState?.municipality ?? null,
            },
            clientContext,
            remoteDraftId: null,
            localReference: offlineMeta.public_reference_number,
            publicReferenceNumber: offlineMeta.public_reference_number,
            internalTrackingNumber: offlineMeta.internal_tracking_number,
            lastError: null,
          }));
          return;
        }

        setError(serviceText.error);
      } finally {
        if (active) setLoading(false);
      }
    };
    void init();
    return () => {
      active = false;
    };
  }, [clientContext, initAttempt, routeState?.municipality, routeState?.region, serviceText.error]);

  useEffect(() => {
    if (typeof window === "undefined" || !queueId) return;

    const onQueueUpdate = (event: Event) => {
      const detail = (event as CustomEvent<QueuedReportRecord>).detail;
      if (!detail || detail.id !== queueId) return;
      applyQueueRecord(detail);
    };

    window.addEventListener(REPORT_QUEUE_EVENT, onQueueUpdate as EventListener);
    return () => {
      window.removeEventListener(REPORT_QUEUE_EVENT, onQueueUpdate as EventListener);
    };
  }, [queueId]);

  useEffect(() => {
    if (!submitting) return undefined;
    const a = window.setInterval(() => setProgress((p) => (p >= 94 ? p : p + (p < 38 ? 5 : p < 72 ? 3 : 2))), 170);
    const b = window.setInterval(() => setPhraseIndex((p) => (p + 1) % serviceText.submitStates.length), 1100);
    return () => {
      window.clearInterval(a);
      window.clearInterval(b);
    };
  }, [submitting, serviceText.submitStates.length]);

  useEffect(() => {
    setPanelIndex(0);
  }, [step]);

  useEffect(() => {
    setPanelIndex((current) => Math.min(current, Math.max(panelsPerStep - 1, 0)));
  }, [panelsPerStep]);

  useEffect(() => {
    if (!draft.region) {
      if (draft.zone) setField("zone", "");
      return;
    }
    const derivedZone = zoneLookup[draft.region] || "";
    if (derivedZone !== draft.zone) setField("zone", derivedZone);
  }, [draft.region, draft.zone, zoneLookup]);

  const setField = <K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));
  const queueStatusLabel = useMemo(() => {
    if (queueStatus === "draft") return offlineText.draftBadge;
    if (queueStatus === "queued") return offlineText.queuedBadge;
    if (queueStatus === "syncing") return offlineText.syncingBadge;
    if (queueStatus === "sent") return offlineText.sentBadge;
    if (queueStatus === "failed") return offlineText.failedBadge;
    return "";
  }, [offlineText.draftBadge, offlineText.failedBadge, offlineText.queuedBadge, offlineText.sentBadge, offlineText.syncingBadge, queueStatus]);

  const applyQueueRecord = (record: QueuedReportRecord) => {
    setQueueId(record.id);
    setQueueStatus(record.status);
    setMeta((current) =>
      current
        ? {
            draft_id: record.remoteDraftId ?? current.draft_id,
            internal_tracking_number: record.internalTrackingNumber ?? current.internal_tracking_number,
            public_reference_number: record.publicReferenceNumber ?? current.public_reference_number,
            status: record.status,
          }
        : current,
    );

    if (record.status === "queued") {
      setQueueNotice(offlineText.savedOffline);
    } else if (record.status === "syncing") {
      setQueueNotice("Queued report is syncing now.");
    } else if (record.status === "sent") {
      setQueueNotice("Queued report sent.");
    } else if (record.status === "failed" && record.lastError) {
      setQueueNotice(record.lastError);
    }
  };

  const persistQueuedReport = async (nextStatus: ReportQueueStatus, lastError: string | null = null) => {
    const localMeta = meta ?? {
      draft_id: createLocalQueueId(),
      internal_tracking_number: createLocalInternalTrackingNumber(),
      public_reference_number: createLocalReferenceNumber(),
      status: nextStatus,
    };

    const nextQueueId =
      queueId
      ?? (localMeta.draft_id.startsWith("local-draft-") ? localMeta.draft_id : `queue-${localMeta.draft_id}`);

    const record = await saveQueuedReport(nextQueueId, (current) => ({
      id: nextQueueId,
      createdAt: current?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: nextStatus,
      draft: { ...draft },
      routeState: {
        region: (routeState?.region ?? draft.region) || null,
        municipality: (routeState?.municipality ?? draft.municipality) || null,
      },
      clientContext,
      remoteDraftId:
        current?.remoteDraftId
        ?? (localMeta.draft_id.startsWith("local-draft-") ? null : localMeta.draft_id),
      localReference: current?.localReference ?? localMeta.public_reference_number,
      publicReferenceNumber: current?.publicReferenceNumber ?? localMeta.public_reference_number,
      internalTrackingNumber: current?.internalTrackingNumber ?? localMeta.internal_tracking_number,
      lastError,
    }));

    if (!meta) {
      setMeta(localMeta);
    }

    applyQueueRecord(record);
    return record;
  };

  const saveDraft = async (payload: Record<string, unknown>) => {
    if (!meta) return;
    setSaving(true);
    try {
      if (!navigator.onLine || meta.draft_id.startsWith("local-draft-")) {
        await persistQueuedReport("draft", null);
        setQueueNotice(offlineText.savedOffline);
        return;
      }

      const response = await fetch(`${API_BASE}/reports/${meta.draft_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error();
      if (queueId) {
        await persistQueuedReport("draft", null);
      }
    } catch (error) {
      if (!navigator.onLine || error instanceof TypeError) {
        await persistQueuedReport("draft", null);
        setQueueNotice(offlineText.savedOffline);
        return;
      }
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const validate = (currentStep: number) => {
    if (currentStep === 2 && !draft.reporter_group) return validationText.chooseGroup;
    if (currentStep === 3 && !draft.issue_target_type) return validationText.chooseTarget;
    if (currentStep === 4 && draft.issue_types.length === 0) return validationText.chooseTheme;
    if (currentStep === 5 && (!draft.handling_level || !draft.severity || draft.immediate_danger === null || !draft.affected_scope || !draft.region || !draft.municipality)) {
      return validationText.completeLocation;
    }
    if (currentStep === 6 && questions.some((q) => !draft.conditional_answers[q.id])) return validationText.focusedAnswers;
    if (currentStep === 7 && !draft.narrative.trim()) return validationText.details;
    return "";
  };

  const validatePanel = (currentStep: number, currentPanel: number) => {
    if (currentStep === 2) {
      if (currentPanel === 0 && !draft.reporter_group) return validationText.chooseGroup;
      return "";
    }
    if (currentStep === 3) {
      if (currentPanel === 0 && !draft.issue_target_type) return validationText.chooseTarget;
      return "";
    }
    if (currentStep === 4) return validate(4);
    if (currentStep === 5) {
      if (currentPanel === 0 && !draft.handling_level) return validationText.completeLocation;
      if (currentPanel === 1 && !draft.severity) return validationText.completeLocation;
      if (currentPanel === 2 && draft.immediate_danger === null) return validationText.completeLocation;
      if (currentPanel === 3 && !draft.affected_scope) return validationText.completeLocation;
      if (currentPanel === 4 && (!draft.region || !draft.municipality)) return validationText.completeLocation;
      return "";
    }
    if (currentStep === 6) {
      const question = questions[currentPanel];
      if (question && !draft.conditional_answers[question.id]) return validationText.focusedAnswers;
      return "";
    }
    if (currentStep === 7) {
      if (currentPanel === 0 && !draft.narrative.trim()) return validationText.details;
      return "";
    }
    return "";
  };

  const goNext = async () => {
    const panelMessage = validatePanel(step, activeQuestionIndex);
    if (panelMessage) {
      setError(panelMessage);
      return;
    }
    if (activeQuestionIndex < panelsPerStep - 1) {
      setError("");
      setPanelIndex((value) => Math.min(value + 1, panelsPerStep - 1));
      return;
    }
    const message = validate(step);
    if (message) {
      setError(message);
      return;
    }
    const payload = stepPayload(step, draft);
    setError("");
    if (payload) await saveDraft(payload);
    setStep((s) => Math.min(s + 1, 8));
  };

  const goBack = () => {
    setError("");
    if (activeQuestionIndex > 0) {
      setPanelIndex((value) => Math.max(value - 1, 0));
      return;
    }
    setStep((s) => Math.max(s - 1, 1));
  };

  const submitReport = async () => {
    if (!meta) return;
    const message = validate(7);
    if (message) {
      setError(message);
      setStep(7);
      return;
    }

    const hasRemoteDraft = !meta.draft_id.startsWith("local-draft-");

    if (!navigator.onLine || !hasRemoteDraft) {
      await persistQueuedReport("queued", null);
      setSubmitted(true);
      setError("");
      setQueueNotice(offlineText.savedOffline);
      void requestQueuedReportSync();
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/reports/${meta.draft_id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Error(data.detail || serviceText.error);
      }
      if (queueId) {
        await persistQueuedReport("sent", null);
      }
      setProgress(100);
      window.setTimeout(() => {
        setSubmitted(true);
        setSubmitting(false);
      }, 2600);
    } catch (err) {
      if (!navigator.onLine || err instanceof TypeError) {
        await persistQueuedReport("queued", null);
        setSubmitting(false);
        setSubmitted(true);
        setQueueNotice(offlineText.savedOffline);
        void requestQueuedReportSync();
        return;
      }

      await persistQueuedReport("failed", err instanceof Error ? err.message : serviceText.error);
      setError(err instanceof Error ? err.message : serviceText.error);
      setSubmitting(false);
    } finally {
      // success path closes after the brief secure-transfer hold above
    }
  };

  const copyReference = async () => {
    if (!meta) return;
    const ok = await copyText(meta.public_reference_number);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const destroyDraft = async () => {
    if (!meta || destroyingDraft) return;
    setDestroyingDraft(true);
    try {
      const localQueueKey =
        queueId ?? (meta.draft_id.startsWith("local-draft-") ? meta.draft_id : `queue-${meta.draft_id}`);

      if (meta.draft_id.startsWith("local-draft-")) {
        await deleteQueuedReport(localQueueKey);
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        }
        navigate("/", { replace: true });
        return;
      }

      const response = await fetch(`${API_BASE}/reports/${meta.draft_id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Error(data.detail || serviceText.error);
      }
      await deleteQueuedReport(localQueueKey).catch(() => undefined);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : serviceText.error);
      setDestroyingDraft(false);
      setShowClosePrompt(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-10 text-center">
            <img src="/femata-logo.jpeg" alt="FEMATA" className="mx-auto h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10" />
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-amber-300/30 border-t-amber-300" />
            <p className="mt-6 text-lg font-semibold">{serviceText.loading}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
          <div className="rounded-[32px] border border-rose-400/20 bg-rose-500/10 p-8 text-center">
            <img src="/femata-logo.jpeg" alt="FEMATA" className="mx-auto h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10" />
            <p className="text-lg font-semibold">{error || serviceText.error}</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">{serviceText.errorHelp}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setLoading(true);
                  setInitAttempt((value) => value + 1);
                }}
                className="inline-flex rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-5 py-3 text-sm font-semibold text-slate-950"
              >
                {serviceText.retry}
              </button>
            </div>
            <Link to="/" className="mt-6 inline-flex rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold">
              {text.home}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {celebrationParticles.map((particle) => (
            <span
              key={particle.id}
              className={`absolute top-[-10%] rounded-full opacity-80 ${particle.color} ${particle.size}`}
              style={{
                left: particle.left,
                animation: `petalFall ${particle.duration} linear ${particle.delay} infinite`,
              }}
            />
          ))}
          {fireworkBursts.map((burst) => (
            <span
              key={burst.id}
              className="absolute h-28 w-28 rounded-full"
              style={{
                left: burst.left,
                top: burst.top,
                animation: `fireworkBloom 2.8s ease-out ${burst.delay} infinite`,
                background:
                  "radial-gradient(circle, rgba(251,191,36,0.95) 0 10%, rgba(34,211,238,0.7) 10% 18%, rgba(16,185,129,0.55) 18% 26%, transparent 26% 100%)",
              }}
            />
          ))}
        </div>
        <div className="relative mx-auto max-w-4xl px-4 py-10">
          <Shell>
            <div className="flex items-center gap-4">
              <img src="/femata-logo.jpeg" alt="FEMATA" className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10" />
              <div className="text-sm uppercase tracking-[0.22em] text-amber-200">{text.brandTitle}</div>
            </div>
            <div className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
              {serviceText.protectedComplete}
            </div>
            <div className="mt-6 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/10 shadow-[0_0_30px_rgba(16,185,129,0.18)]">
              <svg viewBox="0 0 24 24" className="h-10 w-10 text-emerald-200" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <h1 className="mt-6 text-3xl font-bold">{text.submitted}</h1>
            <p className="mt-4 text-slate-300">{text.submittedBody}</p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-100/90">{text.submittedThanks}</p>
            {queueStatus && queueNotice ? (
              <div className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-4 text-sm leading-6 text-cyan-100">
                <span className="mr-2 inline-flex rounded-full border border-cyan-300/20 bg-slate-950/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  {queueStatusLabel}
                </span>
                {queueNotice}
              </div>
            ) : null}
            <div className="mt-8">
              <div className="rounded-[28px] border border-amber-300/20 bg-gradient-to-br from-amber-400/15 via-amber-300/10 to-emerald-400/10 p-5 shadow-[0_0_0_1px_rgba(251,191,36,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">{text.refTitle}</p>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-mono text-2xl font-bold sm:text-3xl">{meta.public_reference_number}</p>
                  <button type="button" onClick={copyReference} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold">
                    {copied ? text.copied : text.copy}
                  </button>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-100">{prompts.referenceAlert}</p>
              </div>
            </div>
            <Link to="/" className="mt-8 inline-flex rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-5 py-3 text-sm font-semibold text-slate-950">
              {text.home}
            </Link>
          </Shell>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <style>{`@keyframes stageFade { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } } @keyframes petalFall { 0% { transform: translate3d(0,-12vh,0) rotate(0deg) scale(0.7); opacity: 0; } 10% { opacity: 0.95; } 100% { transform: translate3d(18px,110vh,0) rotate(340deg) scale(1); opacity: 0; } } @keyframes fireworkBloom { 0% { transform: scale(0.2); opacity: 0; filter: blur(2px); } 18% { opacity: 0.95; } 55% { transform: scale(1); opacity: 0.55; filter: blur(0); } 100% { transform: scale(1.4); opacity: 0; filter: blur(1px); } } @keyframes transferSweep { 0% { transform: translateX(-120%); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateX(520%); opacity: 0; } } @keyframes vaultPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.18); transform: scale(1); } 50% { box-shadow: 0 0 0 18px rgba(251,191,36,0); transform: scale(1.03); } } @keyframes cueGlow { 0%,100% { transform: scaleX(0.92); opacity: 0.55; } 50% { transform: scaleX(1); opacity: 1; } } @keyframes vaultSweep { 0% { transform: translateY(-115%) rotate(8deg); opacity: 0; } 18% { opacity: 0.6; } 55% { opacity: 0.22; } 100% { transform: translateY(130%) rotate(8deg); opacity: 0; } } @keyframes orbitSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes signalBlink { 0%,100% { opacity: 0.35; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.05); } }`}</style>
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_26%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.16),transparent_22%)]" />
        <div className="relative mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-8">
            <main className="space-y-6">
              <Shell>
                <div className="flex items-center gap-3 sm:gap-4">
                  <img src="/femata-logo.jpeg" alt="FEMATA" className="h-12 w-12 rounded-2xl object-cover ring-1 ring-white/10 sm:h-14 sm:w-14" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">{text.brandTitle}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-emerald-200/80">{text.brandSubtitle}</p>
                  </div>
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">{text.eyebrow}</p>
                <h1 className="mt-4 text-xl font-bold leading-tight sm:text-2xl lg:text-4xl">{text.title}</h1>
                <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-200 sm:text-base sm:leading-7">{text.subtitle}</p>
                <div className="mt-6">
                  <div className="rounded-[24px] border border-amber-300/20 bg-gradient-to-br from-amber-400/15 via-amber-300/10 to-emerald-400/10 p-4 shadow-[0_0_0_1px_rgba(251,191,36,0.08)] sm:rounded-[28px] sm:p-5">
                    <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">{text.refTitle}</p>
                        <p className="mt-3 break-all font-mono text-xl font-bold sm:text-3xl">{meta.public_reference_number}</p>
                      </div>
                      <button type="button" onClick={copyReference} className="w-full rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold sm:w-auto">
                        {copied ? text.copied : text.copy}
                      </button>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-100">{text.refBody}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">{text.noAccountRequired}</span>
                      <span className="animate-pulse rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">{prompts.referencePulse}</span>
                      {draft.region ? <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white">{draft.region}</span> : null}
                      {draft.municipality ? <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white">{draft.municipality}</span> : null}
                      {draft.zone ? <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">{draft.zone}</span> : null}
                    </div>
                    <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm leading-6 text-slate-200">{prompts.referenceAlert}</p>
                  </div>
                </div>
              </Shell>
              <Shell>
                {step > 1 ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-200">{text.progress}</p>
                        <h2 className="mt-2 text-xl font-bold sm:text-2xl">{steps[step - 1]}</h2>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold">{text.step} {step} / {steps.length}</div>
                    </div>
                    <div className="mt-5">
                      <div className="h-2.5 rounded-full bg-white/10">
                        <div className="h-2.5 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-emerald-300 transition-all duration-300" style={{ width: `${(step / steps.length) * 100}%` }} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300 sm:text-xs">
                        <span className="text-left">{steps[Math.max(step - 2, 0)]}</span>
                        <span className="text-center text-amber-200">{steps[step - 1]}</span>
                        <span className="text-right">{steps[Math.min(step, steps.length - 1)]}</span>
                      </div>
                    </div>
                  </>
                ) : null}
                {error ? <div className="mt-6 rounded-3xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100">{error}</div> : null}
                {queueStatus && queueNotice ? (
                  <div className="mt-4 rounded-3xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                    <span className="mr-2 inline-flex rounded-full border border-cyan-300/20 bg-slate-950/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                      {queueStatusLabel}
                    </span>
                    {queueNotice}
                  </div>
                ) : null}
                {step > 1 && step < 8 && panelsPerStep > 1 ? (
                  <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/35 px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">{prompts.panelProgress}</p>
                        <p className="mt-2 truncate text-sm font-semibold text-white">{panelCueLabel}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {Array.from({ length: panelsPerStep }).map((_, index) => (
                          <span
                            key={`${step}-cue-${index}`}
                            className={`h-2 rounded-full transition-all duration-300 ${index < activeQuestionIndex ? "w-6 bg-emerald-300/70" : index === activeQuestionIndex ? "w-10 bg-gradient-to-r from-amber-300 via-amber-400 to-cyan-300" : "w-4 bg-white/10"}`}
                            style={index === activeQuestionIndex ? { animation: "cueGlow 1.4s ease-in-out infinite" } : undefined}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="mt-8 space-y-6">
                  <AnimatedStage stageKey={`${step}-${activeQuestionIndex}`}>
                  {step === 1 ? <div className="relative overflow-hidden rounded-[36px] border border-amber-300/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),linear-gradient(135deg,rgba(6,78,59,0.55),rgba(15,23,42,0.92),rgba(120,53,15,0.22))] p-6 sm:p-8"><div className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "22px 22px" }} /><div className="pointer-events-none absolute -left-12 top-6 h-36 w-36 rounded-full bg-emerald-300/10 blur-3xl" /><div className="pointer-events-none absolute right-0 top-0 h-44 w-44 rounded-full bg-amber-300/10 blur-3xl" /><div className="pointer-events-none absolute bottom-0 right-20 h-24 w-24 rounded-full bg-cyan-300/10 blur-2xl" /><div className="pointer-events-none absolute inset-y-0 left-[18%] w-24 bg-gradient-to-b from-transparent via-cyan-200/25 to-transparent blur-xl" style={{ animation: "vaultSweep 3.6s linear infinite" }} /><p className="relative text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">{text.startVaultEyebrow}</p><div className="relative mt-6 grid gap-8 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-center"><div className="relative mx-auto flex h-40 w-40 items-center justify-center"><div className="absolute inset-0 rounded-full border border-cyan-300/15" style={{ animation: "orbitSpin 16s linear infinite" }} /><div className="absolute inset-[14px] rounded-full border border-amber-300/20 border-dashed" style={{ animation: "orbitSpin 11s linear infinite reverse" }} /><div className="absolute inset-[28px] rounded-full border border-emerald-300/20 bg-slate-950/45 shadow-[0_0_0_1px_rgba(251,191,36,0.08)]" style={{ animation: "vaultPulse 2.4s ease-in-out infinite" }}><div className="absolute inset-4 rounded-full border border-white/10 bg-gradient-to-b from-white/5 to-transparent" /></div><span className="absolute left-3 top-7 h-2.5 w-2.5 rounded-full bg-cyan-300" style={{ animation: "signalBlink 1.8s ease-in-out infinite" }} /><span className="absolute bottom-8 right-2 h-2 w-2 rounded-full bg-emerald-300" style={{ animation: "signalBlink 2.1s ease-in-out infinite" }} /><span className="absolute right-8 top-3 h-1.5 w-1.5 rounded-full bg-amber-300" style={{ animation: "signalBlink 1.6s ease-in-out infinite" }} /><div className="relative flex h-24 w-24 items-center justify-center rounded-[30px] border border-amber-300/25 bg-slate-950/70 shadow-[0_20px_60px_rgba(15,23,42,0.45)]"><div className="absolute inset-x-3 top-3 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" /><svg viewBox="0 0 24 24" className="relative h-14 w-14 text-amber-200" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11a7 7 0 1114 0v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7z" /><path d="M12 15v2" /><circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" /></svg></div></div><div className="relative"><div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100"><span className="h-2 w-2 rounded-full bg-emerald-300" style={{ animation: "signalBlink 1.4s ease-in-out infinite" }} /> {text.secureLayer}</div><h3 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">{text.startVaultTitle}</h3><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">{text.startVaultBody}</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">{text.noAccountRequired}</span><span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">{text.refTitle}</span><span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">{text.step} 1</span></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">{text.vaultCard1Title}</p><p className="mt-2 text-sm text-slate-300">{text.vaultCard1Body}</p></div><div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">{text.vaultCard2Title}</p><p className="mt-2 text-sm text-slate-300">{text.vaultCard2Body}</p></div><div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">{text.vaultCard3Title}</p><p className="mt-2 text-sm text-slate-300">{text.vaultCard3Body}</p></div></div></div></div><div className="relative mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-sm leading-7 text-slate-300">{text.note}</p><button type="button" onClick={() => void goNext()} className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-7 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(251,191,36,0.22)]">{text.startVaultButton}</button></div></div> : null}
                  {step === 2 && activeQuestionIndex === 0 ? <div><div className="grid gap-3 md:grid-cols-2">{groupOptions.map((group) => <Card key={group.value} active={draft.reporter_group === group.value} title={group.title} body={group.body} onClick={() => setField("reporter_group", group.value)} />)}</div></div> : null}
                  {step === 2 && activeQuestionIndex === 1 ? <div><div className="grid gap-3 md:grid-cols-2">{valueRoleOptions.map((role) => <Card key={role.value} active={draft.value_chain_role === role.value} title={role.label} onClick={() => setField("value_chain_role", role.value)} />)}</div></div> : null}
                  {step === 3 && activeQuestionIndex === 0 ? <div className="space-y-6"><input type="text" value={targetQuery} onChange={(e) => setTargetQuery(e.target.value)} placeholder={prompts.searchTargets} className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm outline-none placeholder:text-slate-500" /><div className="grid gap-3 md:grid-cols-2">{filteredTargets.map((target) => <Card key={target.value} active={draft.issue_target_type === target.value} title={target.label} onClick={() => setField("issue_target_type", target.value)} />)}</div></div> : null}
                  {step === 3 && activeQuestionIndex === 1 ? <div className="space-y-5"><div className="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{prompts.selectedTarget}</p><p className="mt-2 text-lg font-semibold">{draft.issue_target_type ? getLocalizedLabel(targetOptions, draft.issue_target_type) : prompts.notSelected}</p><button type="button" onClick={() => { setField("issue_target_type", ""); setTargetQuery(""); setPanelIndex(0); }} className="mt-4 text-sm font-semibold text-cyan-200">{prompts.changeTarget}</button></div><div><label className="sr-only">{prompts.targetName}</label><input type="text" value={draft.issue_target_name} onChange={(e) => setField("issue_target_name", e.target.value)} placeholder={prompts.targetNamePlaceholder} className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm outline-none placeholder:text-slate-500" /></div></div> : null}
                  {step === 4 ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{themeOptions.map((theme) => <Card key={theme.value} active={draft.issue_types.includes(theme.value)} title={theme.label} onClick={() => setDraft((prev) => ({ ...prev, issue_types: prev.issue_types.includes(theme.value) ? prev.issue_types.filter((item) => item !== theme.value) : [...prev.issue_types, theme.value] }))} />)}</div> : null}
                  {step === 5 && activeQuestionIndex === 0 ? <div><div className="grid gap-3 md:grid-cols-2">{handlingLevelOptions.map((level) => <Card key={level.value} active={draft.handling_level === level.value} title={level.label} onClick={() => setField("handling_level", level.value)} />)}</div></div> : null}
                  {step === 5 && activeQuestionIndex === 1 ? <div><div className="grid gap-3 sm:grid-cols-2">{severityOptions.map((severity) => <Card key={severity.value} active={draft.severity === severity.value} title={severity.label} onClick={() => setField("severity", severity.value)} />)}</div></div> : null}
                  {step === 5 && activeQuestionIndex === 2 ? <div><div className="grid gap-3 sm:grid-cols-2">{dangerOptions.map((option) => <Card key={String(option.value)} active={draft.immediate_danger === option.value} title={option.label} onClick={() => setField("immediate_danger", option.value)} />)}</div></div> : null}
                  {step === 5 && activeQuestionIndex === 3 ? <div><div className="grid gap-3 md:grid-cols-3">{affectedScopeOptions.map((scope) => <Card key={scope.value} active={draft.affected_scope === scope.value} title={scope.label} onClick={() => setField("affected_scope", scope.value)} />)}</div></div> : null}
                  {step === 5 && activeQuestionIndex === 4 ? <div><div className="grid gap-6 lg:grid-cols-3"><div>{draft.region ? <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-4"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">{prompts.selectedRegion}</p><p className="mt-2 text-lg font-semibold">{draft.region}</p><button type="button" onClick={() => { setField("region", ""); setField("municipality", ""); setField("zone", ""); setRegionQuery(""); setMunicipalityQuery(""); }} className="mt-4 text-sm font-semibold text-emerald-200">{prompts.changeRegion}</button></div> : <div className="space-y-3"><input type="text" value={regionQuery} onChange={(e) => setRegionQuery(e.target.value)} placeholder={text.region} className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm outline-none placeholder:text-slate-500" />{regionQuery.trim() && normalizeLocation(regionQuery) !== normalizeLocation(draft.region) ? <div className="max-h-72 space-y-2 overflow-auto rounded-3xl border border-white/10 bg-slate-950/60 p-3">{filteredRegions.map((r) => <button key={r} type="button" onClick={() => { setField("region", r); setField("municipality", ""); setField("zone", zoneLookup[r] || ""); setRegionQuery(r); setMunicipalityQuery(""); }} className="w-full rounded-2xl bg-white/5 px-4 py-3 text-left text-sm hover:bg-white/10">{r}</button>)}</div> : null}</div>}</div><div>{draft.municipality ? <div className="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-4"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{prompts.selectedCouncil}</p><p className="mt-2 text-lg font-semibold">{draft.municipality}</p><button type="button" onClick={() => { setField("municipality", ""); setMunicipalityQuery(""); }} className="mt-4 text-sm font-semibold text-cyan-200">{prompts.changeCouncil}</button></div> : <div className="space-y-3"><input type="text" value={municipalityQuery} onChange={(e) => setMunicipalityQuery(e.target.value)} placeholder={text.municipality} disabled={!draft.region} className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm outline-none placeholder:text-slate-500 disabled:opacity-50" />{municipalityQuery.trim() && normalizeLocation(municipalityQuery) !== normalizeLocation(draft.municipality) ? <div className="max-h-72 space-y-2 overflow-auto rounded-3xl border border-white/10 bg-slate-950/60 p-3">{filteredMunicipalities.map((m) => <button key={m} type="button" onClick={() => { setField("municipality", m); setMunicipalityQuery(m); }} className="w-full rounded-2xl bg-white/5 px-4 py-3 text-left text-sm hover:bg-white/10">{m}</button>)}</div> : null}</div>}</div><div><div className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-4"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">{prompts.selectedZone}</p><p className="mt-2 text-lg font-semibold">{draft.zone || prompts.noZone}</p><p className="mt-3 text-sm text-slate-200">{t("reportZoneDerived")}</p></div></div></div></div> : null}
                  {step === 5 && activeQuestionIndex === 5 ? <div><label className="sr-only">{prompts.localArea}</label><input type="text" value={draft.local_area} onChange={(e) => setField("local_area", e.target.value)} placeholder={prompts.localAreaPlaceholder} className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm outline-none placeholder:text-slate-500" /></div> : null}
                  {step === 6 ? <div className="space-y-6">{questions[activeQuestionIndex] ? <div key={questions[activeQuestionIndex].id}><div className="grid gap-3 md:grid-cols-2">{questions[activeQuestionIndex].options.map((option) => <Card key={option.value} active={draft.conditional_answers[questions[activeQuestionIndex].id] === option.value} title={option.label} onClick={() => setDraft((prev) => ({ ...prev, conditional_answers: { ...prev.conditional_answers, [questions[activeQuestionIndex].id]: option.value } }))} />)}</div></div> : null}</div> : null}
                  {step === 7 && activeQuestionIndex === 0 ? <div><label className="sr-only">{prompts.narrative}</label><textarea value={draft.narrative} onChange={(e) => setField("narrative", e.target.value)} rows={7} className="w-full rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-4 text-sm leading-6 outline-none" /></div> : null}
                  {step === 7 && activeQuestionIndex === 1 ? <div><label className="sr-only">{prompts.desiredOutcome}</label><textarea value={draft.desired_outcome} onChange={(e) => setField("desired_outcome", e.target.value)} rows={4} className="w-full rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-4 text-sm leading-6 outline-none" /></div> : null}
                  {step === 8 ? <div className="space-y-6"><div className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-5"><p className="text-sm leading-6 text-slate-100">{text.note}</p></div><div className="grid gap-4 md:grid-cols-2"><div className="rounded-3xl border border-white/10 bg-white/5 p-5"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{prompts.reporterGroup}</p><p className="mt-3 text-lg font-semibold">{draft.reporter_group ? getLocalizedLabel(groupOptions.map((group) => ({ value: group.value, label: group.title })), draft.reporter_group) : prompts.notSelected}</p><p className="mt-2 text-sm text-slate-300">{draft.value_chain_role ? getLocalizedLabel(valueRoleOptions, draft.value_chain_role) : prompts.noValueChainRole}</p></div><div className="rounded-3xl border border-white/10 bg-white/5 p-5"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{prompts.issueTarget}</p><p className="mt-3 text-lg font-semibold">{draft.issue_target_type ? getLocalizedLabel(targetOptions, draft.issue_target_type) : prompts.notSelected}</p><p className="mt-2 text-sm text-slate-300">{draft.issue_target_name || prompts.noTargetName}</p></div><div className="rounded-3xl border border-white/10 bg-white/5 p-5"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{prompts.themesAndSeriousness}</p><p className="mt-3 text-sm leading-6 text-slate-300">{draft.issue_types.length ? draft.issue_types.map((item) => getLocalizedLabel(themeOptions, item)).join(", ") : prompts.noThemes}</p><p className="mt-3 text-sm">{draft.severity ? getLocalizedLabel(severityOptions, draft.severity) : prompts.noSeverity} | {draft.handling_level ? getLocalizedLabel(handlingLevelOptions, draft.handling_level) : prompts.noLevel} | {draft.immediate_danger === null ? prompts.dangerUnset : draft.immediate_danger ? prompts.immediateDanger : prompts.noImmediateDanger}</p></div><div className="rounded-3xl border border-white/10 bg-white/5 p-5"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{prompts.location}</p><p className="mt-3 text-lg font-semibold">{draft.region || prompts.noRegion} / {draft.municipality || prompts.noMunicipality}</p><p className="mt-2 text-sm text-slate-300">{draft.zone || prompts.noZone}</p><p className="mt-2 text-sm text-slate-300">{draft.local_area || prompts.noLocalArea}</p></div></div><div className="rounded-3xl border border-white/10 bg-white/5 p-5"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{prompts.narrativeSummary}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{draft.narrative || prompts.noNarrative}</p><p className="mt-4 text-sm leading-6 text-slate-300">{draft.desired_outcome || prompts.noDesiredOutcome}</p></div></div> : null}
                  </AnimatedStage>
                </div>
                <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between"><div className="text-sm text-slate-400">{saving ? prompts.saving : prompts.stored}</div><div className="flex flex-col gap-3 sm:flex-row">{step > 1 ? <button type="button" onClick={goBack} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold hover:bg-white/10">{text.back}</button> : null}<button type="button" onClick={() => setShowClosePrompt(true)} className="rounded-full border border-rose-300/20 bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-100 hover:bg-rose-500/15">{text.closeDraft}</button>{step === 1 ? null : step < 8 ? <button type="button" onClick={() => void goNext()} className="rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-5 py-3 text-sm font-semibold text-slate-950">{activeQuestionIndex < panelsPerStep - 1 ? prompts.nextQuestion : step === 7 ? prompts.reviewDetails : text.save}</button> : <button type="button" onClick={() => void submitReport()} className="rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950">{text.submit}</button>}</div></div>
              </Shell>
            </main>
            <aside className="hidden space-y-4 lg:block xl:space-y-6">
              <Shell><p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">{text.anonymousSafeguards}</p><div className="mt-4 space-y-3">{[text.anonymousSafeguard1, text.anonymousSafeguard2, text.anonymousSafeguard3].map((item) => <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300">{item}</div>)}</div></Shell>
              <Shell><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{text.publicFollowUp}</p><div className="mt-4 space-y-4"><div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4"><p className="text-sm font-semibold">{text.referenceNumber}</p><p className="mt-2 font-mono text-base text-cyan-200">{meta.public_reference_number}</p></div><div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4"><p className="text-sm font-semibold">{text.whatVisibleLater}</p><p className="mt-2 text-sm leading-6 text-slate-300">{text.visibleLaterBody}</p></div><div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4"><p className="text-sm font-semibold">{text.publicLookupRetention}</p><p className="mt-2 text-sm leading-6 text-slate-300">{text.retention}</p></div></div></Shell>
            </aside>
          </div>
        </div>
      </div>
      {submitting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 px-4">
          <div className="w-full max-w-xl rounded-[32px] border border-cyan-300/20 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              {serviceText.submitBadges.map((badge, index) => (
                <span key={badge} className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${index === phraseIndex ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-white/5 text-slate-400"}`}>
                  {badge}
                </span>
              ))}
            </div>
            <div className="mt-6 flex flex-col items-center text-center">
              <div
                className="relative flex h-36 w-36 items-center justify-center rounded-full border border-cyan-300/20 bg-slate-900/90 shadow-[0_0_40px_rgba(34,211,238,0.12)]"
                style={{
                  background: `conic-gradient(rgba(251,191,36,0.95) 0deg, rgba(34,211,238,0.95) ${progress * 3.6}deg, rgba(255,255,255,0.08) ${progress * 3.6}deg 360deg)`,
                }}
              >
                <div className="flex h-[118px] w-[118px] flex-col items-center justify-center rounded-full bg-slate-950/95">
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full border border-amber-300/20 bg-amber-400/10">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-amber-200" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
                      <path d="M10 11h4" />
                      <path d="M12 9v4" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-white">{progress}%</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">{serviceText.submitSeal}</p>
                </div>
              </div>
              <h2 className="mt-6 text-2xl font-bold">{serviceText.submitLoadingTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{serviceText.submitLoadingDesc}</p>
            </div>
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                <span>{serviceText.submitTransferLabel}</span>
                <span>{serviceText.submitStates[phraseIndex]}</span>
              </div>
              <div className="relative h-4 overflow-hidden rounded-full border border-white/10 bg-slate-900/90">
                <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-300/25 via-cyan-300/20 to-emerald-300/15 transition-all duration-300" style={{ width: `${Math.max(progress, 8)}%` }} />
                <div className="absolute inset-y-[2px] w-24 rounded-full bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent blur-[1px]" style={{ animation: "transferSweep 1.55s linear infinite" }} />
                <div className="absolute inset-y-0 left-0 w-full opacity-70" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 10px, transparent 10px 18px)" }} />
              </div>
            </div>
            <div className="mt-6 rounded-[28px] border border-white/10 bg-slate-900/75 p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <span>{serviceText.submitBadges[0]}</span>
                <span>{serviceText.submitSeal}</span>
              </div>
              <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-cyan-300/10 bg-slate-950/70 px-4 py-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-400/10">
                  <img src="/femata-logo.jpeg" alt="FEMATA" className="h-9 w-9 rounded-xl object-cover" />
                </div>
                <div className="relative h-[2px] flex-1 rounded-full bg-white/10">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-300 via-cyan-300 to-emerald-300 transition-all duration-500" style={{ width: `${progress}%` }} />
                  <span
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.55)]"
                    style={{ left: `calc(${Math.max(progress, 8)}% - 7px)` }}
                  />
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-200" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </div>
                <div className="pointer-events-none absolute inset-y-0 left-0 w-28 animate-[transferSweep_1.8s_linear_infinite] bg-gradient-to-r from-transparent via-cyan-300/10 to-transparent" />
              </div>
            </div>
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-200">
                <span>{serviceText.submitStates[phraseIndex]}</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-4 rounded-full bg-white/5 p-1">
                <div className="h-3 rounded-full bg-gradient-to-r from-amber-300 via-cyan-300 to-emerald-300 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showClosePrompt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 px-4">
          <div className="w-full max-w-lg overflow-hidden rounded-[32px] border border-rose-300/20 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
            <div className="relative overflow-hidden border-b border-white/10 px-6 py-6">
              <div className="pointer-events-none absolute -left-8 top-0 h-28 w-28 rounded-full bg-rose-300/10 blur-3xl" />
              <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-amber-300/10 blur-3xl" />
              <div className="relative flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-rose-300/20 bg-rose-500/10 shadow-[0_0_30px_rgba(251,113,133,0.14)]">
                  <svg viewBox="0 0 24 24" className="h-8 w-8 text-rose-200" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 11a7 7 0 1114 0v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7z" />
                    <path d="M9 15l6-6" />
                    <path d="M9 9l6 6" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-200">{text.closeDraft}</p>
                  <h3 className="mt-2 text-2xl font-bold text-white">{text.closeDraftTitle}</h3>
                </div>
              </div>
            </div>
            <div className="px-6 py-6">
              {destroyingDraft ? (
                <div className="rounded-[26px] border border-rose-300/20 bg-rose-500/10 p-5">
                  <div className="relative h-3 overflow-hidden rounded-full bg-white/10">
                    <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-rose-300/20 via-amber-300/20 to-transparent" />
                    <div className="absolute inset-y-[2px] w-24 rounded-full bg-gradient-to-r from-transparent via-rose-200/85 to-transparent blur-[1px]" style={{ animation: "transferSweep 1.25s linear infinite" }} />
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-200">{text.closeDraftDeleting}</p>
                </div>
              ) : (
                <>
                  <p className="text-sm leading-7 text-slate-200">{text.closeDraftBody}</p>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300">
                    {meta ? `${text.refTitle}: ${meta.public_reference_number}` : ""}
                  </div>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => setShowClosePrompt(false)} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
                      {text.closeDraftKeep}
                    </button>
                    <button type="button" onClick={() => void destroyDraft()} className="rounded-full bg-gradient-to-r from-rose-300 via-rose-400 to-amber-300 px-5 py-3 text-sm font-semibold text-slate-950">
                      {text.closeDraftConfirm}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ReportPage;

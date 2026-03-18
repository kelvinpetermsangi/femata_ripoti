import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { changeAppLanguage, supportedLanguages, type SupportedLanguageCode, useEnabledSupportedLanguages } from "../i18n";
import { normalizeLocation as normalize, regionMunicipalityMap, regions } from "../data/tanzaniaLocations";
import { API_BASE } from "../lib/apiBase";
import TalkToAgentModal from "../components/TalkToAgentModal";

// `TranslationShape` type removed â€” translations are now provided from `src/i18n.ts`.

type LanguageItem = (typeof supportedLanguages)[number];

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const rtlLanguages = new Set(["ar"]);
const trustBadgeTranslations: Record<string, string[]> = {
  sw: ["Salama", "Imesimbwa", "24/7", "Bila Utambulisho", "Inaaminika"],
  en: ["Secure", "Encrypted", "24/7", "Anonymous", "Trusted"],
  fr: ["Securise", "Chiffre", "24/7", "Anonyme", "Fiable"],
  zh: ["安全", "已加密", "24/7", "匿名", "可信"],
  hi: ["सुरक्षित", "एन्क्रिप्टेड", "24/7", "गुमनाम", "विश्वसनीय"],
  bn: ["নিরাপদ", "এনক্রিপ্টেড", "24/7", "গোপনীয়", "বিশ্বস্ত"],
  ar: ["آمن", "مشفر", "24/7", "مجهول", "موثوق"],
  de: ["Sicher", "Verschluesselt", "24/7", "Anonym", "Vertraut"],
  am: ["ደህንነቱ የተጠበቀ", "የተመሰጠረ", "24/7", "ማንነት ያልታወቀ", "የታመነ"],
  ko: ["보안", "암호화", "24/7", "익명", "신뢰"],
  th: ["ปลอดภัย", "เข้ารหัส", "24/7", "ไม่ระบุตัวตน", "เชื่อถือได้"],
};

const isStandaloneInstall = () => {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
};

const iosInstallInstructions = () =>
  typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

const LandingPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const enabledLanguages = useEnabledSupportedLanguages();
  const currentLanguage = i18n.resolvedLanguage || i18n.language;
  const adminLoginPath = useMemo(
    () => `/admin/login?lang=${encodeURIComponent(currentLanguage || "sw")}`,
    [currentLanguage],
  );
  const trustBadgeLabels = trustBadgeTranslations[currentLanguage] ?? trustBadgeTranslations.en;
  const secureStages = [
    t("secureHandoffStage1"),
    t("secureHandoffStage2"),
    t("secureHandoffStage3"),
  ];

  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showLanguageToast, setShowLanguageToast] = useState(false);
  const [languageQuery, setLanguageQuery] = useState("");

  const [showReportWizard, setShowReportWizard] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showServicesDisclaimerModal, setShowServicesDisclaimerModal] = useState(false);
  const [showTalkToAgent, setShowTalkToAgent] = useState(false);
  const [isLandingScrolling, setIsLandingScrolling] = useState(false);
  const [activePrivacySection, setActivePrivacySection] = useState(1);
  const [activeTermsSection, setActiveTermsSection] = useState(1);
  const [activeServicesDisclaimerSection, setActiveServicesDisclaimerSection] = useState(1);

  const [reportStep, setReportStep] = useState(1);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedMunicipality, setSelectedMunicipality] = useState("");
  const [zoneLookup, setZoneLookup] = useState<Record<string, string>>({});
  const [regionQuery, setRegionQuery] = useState("");
  const [municipalityQuery, setMunicipalityQuery] = useState("");

  const [referenceNumber, setReferenceNumber] = useState("");
  const [trackingError, setTrackingError] = useState("");

  const [showSecureLoader, setShowSecureLoader] = useState(false);
  const [secureProgress, setSecureProgress] = useState(0);
  const [secureTextIndex, setSecureTextIndex] = useState(0);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [pendingState, setPendingState] = useState<Record<string, string> | undefined>(undefined);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installStatusText, setInstallStatusText] = useState("");

  const scrollToTop = () => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

  const filteredRegions = useMemo(() => {
    if (!regionQuery.trim()) return [];
    return regions.filter((region) => normalize(region).includes(normalize(regionQuery)));
  }, [regionQuery]);

  const showRegionResults =
    regionQuery.trim().length > 0 &&
    !(selectedRegion && normalize(regionQuery) === normalize(selectedRegion));

  const municipalities = useMemo(() => {
    if (!selectedRegion) return [];
    return [...(regionMunicipalityMap[selectedRegion] || [])].sort((a, b) => a.localeCompare(b));
  }, [selectedRegion]);

  const filteredMunicipalities = useMemo(() => {
    if (!municipalityQuery.trim()) return [];
    return municipalities.filter((item: string) => normalize(item).includes(normalize(municipalityQuery)));
  }, [municipalityQuery, municipalities]);

  const showMunicipalityResults =
    municipalityQuery.trim().length > 0 &&
    !(selectedMunicipality && normalize(municipalityQuery) === normalize(selectedMunicipality));

  const currentLanguageOption =
    enabledLanguages.find((item: LanguageItem) => item.code === currentLanguage)
    ?? supportedLanguages.find((item: LanguageItem) => item.code === currentLanguage);
  const selectedZone = selectedRegion ? zoneLookup[selectedRegion] || "" : "";
  const landingChatState = showSecureLoader ? "Loader" : isLandingScrolling ? "Scrolling" : "Chat";
  const landingChatCity = selectedMunicipality || selectedRegion || "Dar es Salaam";

  const filteredLanguages = useMemo(() => {
    const query = normalize(languageQuery);
    if (!query) return enabledLanguages;
    return enabledLanguages.filter((item: LanguageItem) => normalize(item.label).includes(query) || normalize(item.searchText).includes(query));
  }, [enabledLanguages, languageQuery]);

  useEffect(() => {
    // Keep document metadata aligned with the active language, including RTL layout.
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.lang = currentLanguage || "en";
      document.documentElement.dir = rtlLanguages.has(currentLanguage) ? "rtl" : "ltr";
    }
  }, [currentLanguage]);

  useEffect(() => {
    let active = true;
    const loadZones = async () => {
      try {
        const response = await fetch(`${API_BASE}/meta/zones`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { region_to_zone?: Record<string, string> };
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
    scrollToTop();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsInstalled(isStandaloneInstall());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
      setInstallStatusText("");
      setInstallProgress(0);
      setIsInstalling(false);
    };

    const onAppInstalled = () => {
      setInstallPromptEvent(null);
      setIsInstalled(true);
      setInstallProgress(100);
      setIsInstalling(false);
      setInstallStatusText("Installed. Check your Home Screen or app drawer for FEMATA Ripoti.");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("openReportWizard") !== "1") return;

    setShowReportWizard(true);
    setReportStep(1);
    setSelectedRegion("");
    setSelectedMunicipality("");
    setRegionQuery("");
    setMunicipalityQuery("");
    scrollToTop();

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("openReportWizard");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!showLanguageToast) return;
    const timeout = window.setTimeout(() => setShowLanguageToast(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [showLanguageToast]);

  useEffect(() => {
    let scrollTimeout = 0;

    const onScroll = () => {
      if (window.scrollY <= 0) return;
      setIsLandingScrolling(true);
      window.clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(() => {
        setIsLandingScrolling(false);
      }, 900);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(scrollTimeout);
    };
  }, []);

  useEffect(() => {
    if (!showSecureLoader || !pendingPath) return;

    setSecureProgress(0);
    setSecureTextIndex(0);

    const progressInterval = window.setInterval(() => {
      setSecureProgress((prev) => Math.min(prev + 4, 100));
    }, 120);

    const textInterval = window.setInterval(() => {
      setSecureTextIndex((prev) => (secureStages.length ? (prev + 1) % secureStages.length : 0));
    }, 900);

    const timeout = window.setTimeout(() => {
      window.clearInterval(progressInterval);
      window.clearInterval(textInterval);
      setShowSecureLoader(false);
      // navigate to pending path (pass state when present)
      if (pendingPath) {
        navigate(pendingPath, pendingState ? { state: pendingState } : undefined);
      }
      setPendingPath(null);
      setPendingState(undefined);
    }, 2800);

    return () => {
      window.clearInterval(progressInterval);
      window.clearInterval(textInterval);
      window.clearTimeout(timeout);
    };
  }, [showSecureLoader, pendingPath, pendingState, navigate, secureStages.length]);

  const startSecureNavigation = (path: string, state?: Record<string, string>) => {
    setPendingPath(path);
    setPendingState(state);
    setShowSecureLoader(true);
  };

  const openReportWizard = () => {
    setShowReportWizard(true);
    setReportStep(1);
    setSelectedRegion("");
    setSelectedMunicipality("");
    setRegionQuery("");
    setMunicipalityQuery("");
  };

  const handleNextReportStep = () => {
    if (reportStep === 1 && !selectedRegion) {
      alert(t("reportWizardAlert1"));
      return;
    }
    if (reportStep === 2 && !selectedMunicipality) {
      alert(t("reportWizardAlert2"));
      return;
    }
    setReportStep((prev) => Math.min(prev + 1, 3));
  };

  const handlePreviousReportStep = () => {
    setReportStep((prev) => Math.max(prev - 1, 1));
  };

  const handleProceedToReport = () => {
    if (!selectedRegion || !selectedMunicipality) {
      alert(t("reportWizardAlert3"));
      return;
    }
    setShowReportWizard(false);
    startSecureNavigation("/report", { region: selectedRegion, municipality: selectedMunicipality });
  };

  const handleCloseReportWizard = () => {
    setShowReportWizard(false);
    scrollToTop();
  };

  const handleLanguageChange = async (code: SupportedLanguageCode) => {
    await changeAppLanguage(code);
    setShowLanguageMenu(false);
    setLanguageQuery("");
    setShowLanguageToast(true);
  };

  const openPrivacyModal = () => {
    setActivePrivacySection(1);
    setShowPrivacyModal(true);
  };

  const openTermsModal = () => {
    setActiveTermsSection(1);
    setShowTermsModal(true);
  };

  const openServicesDisclaimerModal = () => {
    setActiveServicesDisclaimerSection(1);
    setShowServicesDisclaimerModal(true);
  };

  const handleChangeRegion = () => {
    setSelectedRegion("");
    setSelectedMunicipality("");
    setMunicipalityQuery("");
    setRegionQuery("");
  };

  const handleChangeMunicipality = () => {
    setSelectedMunicipality("");
    setMunicipalityQuery("");
  };

  const handleTrackLookup = async () => {
    const trimmedRef = referenceNumber.trim().toUpperCase();
    if (!trimmedRef) {
      setTrackingError(t("trackAlert1"));
      return;
    }

    setTrackingError("");
    setShowTrackModal(false);
    navigate(`/track?reference=${encodeURIComponent(trimmedRef)}`);
  };

  const handleInstallApp = async () => {
    if (isStandaloneInstall()) {
      setIsInstalled(true);
      setInstallProgress(100);
      setInstallStatusText("Already installed. You can open FEMATA Ripoti from your apps.");
      return;
    }

    if (!installPromptEvent) return;

    setIsInstalling(true);
    setInstallProgress(5);
    setInstallStatusText("Preparing install...");

    const progressTimer = window.setInterval(() => {
      setInstallProgress((current) => Math.min(current + 7, 90));
    }, 140);

    try {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") {
        setInstallProgress(100);
        setInstallStatusText("Finishing install...");
      } else {
        setInstallProgress(0);
        setInstallStatusText("Install canceled.");
      }
    } finally {
      window.clearInterval(progressTimer);
      setInstallPromptEvent(null);
      window.setTimeout(() => setIsInstalling(false), 700);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_28%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.16),transparent_24%)]" />

        <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-white/5 px-4 py-3 backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/femata-logo.jpeg" alt={t('logoAlt')} className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/10" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-amber-200">{t("heroEyebrow")}</p>
                <p className="truncate text-xs text-white/70">{t("headerSubtitle")}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {!isInstalled && installPromptEvent && (
                <button
                  type="button"
                  onClick={() => void handleInstallApp()}
                  disabled={isInstalling}
                  className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isInstalling ? "Installing..." : "Install App"}
                </button>
              )}
              <button
                type="button"
                onClick={() => startSecureNavigation(adminLoginPath)}
                className="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/15"
              >
                {t("adminDashboardLink")}
              </button>
              <button
                type="button"
                onClick={openPrivacyModal}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
              >
                {t("privacyLink")}
              </button>
              <button
                type="button"
                onClick={openTermsModal}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
              >
                {t("termsLink")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLanguageQuery("");
                  setShowLanguageMenu(true);
                }}
                className="group inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100 shadow-[0_0_25px_rgba(34,211,238,0.08)] transition hover:bg-cyan-400/15"
              >
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                <span>{currentLanguageOption?.label ?? "Language"}</span>
                <span className="text-cyan-200/80">&#9662;</span>
              </button>
            </div>
            {(isInstalling || installStatusText || (!isInstalled && !installPromptEvent && iosInstallInstructions())) ? (
              <div className="w-full rounded-2xl border border-emerald-300/15 bg-emerald-400/10 px-4 py-3 text-right text-xs font-medium text-emerald-100">
                {isInstalling ? (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100/90">
                      {installStatusText}
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-900/40">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-300 to-emerald-500 transition-all duration-200"
                        style={{ width: `${installProgress}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-emerald-100/90">{installProgress}%</div>
                  </div>
                ) : (
                  installStatusText || "Open in Safari > Share > Add to Home Screen"
                )}
              </div>
            ) : null}
          </div>

          <div className="grid gap-10 py-10 lg:grid-cols-2 lg:items-center lg:py-16">
            <div className="max-w-2xl">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-amber-200">{t("heroEyebrow")}</p>
              <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">{t("heroTitle")}</h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">{t("heroDesc")}</p>
              <div className="mt-6 rounded-3xl border border-emerald-300/10 bg-gradient-to-r from-white/5 to-amber-400/5 p-5 backdrop-blur-md">
                <p className="text-sm leading-6 text-slate-200">{t("anonymousNote")}</p>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{t("systemTitle")}</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{t("systemCardTitle")}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{t("systemDesc")}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{t("securityTitle")}</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{t("securityCardTitle")}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{t("securityDesc")}</p>
                </div>
              </div>
            </div>

            <div className="lg:justify-self-end">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-md md:p-6">
                <div className="rounded-[28px] bg-white p-5 text-slate-900 md:p-6">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-emerald-700">{t("servicesTitle")}</p>
                      <h2 className="text-2xl font-bold text-slate-900">{t("servicesSubtitle")}</h2>
                    </div>
                    <div className="flex max-w-[260px] flex-wrap justify-end gap-2">
                      {[
                        { label: trustBadgeLabels[0], tone: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
                        { label: trustBadgeLabels[1], tone: "border-cyan-200 bg-cyan-50 text-cyan-800", dot: "bg-cyan-500" },
                        { label: trustBadgeLabels[2], tone: "border-sky-200 bg-sky-50 text-sky-800", dot: "bg-sky-500" },
                        { label: trustBadgeLabels[3], tone: "border-violet-200 bg-violet-50 text-violet-800", dot: "bg-violet-500" },
                        { label: trustBadgeLabels[4], tone: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
                      ].map((item: { label: string; tone: string; dot: string }) => (
                        <span
                          key={item.label}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${item.tone}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <button type="button" onClick={openReportWizard} className="group block w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-amber-300 hover:bg-white hover:shadow-md">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{t("reportTitle")}</h3>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{t("reportDesc")}</p>
                          <p className="mt-3 text-sm font-medium text-emerald-700">{t("reportPrivacy")}</p>
                        </div>
                        <span className="text-amber-700 transition group-hover:translate-x-1">&rarr;</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowTrackModal(true);
                        setReferenceNumber("");
                        setTrackingError("");
                      }}
                      className="group block w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-cyan-300 hover:bg-white hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{t("trackTitle")}</h3>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{t("trackDesc")}</p>
                          <p className="mt-3 text-sm font-medium text-cyan-700">{t("trackPrivacy")}</p>
                        </div>
                        <span className="text-cyan-700 transition group-hover:translate-x-1">&rarr;</span>
                      </div>
                    </button>

                  </div>

                  <button
                    type="button"
                    onClick={openServicesDisclaimerModal}
                    className="mt-6 block w-full rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-amber-50 p-4 text-left transition hover:shadow-md"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{t("servicesDisclaimerTitle")}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-800">{t("servicesDisclaimer")}</p>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <section className="pb-14">
            <div className="mb-8 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">{t("howItWorksTitle")}</p>
              <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">{t("howItWorksDesc")}</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {[
                [1, t("step1Title"), t("step1Desc")],
                [2, t("step2Title"), t("step2Desc")],
                [3, t("step3Title"), t("step3Desc")],
                [4, t("step4Title"), t("step4Desc")],
              ].map(([num, title, desc]) => (
                <div key={String(num)} className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-sm backdrop-blur-md">
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/15 font-bold text-amber-200 ring-1 ring-amber-300/20">{String(num)}</div>
                  <h3 className="text-xl font-semibold text-white">{String(title)}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{String(desc)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="pb-8">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                <div className="mb-5 flex items-center gap-4 rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white/95 p-2">
                    <img
                      src="/femata-logo.jpeg"
                      alt={t('logoAlt')}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">{t("aboutTitle")}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{t("headerSubtitle")}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">{t("aboutTitle")}</p>
                <h3 className="mt-3 text-2xl font-bold text-white">{t("aboutHeading")}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">{t("aboutDesc")}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{t("systemTitle")}</p>
                    <p className="mt-2 text-sm text-slate-300">{t("systemDesc")}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{t("securityTitle")}</p>
                    <p className="mt-2 text-sm text-slate-300">{t("securityDesc")}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                <div className="mb-5 rounded-[24px] border border-white/10 bg-gradient-to-br from-white via-amber-50 to-sky-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">{t("visionTitle")}</p>
                      <p className="mt-2 text-sm text-slate-600">{t("visionHeading")}</p>
                    </div>
                    <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">2030</div>
                  </div>
                </div>
                <div className="flex items-center justify-center overflow-hidden rounded-[24px] border border-white/10 bg-white/95 p-4">
                  <img
                    src="/vision-2030.jpeg"
                    alt={t("visionHeading")}
                    className="h-32 w-full max-w-[320px] object-contain sm:h-40"
                  />
                </div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">{t("visionTitle")}</p>
                <h3 className="mt-3 text-2xl font-bold text-white">{t("visionHeading")}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">{t("visionDesc")}</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer className="border-t border-white/10 bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-sm text-slate-400 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>{t("footerText")}</p>
          <p className="lg:text-right">
            {t('maintainedBy')}{" "}
            <a href="https://ottana.site" target="_blank" rel="noreferrer" className="font-medium text-amber-300 hover:text-amber-200">
              Ottana Creatives
            </a>
          </p>
        </div>
      </footer>

      {/* NEW LANGUAGE POPUP MODAL */}
      {showLanguageMenu && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[30px] border border-cyan-300/20 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-white">{t("languageModalTitle")}</h3>
                <p className="mt-2 text-sm text-slate-300">{t("languageModalDesc")}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLanguageMenu(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-300 hover:bg-white/10"
              >
                &times;
              </button>
            </div>

            <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t("languageSearchLabel")}</span>
                <input
                  type="text"
                  value={languageQuery}
                  onChange={(e) => setLanguageQuery(e.target.value)}
                  placeholder={t("languageSearchPlaceholder")}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                />
              </label>
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">{t("languageCurrentLabel")}</p>
                <p className="mt-2 text-sm font-semibold text-white">{currentLanguageOption?.label ?? t("languageFallbackName")}</p>
              </div>
            </div>

            <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-2 sm:grid-cols-2">
              {filteredLanguages.map((item: LanguageItem) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleLanguageChange(item.code)}
                  className={`rounded-3xl border px-4 py-4 text-left transition ${
                    currentLanguage === item.code
                      ? "border-cyan-300/40 bg-cyan-400/15 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.08)]"
                      : "border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-6">{item.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{item.displayName}</p>
                    </div>
                    {currentLanguage === item.code && (
                      <span className="rounded-full bg-cyan-300/15 px-2 py-1 text-xs font-semibold text-cyan-200">{t("languageSelected")}</span>
                    )}
                  </div>
                </button>
              ))}
              {filteredLanguages.length === 0 && (
                <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-400 sm:col-span-2">
                  {t("languageEmptyState")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showReportWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
          <div className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-6 flex items-start gap-4">
              <img src="/femata-logo.jpeg" alt={t('logoAlt')} className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10" />
              <div>
                <h3 className="text-2xl font-bold text-white">{t("reportWizardTitle")}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{t("reportWizardDesc")}</p>
              </div>
            </div>

            <div className="mb-6 flex items-center gap-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold ${
                      reportStep === step ? "bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/30" : "bg-white/5 text-slate-400 ring-1 ring-white/10"
                    }`}
                  >
                    {step}
                  </div>
                  {step < 3 && <div className="h-px w-6 bg-white/10 sm:w-10" />}
                </div>
              ))}
            </div>

            {reportStep === 1 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{t('stepLabel', { num: 1 })}</p>
                  <p className="mt-2 text-sm text-white">{t("step1Hint")}</p>
                </div>
                {selectedRegion ? (
                  <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{t("regionLabel")}</p>
                        <p className="mt-2 text-sm font-medium text-white">{selectedRegion}</p>
                        {selectedZone ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">{selectedZone}</p> : null}
                      </div>
                      <button
                        type="button"
                        onClick={handleChangeRegion}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10"
                      >
                        {t("back")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-200">{t("regionSearchLabel")}</label>
                      <input
                        type="text"
                        value={regionQuery}
                        onChange={(e) => {
                          setRegionQuery(e.target.value);
                          setSelectedRegion("");
                          setSelectedMunicipality("");
                          setMunicipalityQuery("");
                        }}
                        placeholder={t("step1Empty")}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-400 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
                      />
                    </div>
                    {showRegionResults && (
                      <div className="max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-2">
                        {filteredRegions.length > 0 ? (
                          <div className="space-y-2">
                            {filteredRegions.map((region) => (
                              <button
                                key={region}
                                type="button"
                                onClick={() => {
                                  setSelectedRegion(region);
                                  setSelectedMunicipality("");
                                  setMunicipalityQuery("");
                                  setRegionQuery(region);
                                }}
                                className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition ${selectedRegion === region ? "bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/30" : "bg-white/5 text-slate-200 hover:bg-white/10"}`}
                              >
                                {region}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="px-3 py-4 text-sm text-slate-400">{t("noResults")}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {reportStep === 2 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{t('stepLabel', { num: 2 })}</p>
                  <p className="mt-2 text-sm text-white">{t("step2Hint")} {selectedRegion}.</p>
                </div>
                {selectedMunicipality ? (
                  <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">{t("municipalityLabel")}</p>
                        <p className="mt-2 text-sm font-medium text-white">{selectedMunicipality}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleChangeMunicipality}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10"
                      >
                        {t("back")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-200">{t("municipalitySearchLabel")}</label>
                      <input
                        type="text"
                        value={municipalityQuery}
                        onChange={(e) => {
                          setMunicipalityQuery(e.target.value);
                          setSelectedMunicipality("");
                        }}
                        placeholder={t("step2Empty")}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-400 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-300/20"
                      />
                    </div>
                    {showMunicipalityResults && (
                      <div className="max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-2">
                        {filteredMunicipalities.length > 0 ? (
                          <div className="space-y-2">
                            {filteredMunicipalities.map((item: string) => (
                              <button
                                key={item}
                                type="button"
                                onClick={() => {
                                  setSelectedMunicipality(item);
                                  setMunicipalityQuery(item);
                                }}
                                className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition ${selectedMunicipality === item ? "bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/30" : "bg-white/5 text-slate-200 hover:bg-white/10"}`}
                              >
                                {item}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="px-3 py-4 text-sm text-slate-400">{t("noResults")}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {reportStep === 3 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">{t('stepLabel', { num: 3 })}</p>
                  <p className="mt-2 text-sm text-white">{t("step3Hint")}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-200">
                  <p>
                    <span className="font-semibold text-white">{t("regionLabel")}</span> {selectedRegion}
                  </p>
                  <p>
                    <span className="font-semibold text-white">{t("municipalityLabel")}</span> {selectedMunicipality}
                  </p>
                  {selectedZone ? (
                    <p>
                      <span className="font-semibold text-white">{t("zoneLabel")}</span> {selectedZone}
                    </p>
                  ) : null}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {reportStep > 1 && (
                <button type="button" onClick={handlePreviousReportStep} className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10">
                  {t("back")}
                </button>
              )}
              {reportStep < 3 ? (
                <button type="button" onClick={handleNextReportStep} className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 px-5 py-3 font-semibold text-slate-950 transition hover:opacity-95">
                  {t("next")}
                </button>
              ) : (
                <button type="button" onClick={handleProceedToReport} className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 px-5 py-3 font-semibold text-slate-950 transition hover:opacity-95">
                  {t("submitProceed")}
                </button>
              )}
              <button type="button" onClick={handleCloseReportWizard} className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10">
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTrackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
          <div className="w-full max-w-xl rounded-[30px] border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-6 flex items-start gap-4">
              <img src="/femata-logo.jpeg" alt={t('logoAlt')} className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10" />
              <div>
                <h3 className="text-2xl font-bold text-white">{t("trackModalTitle")}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{t("trackModalDesc")}</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">{t("trackInputLabel")}</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value.toUpperCase())}
                  placeholder={t("trackInputPlaceholder")}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleTrackLookup}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:opacity-95 disabled:opacity-70"
                >
                  {t("trackAction")}
                </button>
                <button type="button" onClick={() => setShowTrackModal(false)} className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10">
                  {t("close")}
                </button>
              </div>
              {trackingError && <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-200">{trackingError}</div>}
            </div>
          </div>
        </div>
      )}

      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-slate-950/80 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:px-4 sm:py-6">
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-slate-900 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-[30px]">
            <div className="relative shrink-0 border-b border-white/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(251,191,36,0.08),rgba(15,23,42,0.94))] p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 pr-14 sm:pr-16">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{t("privacyBadge")}</p>
                  <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">{t("privacyTitle")}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{t('privacy_para1')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(false)}
                  className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-950/40 text-xl font-semibold text-white transition hover:bg-white/10 sm:right-6 sm:top-6"
                  aria-label={t("close")}
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pr-2 text-sm leading-7 text-slate-300 sm:p-6 sm:pr-4">
              {[
                {
                  id: 1,
                  title: t('privacy_section1_title'),
                  content: <p>{t('privacy_section1_text')}</p>,
                },
                {
                  id: 2,
                  title: t('privacy_section2_title'),
                  content: <p>{t('privacy_section2_text')}</p>,
                },
                {
                  id: 3,
                  title: t('privacy_section3_title'),
                  content: <p>{t('privacy_section3_text')}</p>,
                },
                {
                  id: 4,
                  title: t('privacy_section4_title'),
                  content: (
                    <>
                      <p>{t('privacy_section4_text')}</p>
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-200">
                        {(t('privacy_list_1', { returnObjects: true }) as string[]).map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </>
                  ),
                },
                {
                  id: 5,
                  title: t('privacy_section5_title'),
                  content: <p>{t('privacy_section5_text')}</p>,
                },
              ].map((section) => (
                <div key={section.id} className="rounded-3xl border border-white/10 bg-white/5">
                  <button
                    type="button"
                    onClick={() => setActivePrivacySection((prev) => (prev === section.id ? 0 : section.id))}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t("documentSectionLabel", { num: section.id, defaultValue: `Section ${section.id}` })}</p>
                      <h4 className="mt-1 text-lg font-semibold text-white">{section.title}</h4>
                    </div>
                    <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs font-semibold text-slate-300">
                      {activePrivacySection === section.id ? t("documentOpen") : t("documentView")}
                    </span>
                  </button>
                  {activePrivacySection === section.id && (
                    <div className="border-t border-white/10 px-5 pb-5 pt-4 text-slate-300">{section.content}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-slate-950/80 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:px-4 sm:py-6">
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-slate-900 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-[30px]">
            <div className="relative shrink-0 border-b border-white/10 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(34,197,94,0.08),rgba(15,23,42,0.94))] p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 pr-14 sm:pr-16">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">{t("termsBadge")}</p>
                  <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">{t("termsTitle")}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{t('terms_para1')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-950/40 text-xl font-semibold text-white transition hover:bg-white/10 sm:right-6 sm:top-6"
                  aria-label={t("close")}
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pr-2 text-sm leading-7 text-slate-300 sm:p-6 sm:pr-4">
              {[
                {
                  id: 1,
                  title: t('terms_section1_title'),
                  content: <p>{t('terms_section1_text')}</p>,
                },
                {
                  id: 2,
                  title: t('terms_section2_title'),
                  content: <p>{t('terms_section2_text')}</p>,
                },
                {
                  id: 3,
                  title: t('terms_section3_title'),
                  content: <p>{t('terms_section3_text')}</p>,
                },
                {
                  id: 4,
                  title: t('terms_section4_title'),
                  content: <p>{t('terms_section4_text')}</p>,
                },
                {
                  id: 5,
                  title: t('terms_section5_title'),
                  content: <p>{t('terms_section5_text')}</p>,
                },
              ].map((section) => (
                <div key={section.id} className="rounded-3xl border border-white/10 bg-white/5">
                  <button
                    type="button"
                    onClick={() => setActiveTermsSection((prev) => (prev === section.id ? 0 : section.id))}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t("documentSectionLabel", { num: section.id, defaultValue: `Section ${section.id}` })}</p>
                      <h4 className="mt-1 text-lg font-semibold text-white">{section.title}</h4>
                    </div>
                    <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs font-semibold text-slate-300">
                      {activeTermsSection === section.id ? t("documentOpen") : t("documentView")}
                    </span>
                  </button>
                  {activeTermsSection === section.id && (
                    <div className="border-t border-white/10 px-5 pb-5 pt-4 text-slate-300">{section.content}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showServicesDisclaimerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-[30px] border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(34,197,94,0.12),rgba(251,191,36,0.08),rgba(15,23,42,0.94))] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">{t("servicesDisclaimerBadge", "Service Notice")}</p>
                  <h3 className="mt-2 text-2xl font-bold text-white">{t("servicesDisclaimerTitle")}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{t('servicesDisclaimerIntro')}</p>
                </div>
                <button type="button" onClick={() => setShowServicesDisclaimerModal(false)} className="rounded-full border border-white/10 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
                  {t("close")}
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-6 pr-4 text-sm leading-7 text-slate-300">
              {[
                {
                  id: 1,
                  title: t('servicesDisclaimerSection1_title'),
                  content: <p>{t('servicesDisclaimerSection1_text')}</p>,
                },
                {
                  id: 2,
                  title: t('servicesDisclaimerSection2_title'),
                  content: <p>{t('servicesDisclaimerSection2_text')}</p>,
                },
                {
                  id: 3,
                  title: t('servicesDisclaimerSection3_title'),
                  content: <p>{t('servicesDisclaimerSection3_text')}</p>,
                },
                {
                  id: 4,
                  title: t('servicesDisclaimerSection4_title'),
                  content: <p>{t('servicesDisclaimerSection4_text')}</p>,
                },
              ].map((section) => (
                <div key={section.id} className="rounded-3xl border border-white/10 bg-white/5">
                  <button
                    type="button"
                    onClick={() => setActiveServicesDisclaimerSection((prev) => (prev === section.id ? 0 : section.id))}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t("documentSectionLabel", { num: section.id, defaultValue: `Section ${section.id}` })}</p>
                      <h4 className="mt-1 text-lg font-semibold text-white">{section.title}</h4>
                    </div>
                    <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs font-semibold text-slate-300">
                      {activeServicesDisclaimerSection === section.id ? t("documentOpen") : t("documentView")}
                    </span>
                  </button>
                  {activeServicesDisclaimerSection === section.id && (
                    <div className="border-t border-white/10 px-5 pb-5 pt-4 text-slate-300">{section.content}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSecureLoader && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 px-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-[34px] border border-cyan-300/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.96),rgba(17,24,39,0.94),rgba(10,15,30,0.98))] shadow-[0_35px_120px_rgba(2,6,23,0.65)]">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.14),transparent_26%)] p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <img src="/femata-logo.jpeg" alt={t('logoAlt')} className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10" />
                  <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-slate-900 bg-emerald-400 shadow-[0_0_20px_rgba(74,222,128,0.6)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                    {t("secureHandoffBadge")}
                  </span>
                  <h3 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
                    {t("secureHandoffTitle")}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                    {t("secureHandoffDesc")}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-7">
              <div className="mb-5 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#22c55e_0%,#67e8f9_48%,#fbbf24_100%)] transition-all duration-300"
                  style={{ width: `${secureProgress}%` }}
                />
              </div>

              <div className="mb-6 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                <span>{t("secureHandoffProgress")}</span>
                <span>{secureProgress}%</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {secureStages.map((stage, index) => {
                  const isComplete = secureTextIndex > index || secureProgress >= 100;
                  const isActive = secureTextIndex === index && secureProgress < 100;
                  return (
                    <div
                      key={stage}
                      className={`rounded-2xl border px-4 py-4 transition ${
                        isActive
                          ? "border-cyan-300/30 bg-cyan-400/10"
                          : isComplete
                            ? "border-emerald-300/20 bg-emerald-400/10"
                            : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            isActive ? "animate-pulse bg-cyan-300" : isComplete ? "bg-emerald-300" : "bg-slate-500"
                          }`}
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {t("secureHandoffCurrentStep")} {index + 1}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-white">{stage}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{secureStages[secureTextIndex] ?? secureStages[0]}</p>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLanguageToast && (
        <div className="fixed right-4 top-4 z-[70] rounded-2xl border border-cyan-300/20 bg-slate-900/95 px-4 py-3 text-sm text-cyan-100 shadow-2xl backdrop-blur-xl">
          {t("languageChanged")} {(enabledLanguages.find((item) => item.code === currentLanguage) ?? supportedLanguages.find((item) => item.code === currentLanguage))?.label}
        </div>
      )}

      <div
        id="femata-chat-widget"
        className={`fixed bottom-5 right-5 z-40 transition-all duration-300 ${showTalkToAgent ? "open" : ""}`}
      >
        <button
          type="button"
          onClick={() => setShowTalkToAgent((prev) => !prev)}
          className={`inline-flex items-center gap-3 rounded-full border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-xl transition ${
            showTalkToAgent
              ? "border-cyan-300/30 bg-cyan-400/15 text-cyan-100"
              : "border-emerald-300/20 bg-slate-900/90 text-white hover:bg-slate-900"
          }`}
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-400 text-white">
            AI
          </span>
          <span>{showTalkToAgent ? t("chatWidgetClose", "Close Chat") : t("chatWidgetButton", "Talk to FEMATA Agent")}</span>
        </button>
      </div>

      <TalkToAgentModal
        isOpen={showTalkToAgent}
        onClose={() => setShowTalkToAgent(false)}
        currentState={landingChatState}
        city={landingChatCity}
      />
    </div>
  );
};

export default LandingPage;

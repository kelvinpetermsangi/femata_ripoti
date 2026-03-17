import { useSyncExternalStore } from "react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { API_BASE } from "./lib/apiBase";
import en from "./locales/shared/en/common.json";
import sw from "./locales/shared/sw/common.json";

/**
 * Structured list of supported languages for UI pickers and metadata.
 */
export const supportedLanguages = [
  { code: "sw", label: "Kiswahili", displayName: "Kiswahili (sw)", searchText: "swahili" },
  { code: "en", label: "English", displayName: "English (en)", searchText: "english" },
  { code: "fr", label: "Français", displayName: "Français (fr)", searchText: "francais" },
  { code: "zh", label: "中文", displayName: "中文 (zh)", searchText: "chinese" },
  { code: "hi", label: "हिन्दी", displayName: "हिन्दी (hi)", searchText: "hindi" },
  { code: "bn", label: "বাংলা", displayName: "বাংলা (bn)", searchText: "bengali" },
  { code: "ar", label: "العربية", displayName: "العربية (ar)", searchText: "arabic" },
  { code: "de", label: "Deutsch", displayName: "Deutsch (de)", searchText: "german" },
  { code: "am", label: "አማርኛ", displayName: "አማርኛ (am)", searchText: "amharic" },
  { code: "ko", label: "한국어", displayName: "한국어 (ko)", searchText: "korean" },
  { code: "th", label: "ไทย", displayName: "ไทย (th)", searchText: "thai" },
] as const;

export type SupportedLanguageCode = (typeof supportedLanguages)[number]["code"];
export type SupportedLanguage = (typeof supportedLanguages)[number];

export type AdminSupportedLanguageCode = SupportedLanguageCode;
const ADMIN_SUPPORTED_LANGUAGE_SET = new Set<string>(supportedLanguages.map((language) => language.code));
export const adminSupportedLanguages = supportedLanguages;

type LocaleModule = { default?: Record<string, unknown> };

const DEFAULT_SUPPORTED_LANGS = supportedLanguages.map((language) => language.code) as SupportedLanguageCode[];
const DEFAULT_FALLBACK_ENABLED: SupportedLanguageCode[] = ["sw", "en"];
const FALLBACK_LANGUAGE_CODES: SupportedLanguageCode[] = ["sw", "en"];
const SUPPORTED_LANGUAGE_SET = new Set<string>(DEFAULT_SUPPORTED_LANGS);

/**
 * Pre-bundled translation resources (keep the most-used ones here)
 */
const resources = {
  en: { translation: en },
  sw: { translation: sw },
};

const flatLocaleModules = import.meta.glob("./locales/*.json") as Record<string, () => Promise<LocaleModule>>;
const sharedLocaleModules = import.meta.glob("./locales/shared/*/*.json") as Record<string, () => Promise<LocaleModule>>;

// Runtime enabled locales - will be fetched from backend
let ENABLED_LOCALES: string[] = [...DEFAULT_SUPPORTED_LANGS];
let LOCALES_LOADED = false;
let fallbackBundlesReadyPromise: Promise<void> | null = null;

const localeListeners = new Set<() => void>();

const STORAGE_KEY = "femataLng";

/** Normalize a locale to primary subtag, e.g. "en-US" -> "en" */
const normalizeLang = (lng: string | undefined | null) =>
  typeof lng === "string" && lng.length > 0 ? lng.split("-")[0] : "";

export const resolveAdminLanguage = (...candidates: Array<string | undefined | null>): AdminSupportedLanguageCode => {
  for (const candidate of candidates) {
    const normalized = normalizeLang(candidate);
    if (normalized && ADMIN_SUPPORTED_LANGUAGE_SET.has(normalized)) {
      return normalized as AdminSupportedLanguageCode;
    }
  }
  return "sw";
};

const isSameLocaleList = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const normalizeEnabledLocales = (locales: unknown): string[] => {
  if (!Array.isArray(locales)) return [...DEFAULT_FALLBACK_ENABLED];

  const next = Array.from(
    new Set(
      locales
        .map((value) => (typeof value === "string" ? normalizeLang(value) : ""))
        .filter((value) => SUPPORTED_LANGUAGE_SET.has(value)),
    ),
  );

  return next.length > 0 ? next : [...DEFAULT_FALLBACK_ENABLED];
};

const setEnabledLocales = (locales: unknown): string[] => {
  const next = normalizeEnabledLocales(locales);
  const changed = !isSameLocaleList(ENABLED_LOCALES, next);
  ENABLED_LOCALES = next;
  LOCALES_LOADED = true;
  if (changed) {
    localeListeners.forEach((listener) => listener());
  }
  return [...next];
};

const subscribeEnabledLocales = (listener: () => void) => {
  localeListeners.add(listener);
  return () => {
    localeListeners.delete(listener);
  };
};

/**
 * Fetch enabled locales from backend
 */
export async function fetchEnabledLocales(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE}/meta/locales/enabled`, { cache: "no-store" });
    if (!response.ok) {
      console.warn("Failed to fetch enabled locales, using defaults");
      return setEnabledLocales(DEFAULT_SUPPORTED_LANGS);
    }
    const data = (await response.json()) as { enabled?: unknown };
    return setEnabledLocales(data.enabled);
  } catch (error) {
    console.warn("Error fetching enabled locales:", error);
    return setEnabledLocales(DEFAULT_SUPPORTED_LANGS);
  }
}

/**
 * Get currently enabled locales (cached)
 */
export function getEnabledLocales(): string[] {
  return ENABLED_LOCALES;
}

export function useEnabledLocales(): string[] {
  return useSyncExternalStore(subscribeEnabledLocales, getEnabledLocales, getEnabledLocales);
}

/**
 * Check if locales have been loaded from backend
 */
export function areLocalesLoaded(): boolean {
  return LOCALES_LOADED;
}

/**
 * Get the subset of supportedLanguages that are currently enabled
 */
export function getEnabledSupportedLanguages() {
  const enabled = new Set(getEnabledLocales());
  return supportedLanguages.filter((lang) => enabled.has(lang.code));
}

export function useEnabledSupportedLanguages() {
  const enabled = new Set(useEnabledLocales());
  return supportedLanguages.filter((lang) => enabled.has(lang.code));
}

/** Safe cross-browser browser-language detection */
const getBrowserLanguage = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const nav = window.navigator as Navigator & { languages?: readonly string[] };
    if (Array.isArray(nav.languages) && nav.languages.length > 0) {
      return normalizeLang(nav.languages[0]) || null;
    }
    if (typeof nav.language === "string") return normalizeLang(nav.language) || null;
  } catch {
    // ignore
  }
  return null;
};

/** Read stored language if valid & supported */
const getStoredLanguage = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && getEnabledLocales().includes(stored)) return stored;
  } catch {
    // ignore
  }
  return null;
};

/** Decide initial language preference (stored -> browser -> fallback) */
const decideInitialLanguage = (): string => {
  const stored = getStoredLanguage();
  if (stored) return stored;

  const browser = getBrowserLanguage();
  if (browser && getEnabledLocales().includes(browser)) return browser;

  return "sw";
};

const loadModule = async (loader?: () => Promise<LocaleModule>) => {
  if (!loader) return null;
  try {
    const mod = await loader();
    const bundle = (mod?.default ?? mod) as Record<string, unknown> | undefined;
    return bundle && typeof bundle === "object" ? bundle : null;
  } catch {
    return null;
  }
};

const loadLocaleBundleInternal = async (code: string): Promise<boolean> => {
  if (!code) return false;
  const c = normalizeLang(code);
  if (!c || !SUPPORTED_LANGUAGE_SET.has(c)) return false;
  const hasExistingBundle = i18n.hasResourceBundle(c, "translation");

  // Merge any legacy flat locale file with the shared namespace bundles.
  // Some languages ship `./locales/<code>.json` for common strings while
  // admin/report/training live under `./locales/shared/<code>/`.
  const flatBundle = await loadModule(flatLocaleModules[`./locales/${c}.json`]);
  const namespaces = ["common", "admin", "report", "training"];
  const imports = await Promise.all(namespaces.map((ns) => loadModule(sharedLocaleModules[`./locales/shared/${c}/${ns}.json`])));
  const bundle = Object.assign({}, ...(flatBundle ? [flatBundle] : []), ...imports.filter(Boolean) as Record<string, unknown>[]);
  const hasBundleContent = Object.keys(bundle).length > 0;

  if (hasBundleContent) {
    i18n.addResourceBundle(c, "translation", bundle, true, true);
    return true;
  }
  return hasExistingBundle;
};

const ensureFallbackBundlesLoaded = async (): Promise<void> => {
  if (!fallbackBundlesReadyPromise) {
    fallbackBundlesReadyPromise = Promise.all(FALLBACK_LANGUAGE_CODES.map((code) => loadLocaleBundleInternal(code)))
      .then(() => undefined)
      .catch((error) => {
        fallbackBundlesReadyPromise = null;
        throw error;
      });
  }
  await fallbackBundlesReadyPromise;
};

/**
 * Dynamically load a locale JSON and register it with i18next.
 * Returns true if the resource bundle is now available.
 */
export async function loadLocaleBundle(code: string): Promise<boolean> {
  if (!code) return false;
  const c = normalizeLang(code);
  if (!c || !SUPPORTED_LANGUAGE_SET.has(c)) return false;

  await ensureFallbackBundlesLoaded();

  const loaded = await loadLocaleBundleInternal(c);
  if (loaded) return true;

  // Keep supported languages selectable even when they do not yet ship
  // admin/report/training packs; i18next will fall back to the bundled defaults.
  i18n.addResourceBundle(c, "translation", {}, true, true);
  return true;
}

export async function changeAppLanguage(code: string): Promise<boolean> {
  const c = normalizeLang(code);
  if (!c || !SUPPORTED_LANGUAGE_SET.has(c)) return false;

  const loaded = await loadLocaleBundle(c);
  if (!loaded) return false;

  await i18n.changeLanguage(c);
  return true;
}

/**
 * Initialize i18next with the pre-bundled resources.
 * We'll attempt to load and switch to the decided initial language if it isn't already available.
 */
i18n.use(initReactI18next).init({
  resources,
  // Use a conservative initial language for init; we'll change it shortly if needed.
  lng: "sw",
  fallbackLng: FALLBACK_LANGUAGE_CODES,
  supportedLngs: DEFAULT_SUPPORTED_LANGS,
  nonExplicitSupportedLngs: true,
  interpolation: { escapeValue: false },
});

/** Persist language selection to localStorage when changed (only for supported languages). */
i18n.on("languageChanged", (lng) => {
  try {
    const code = normalizeLang(lng);
    if (typeof window !== "undefined" && SUPPORTED_LANGUAGE_SET.has(code)) {
      localStorage.setItem(STORAGE_KEY, code);
    }
  } catch {
    // ignore
  }
});

/**
 * After init: ensure the user's preferred language is loaded and applied.
 * We do this asynchronously so the app bootstraps quickly and extra locales are lazy-loaded.
 */
const initial = decideInitialLanguage();
void ensureFallbackBundlesLoaded().catch(() => {
  /* ignore */
});
if (initial) {
  void changeAppLanguage(initial).catch(() => {
    /* ignore */
  });
}

// Fetch enabled locales in the background, then re-apply the best available language.
void fetchEnabledLocales()
  .then(() => changeAppLanguage(decideInitialLanguage()))
  .catch(() => {
    /* ignore */
  });

export default i18n;

export type ClientContext = {
  captured_at: string;
  browser: {
    language: string | null;
    languages: string[];
    timezone: string | null;
    user_agent: string | null;
    platform: string | null;
    cookie_enabled: boolean | null;
    online: boolean | null;
    hardware_concurrency: number | null;
    device_memory_gb: number | null;
    max_touch_points: number | null;
    viewport: {
      width: number | null;
      height: number | null;
    };
    screen: {
      width: number | null;
      height: number | null;
      pixel_ratio: number | null;
      color_depth: number | null;
    };
  };
  device: {
    type: "mobile" | "tablet" | "desktop" | "unknown";
    touch_capable: boolean;
    standalone: boolean | null;
  };
  network: {
    effective_type: string | null;
    downlink_mbps: number | null;
    rtt_ms: number | null;
    save_data: boolean | null;
  };
  capabilities: {
    file_upload: boolean;
    clipboard: boolean;
    share: boolean;
    service_worker: boolean;
    camera: boolean;
    microphone: boolean;
    notifications: boolean;
  };
  preferences: {
    prefers_dark_mode: boolean | null;
    prefers_reduced_motion: boolean | null;
  };
};

type NavigatorWithExtras = Navigator & {
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
  deviceMemory?: number;
  standalone?: boolean;
};

const mediaMatches = (query: string) => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(query).matches;
};

const detectDeviceType = (width: number | null, touchCapable: boolean): ClientContext["device"]["type"] => {
  if (!width) return touchCapable ? "mobile" : "unknown";
  if (width < 768) return "mobile";
  if (width < 1100) return touchCapable ? "tablet" : "desktop";
  return "desktop";
};

const numberOrNull = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

export const collectClientContext = (): ClientContext => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      captured_at: new Date().toISOString(),
      browser: {
        language: null,
        languages: [],
        timezone: null,
        user_agent: null,
        platform: null,
        cookie_enabled: null,
        online: null,
        hardware_concurrency: null,
        device_memory_gb: null,
        max_touch_points: null,
        viewport: { width: null, height: null },
        screen: { width: null, height: null, pixel_ratio: null, color_depth: null },
      },
      device: { type: "unknown", touch_capable: false, standalone: null },
      network: { effective_type: null, downlink_mbps: null, rtt_ms: null, save_data: null },
      capabilities: {
        file_upload: false,
        clipboard: false,
        share: false,
        service_worker: false,
        camera: false,
        microphone: false,
        notifications: false,
      },
      preferences: {
        prefers_dark_mode: null,
        prefers_reduced_motion: null,
      },
    };
  }

  const nav = navigator as NavigatorWithExtras;
  const viewportWidth = numberOrNull(window.innerWidth);
  const viewportHeight = numberOrNull(window.innerHeight);
  const touchCapable = typeof nav.maxTouchPoints === "number" ? nav.maxTouchPoints > 0 : "ontouchstart" in window;

  return {
    captured_at: new Date().toISOString(),
    browser: {
      language: nav.language || null,
      languages: Array.isArray(nav.languages) ? nav.languages.slice(0, 6) : [],
      timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || null : null,
      user_agent: nav.userAgent || null,
      platform: nav.platform || null,
      cookie_enabled: typeof nav.cookieEnabled === "boolean" ? nav.cookieEnabled : null,
      online: typeof nav.onLine === "boolean" ? nav.onLine : null,
      hardware_concurrency: numberOrNull(nav.hardwareConcurrency),
      device_memory_gb: numberOrNull(nav.deviceMemory),
      max_touch_points: numberOrNull(nav.maxTouchPoints),
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
      },
      screen: {
        width: numberOrNull(window.screen?.width),
        height: numberOrNull(window.screen?.height),
        pixel_ratio: numberOrNull(window.devicePixelRatio),
        color_depth: numberOrNull(window.screen?.colorDepth),
      },
    },
    device: {
      type: detectDeviceType(viewportWidth, touchCapable),
      touch_capable: touchCapable,
      standalone: typeof nav.standalone === "boolean" ? nav.standalone : null,
    },
    network: {
      effective_type: nav.connection?.effectiveType || null,
      downlink_mbps: numberOrNull(nav.connection?.downlink),
      rtt_ms: numberOrNull(nav.connection?.rtt),
      save_data: typeof nav.connection?.saveData === "boolean" ? nav.connection.saveData : null,
    },
    capabilities: {
      file_upload: typeof FileReader !== "undefined",
      clipboard: typeof nav.clipboard !== "undefined",
      share: typeof nav.share === "function",
      service_worker: "serviceWorker" in nav,
      camera: typeof nav.mediaDevices?.getUserMedia === "function",
      microphone: typeof nav.mediaDevices?.getUserMedia === "function",
      notifications: typeof window.Notification !== "undefined",
    },
    preferences: {
      prefers_dark_mode: mediaMatches("(prefers-color-scheme: dark)"),
      prefers_reduced_motion: mediaMatches("(prefers-reduced-motion: reduce)"),
    },
  };
};

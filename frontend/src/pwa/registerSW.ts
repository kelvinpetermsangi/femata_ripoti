type ServiceWorkerRegistrationWithSync = ServiceWorkerRegistration & {
  sync?: {
    register: (tag: string) => Promise<void>;
  };
};

const SW_SYNC_MESSAGE = "femata:pwa-sync";

export const registerServiceWorker = async () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !import.meta.env.PROD) {
    return;
  }

  try {
    const registration = (await navigator.serviceWorker.register("/sw.js", { scope: "/" })) as ServiceWorkerRegistrationWithSync;

    navigator.serviceWorker.addEventListener("message", (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "FEMATA_TRIGGER_SYNC") {
        window.dispatchEvent(new CustomEvent(SW_SYNC_MESSAGE));
      }
    });

    if (registration.sync) {
      await registration.sync.register("femata-report-queue").catch(() => undefined);
    }
  } catch {
    // PWA registration is optional; keep the app usable if it fails.
  }
};

export const PWA_SYNC_EVENT = SW_SYNC_MESSAGE;

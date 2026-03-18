import { API_BASE } from "../lib/apiBase";
import {
  createLocalInternalTrackingNumber,
  listSyncableReports,
  putQueuedReport,
  saveQueuedReport,
  type QueuedReportRecord,
} from "../db/queueStore";
import { PWA_SYNC_EVENT } from "../pwa/registerSW";

let syncInFlight: Promise<void> | null = null;
let syncListenersBound = false;

const isOfflineLikeError = (error: unknown) =>
  !navigator.onLine || error instanceof TypeError || (error instanceof Error && /network|fetch/i.test(error.message));

const postJson = async (url: string, body: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const syncSingleReport = async (record: QueuedReportRecord) => {
  let remoteDraftId = record.remoteDraftId;
  let publicReferenceNumber = record.publicReferenceNumber || record.localReference;
  let internalTrackingNumber = record.internalTrackingNumber;

  if (!remoteDraftId) {
    const initResponse = await postJson(`${API_BASE}/reports/init`, {
      region: record.routeState.region,
      municipality: record.routeState.municipality,
      client_context: record.clientContext,
    });

    if (!initResponse.ok) {
      const detail = await initResponse.json().catch(() => ({} as { detail?: string }));
      throw new Error(detail.detail || `Draft init failed (${initResponse.status}).`);
    }

    const initData = (await initResponse.json()) as {
      draft_id?: string;
      public_reference_number?: string;
      internal_tracking_number?: string;
    };

    remoteDraftId = initData.draft_id ?? null;
    publicReferenceNumber = initData.public_reference_number ?? publicReferenceNumber;
    internalTrackingNumber = initData.internal_tracking_number ?? internalTrackingNumber;
  }

  if (!remoteDraftId) {
    throw new Error("Missing remote draft identifier.");
  }

  const submitResponse = await postJson(`${API_BASE}/reports/${remoteDraftId}/submit`, record.draft);

  if (!submitResponse.ok) {
    const detail = await submitResponse.json().catch(() => ({} as { detail?: string }));
    throw new Error(detail.detail || `Report submit failed (${submitResponse.status}).`);
  }

  await putQueuedReport({
    ...record,
    status: "sent",
    remoteDraftId,
    publicReferenceNumber,
    internalTrackingNumber: internalTrackingNumber ?? createLocalInternalTrackingNumber(),
    lastError: null,
  });
};

export const syncQueuedReports = async () => {
  if (typeof window === "undefined" || !navigator.onLine) return;
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const records = await listSyncableReports();

    for (const record of records) {
      await saveQueuedReport(record.id, (current) => ({
        ...(current ?? record),
        status: "syncing",
        lastError: null,
      }));

      try {
        await syncSingleReport(record);
      } catch (error) {
        const nextStatus = isOfflineLikeError(error) ? "queued" : "failed";
        await saveQueuedReport(record.id, (current) => ({
          ...(current ?? record),
          status: nextStatus,
          lastError: error instanceof Error ? error.message : "Sync failed.",
        }));

        if (nextStatus === "queued") break;
      }
    }
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
};

export const requestQueuedReportSync = async () => {
  if (typeof window === "undefined") return;

  if ("serviceWorker" in navigator) {
    const registration = (await navigator.serviceWorker.ready.catch(() => null)) as
      | (ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } })
      | null;

    if (registration?.sync) {
      await registration.sync.register("femata-report-queue").catch(() => undefined);
    }
  }

  if (navigator.onLine) {
    await syncQueuedReports();
  }
};

export const setupQueuedReportSync = () => {
  if (typeof window === "undefined" || syncListenersBound) return;
  syncListenersBound = true;

  const triggerSync = () => {
    void syncQueuedReports();
  };

  window.addEventListener("online", triggerSync);
  window.addEventListener("focus", triggerSync);
  window.addEventListener(PWA_SYNC_EVENT, triggerSync as EventListener);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") triggerSync();
  });

  void syncQueuedReports();
};

import type { ClientContext } from "../lib/clientContext";
import { requestToPromise, withStore } from "./indexedDb";

export type ReportQueueStatus = "draft" | "queued" | "syncing" | "sent" | "failed";

export type QueuedReportRouteState = {
  region: string | null;
  municipality: string | null;
};

export type QueuedReportRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ReportQueueStatus;
  draft: Record<string, unknown>;
  routeState: QueuedReportRouteState;
  clientContext: ClientContext;
  remoteDraftId: string | null;
  localReference: string;
  publicReferenceNumber: string | null;
  internalTrackingNumber: string | null;
  lastError: string | null;
};

export const REPORT_QUEUE_EVENT = "femata:report-queue-update";

const nowIso = () => new Date().toISOString();

const emitUpdate = (record: QueuedReportRecord) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<QueuedReportRecord>(REPORT_QUEUE_EVENT, { detail: record }));
};

export const createLocalQueueId = () =>
  `local-draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const createLocalReferenceNumber = () =>
  `OFFLINE-${Date.now().toString(36).slice(-6).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export const createLocalInternalTrackingNumber = () =>
  `LOCAL-${Date.now().toString(36).slice(-8).toUpperCase()}`;

export const getQueuedReport = async (id: string) =>
  withStore("readonly", async (store) => (await requestToPromise(store.get(id))) as QueuedReportRecord | undefined);

export const putQueuedReport = async (record: QueuedReportRecord) => {
  const nextRecord = {
    ...record,
    createdAt: record.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  await withStore("readwrite", async (store) => {
    await requestToPromise(store.put(nextRecord));
    return undefined;
  });

  emitUpdate(nextRecord);
  return nextRecord;
};

export const saveQueuedReport = async (
  id: string,
  updater: (current: QueuedReportRecord | undefined) => QueuedReportRecord,
) => {
  const current = await getQueuedReport(id);
  return putQueuedReport(updater(current));
};

export const listQueuedReports = async () =>
  withStore("readonly", async (store) => (await requestToPromise(store.getAll())) as QueuedReportRecord[]);

export const listSyncableReports = async () => {
  const records = await listQueuedReports();
  return records
    .filter((record) => record.status === "queued" || record.status === "failed" || record.status === "syncing")
    .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
};

export const deleteQueuedReport = async (id: string) => {
  await withStore("readwrite", async (store) => {
    await requestToPromise(store.delete(id));
    return undefined;
  });
};

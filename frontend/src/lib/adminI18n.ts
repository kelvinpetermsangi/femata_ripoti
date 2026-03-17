import type { TFunction } from "i18next";
import type { AdminRole } from "./adminAuth";

export const ADMIN_CASE_STATUSES = [
  "Imepokelewa",
  "Inapitiwa",
  "Imepelekwa kwa kitengo husika",
  "Majibu yapo",
  "Imefungwa",
] as const;

export const ADMIN_DESKS = [
  "National Intake Desk",
  "Intake Desk",
  "FEMATA Safety Desk",
  "Licensing Desk",
  "Community Relations Desk",
  "Legal and Policy Desk",
  "Case Review Team",
] as const;

const roleTranslationKey: Record<AdminRole, string> = {
  super_admin: "adminRoleSuperAdmin",
  case_manager: "adminRoleCaseManager",
  reviewer: "adminRoleReviewer",
  analyst: "adminRoleAnalyst",
};

const deskTranslationKey: Record<string, string> = {
  "National Intake Desk": "adminDeskNationalIntake",
  "Intake Desk": "adminDeskIntake",
  "FEMATA Safety Desk": "adminDeskSafety",
  "Licensing Desk": "adminDeskLicensing",
  "Community Relations Desk": "adminDeskCommunityRelations",
  "Legal and Policy Desk": "adminDeskLegalPolicy",
  "Case Review Team": "adminDeskCaseReview",
};

const statusTranslationKey: Record<string, string> = {
  Imepokelewa: "adminCaseStatusReceived",
  Inapitiwa: "adminCaseStatusReview",
  "Imepelekwa kwa kitengo husika": "adminCaseStatusRouted",
  "Majibu yapo": "adminCaseStatusResponseReady",
  Imefungwa: "adminCaseStatusClosed",
};

export const translateAdminRole = (t: TFunction, role: AdminRole | string) => {
  const key = roleTranslationKey[role as AdminRole];
  return key ? t(key) : role;
};

export const translateAdminDesk = (t: TFunction, desk: string) => {
  const key = deskTranslationKey[desk];
  return key ? t(key) : desk;
};

export const translateAdminStatus = (t: TFunction, status: string) => {
  const key = statusTranslationKey[status];
  return key ? t(key) : status;
};

export const translateBooleanValue = (t: TFunction, value: boolean) => (value ? t("adminCommonYes") : t("adminCommonNo"));

export const formatAdminTimestamp = (value: string | null | undefined, language: string, t: TFunction) => {
  if (!value) return t("adminCommonNotRecorded");
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(language || undefined);
};

export const formatAdminRelativeTime = (value: string | null | undefined, t: TFunction) => {
  if (!value) return t("adminCommonNotRecorded");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const deltaMinutes = Math.round((Date.now() - parsed.getTime()) / (1000 * 60));
  if (deltaMinutes < 60) return t("adminCommonMinutesAgo", { count: Math.max(deltaMinutes, 1) });

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) return t("adminCommonHoursAgo", { count: deltaHours });

  const deltaDays = Math.round(deltaHours / 24);
  return t("adminCommonDaysAgo", { count: deltaDays });
};

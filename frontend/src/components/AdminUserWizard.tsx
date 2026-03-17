import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { normalizeLocation, regionMunicipalityMap, regions } from "../data/tanzaniaLocations";
import type { AdminRole } from "../lib/adminAuth";
import { translateAdminDesk, translateAdminRole } from "../lib/adminI18n";
import { readFileAsDataUrl } from "../lib/fileDataUrl";
import AnimatedSelect from "./AnimatedSelect";

export type CoverageAssignmentDraft = {
  desk: string;
  region: string;
  municipality: string;
  zone: string;
};

export type AdminUserWizardValue = {
  username: string;
  password: string;
  display_name: string;
  full_name: string;
  email: string;
  mobile_number: string;
  roles: AdminRole[];
  coverage_assignments: CoverageAssignmentDraft[];
  profile_image_data_url: string | null;
  profile_image_filename: string | null;
  profile_image_preview_url: string | null;
  is_active: boolean;
  role_title: string;
  reporting_line: string;
  signature_image_data_url: string | null;
  signature_image_filename: string | null;
  signature_image_preview_url: string | null;
  organization_name: string;
  organization_address: string;
  organization_email: string;
  organization_phone: string;
  organization_logo_data_url: string | null;
  organization_logo_filename: string | null;
  organization_logo_preview_url: string | null;
};

const deskValues = [
  "National Intake Desk",
  "Intake Desk",
  "FEMATA Safety Desk",
  "Licensing Desk",
  "Community Relations Desk",
  "Legal and Policy Desk",
  "Case Review Team",
] as const;

export const createEmptyAdminUserWizardValue = (): AdminUserWizardValue => ({
  username: "",
  password: "",
  display_name: "",
  full_name: "",
  email: "",
  mobile_number: "",
  roles: ["reviewer"],
  coverage_assignments: [],
  profile_image_data_url: null,
  profile_image_filename: null,
  profile_image_preview_url: null,
  is_active: true,
  role_title: "",
  reporting_line: "",
  signature_image_data_url: null,
  signature_image_filename: null,
  signature_image_preview_url: null,
  organization_name: "FEMATA",
  organization_address: "",
  organization_email: "",
  organization_phone: "",
  organization_logo_data_url: null,
  organization_logo_filename: null,
  organization_logo_preview_url: null,
});

const toggleRole = (roles: AdminRole[], role: AdminRole) => (roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role]);

const RoleCard = ({
  active,
  label,
  note,
  onClick,
}: {
  active: boolean;
  label: string;
  note: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-3xl border p-4 text-left transition ${active ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-100" : "border-white/10 bg-slate-950/35 text-slate-200 hover:bg-white/10"}`}
  >
    <p className="text-sm font-semibold">{label}</p>
    <p className="mt-2 text-xs leading-6 text-slate-400">{note}</p>
  </button>
);

type AdminUserWizardProps = {
  mode: "create" | "edit";
  initialValue: AdminUserWizardValue;
  zoneLookup: Record<string, string>;
  submitting: boolean;
  onSubmit: (value: AdminUserWizardValue) => Promise<void> | void;
};

const AdminUserWizard = ({ mode, initialValue, zoneLookup, submitting, onSubmit }: AdminUserWizardProps) => {
  const { t } = useTranslation();
  const [value, setValue] = useState<AdminUserWizardValue>(initialValue);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [assignmentDesk, setAssignmentDesk] = useState<string>(deskValues[0]);
  const [assignmentRegionQuery, setAssignmentRegionQuery] = useState("");
  const [assignmentRegion, setAssignmentRegion] = useState("");
  const [assignmentMunicipalityQuery, setAssignmentMunicipalityQuery] = useState("");
  const [assignmentMunicipality, setAssignmentMunicipality] = useState("");

  const stepLabels = [
    t("adminWizardStepIdentity"),
    t("adminWizardStepAssignment"),
    t("adminWizardStepSystemAccess"),
    t("adminWizardStepAnalyst"),
    t("adminWizardStepInstitution"),
    t("adminWizardStepReview"),
  ];

  const roleOptions: Array<{ value: AdminRole; label: string; note: string }> = [
    { value: "super_admin", label: translateAdminRole(t, "super_admin"), note: t("adminWizardRoleSuperAdminNote") },
    { value: "case_manager", label: translateAdminRole(t, "case_manager"), note: t("adminWizardRoleCaseManagerNote") },
    { value: "reviewer", label: translateAdminRole(t, "reviewer"), note: t("adminWizardRoleReviewerNote") },
    { value: "analyst", label: translateAdminRole(t, "analyst"), note: t("adminWizardRoleAnalystNote") },
  ];

  const deskOptions = useMemo(
    () => deskValues.map((desk) => ({ value: desk, label: translateAdminDesk(t, desk) })),
    [t],
  );

  useEffect(() => {
    setValue(initialValue);
    setStep(1);
    setError("");
    setAssignmentDesk(deskValues[0]);
    setAssignmentRegionQuery("");
    setAssignmentRegion("");
    setAssignmentMunicipalityQuery("");
    setAssignmentMunicipality("");
  }, [initialValue]);

  const currentZone = assignmentRegion ? zoneLookup[assignmentRegion] || "" : "";
  const selectedMunicipalities = useMemo(() => (assignmentRegion ? regionMunicipalityMap[assignmentRegion] || [] : []), [assignmentRegion]);
  const regionSuggestions = useMemo(
    () =>
      !assignmentRegionQuery.trim()
        ? []
        : regions.filter((region) => normalizeLocation(region).includes(normalizeLocation(assignmentRegionQuery)) && region !== assignmentRegion),
    [assignmentRegion, assignmentRegionQuery],
  );
  const municipalitySuggestions = useMemo(
    () =>
      !assignmentMunicipalityQuery.trim()
        ? []
        : selectedMunicipalities.filter(
            (municipality) =>
              normalizeLocation(municipality).includes(normalizeLocation(assignmentMunicipalityQuery)) && municipality !== assignmentMunicipality,
          ),
    [assignmentMunicipality, assignmentMunicipalityQuery, selectedMunicipalities],
  );

  const isAnalyst = value.roles.includes("analyst");
  const requiresCoverage = !value.roles.includes("super_admin") && !value.roles.includes("analyst");

  const setField = <K extends keyof AdminUserWizardValue>(key: K, nextValue: AdminUserWizardValue[K]) =>
    setValue((current) => ({ ...current, [key]: nextValue }));

  const handleImageUpload = async (
    file: File | null,
    keys: { data: keyof AdminUserWizardValue; name: keyof AdminUserWizardValue; preview: keyof AdminUserWizardValue },
  ) => {
    if (!file) return;
    const asset = await readFileAsDataUrl(file);
    setValue((current) => ({
      ...current,
      [keys.data]: asset.dataUrl,
      [keys.name]: asset.name,
      [keys.preview]: asset.dataUrl,
    }));
  };

  const resetAssignmentBuilder = () => {
    setAssignmentDesk(deskValues[0]);
    setAssignmentRegionQuery("");
    setAssignmentRegion("");
    setAssignmentMunicipalityQuery("");
    setAssignmentMunicipality("");
  };

  const addCoverageAssignment = () => {
    if (!assignmentRegion) {
      setError(t("adminWizardValidationChooseRegion"));
      return;
    }
    const nextItem: CoverageAssignmentDraft = {
      desk: assignmentDesk,
      region: assignmentRegion,
      municipality: assignmentMunicipality,
      zone: currentZone || t("adminWizardZonePending"),
    };
    const exists = value.coverage_assignments.some(
      (item) => item.desk === nextItem.desk && item.region === nextItem.region && item.municipality === nextItem.municipality,
    );
    if (exists) {
      setError(t("adminWizardValidationDuplicateAssignment"));
      return;
    }
    setValue((current) => ({ ...current, coverage_assignments: [...current.coverage_assignments, nextItem] }));
    setError("");
    resetAssignmentBuilder();
  };

  const validateStep = (activeStep: number) => {
    if (activeStep === 1) {
      if (!value.full_name.trim()) return t("adminWizardValidationFullName");
      if (!value.roles.length) return t("adminWizardValidationRole");
      return "";
    }
    if (activeStep === 2) {
      if (requiresCoverage && !value.coverage_assignments.length) return t("adminWizardValidationCoverage");
      return "";
    }
    if (activeStep === 3) {
      if (!value.username.trim()) return t("adminWizardValidationUsername");
      if (mode === "create" && value.password.trim().length < 8) return t("adminWizardValidationPassword");
      return "";
    }
    if (activeStep === 4 && isAnalyst && !value.role_title.trim()) return t("adminWizardValidationAnalystTitle");
    if (activeStep === 5 && !value.organization_name.trim()) return t("adminWizardValidationOrganization");
    return "";
  };

  const goNext = () => {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, stepLabels.length));
  };

  const goBack = () => {
    setError("");
    setStep((current) => Math.max(current - 1, 1));
  };

  const submit = async () => {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    await onSubmit(value);
  };

  return (
    <section className="space-y-6 rounded-[30px] border border-white/10 bg-white/5 p-5 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{mode === "create" ? t("adminWizardRegistrationWizard") : t("adminWizardEditingWizard")}</p>
          <h2 className="mt-3 text-2xl font-bold text-white">{mode === "create" ? t("adminWizardRegistrationTitle") : t("adminWizardEditingTitle")}</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white">
          {t("adminWizardStepCounter", { current: step, total: stepLabels.length })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="h-2.5 rounded-full bg-white/10">
          <div className="h-2.5 rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300 transition-all duration-300" style={{ width: `${(step / stepLabels.length) * 100}%` }} />
        </div>
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {stepLabels.map((label, index) => (
            <div key={label} className={`rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${index + 1 === step ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100" : index + 1 < step ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-slate-950/35 text-slate-400"}`}>
              {label}
            </div>
          ))}
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <div key={step} className="animate-[stageFade_260ms_ease-out] space-y-5">
        {step === 1 ? (
          <div className="grid gap-4 xl:grid-cols-[160px_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/45">
                {value.profile_image_preview_url ? <img src={value.profile_image_preview_url} alt={t("adminProfileAvatar")} className="h-full w-full object-cover" /> : <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("adminProfileAvatar")}</span>}
              </div>
              <label className="inline-flex cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                {t("adminWizardUploadAvatar")}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleImageUpload(event.target.files?.[0] ?? null, { data: "profile_image_data_url", name: "profile_image_filename", preview: "profile_image_preview_url" })} />
              </label>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white">{t("adminWizardFullName")}</span>
                  <input type="text" value={value.full_name} onChange={(event) => setField("full_name", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white">{t("adminWizardDisplayName")}</span>
                  <input type="text" value={value.display_name} onChange={(event) => setField("display_name", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white">{t("adminWizardPersonalEmail")}</span>
                  <input type="email" value={value.email} onChange={(event) => setField("email", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white">{t("adminWizardPersonalMobile")}</span>
                  <input type="text" value={value.mobile_number} onChange={(event) => setField("mobile_number", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none" />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {roleOptions.map((role) => (
                  <RoleCard key={role.value} active={value.roles.includes(role.value)} label={role.label} note={role.note} onClick={() => setField("roles", toggleRole(value.roles, role.value))} />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4 rounded-[28px] border border-white/10 bg-slate-950/35 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white">{t("adminWizardAssignedDesk")}</span>
                  <AnimatedSelect value={assignmentDesk} options={deskOptions} onChange={setAssignmentDesk} placeholder={t("adminWizardChooseDesk")} />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-white">{t("adminWizardReportingLine")}</span>
                  <input type="text" value={value.reporting_line} onChange={(event) => setField("reporting_line", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none" placeholder={t("adminWizardReportingLinePlaceholder")} />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white">{t("adminWizardRegion")}</label>
                  <input type="text" value={assignmentRegionQuery} onChange={(event) => { setAssignmentRegionQuery(event.target.value); if (normalizeLocation(event.target.value) !== normalizeLocation(assignmentRegion)) setAssignmentRegion(""); }} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none" placeholder={t("adminWizardTypeRegion")} />
                  {regionSuggestions.length ? <div className="max-h-56 space-y-2 overflow-auto rounded-2xl border border-white/10 bg-slate-950/70 p-2">{regionSuggestions.map((region) => <button key={region} type="button" onClick={() => { setAssignmentRegion(region); setAssignmentRegionQuery(region); setAssignmentMunicipality(""); setAssignmentMunicipalityQuery(""); }} className="w-full rounded-2xl bg-white/5 px-4 py-3 text-left text-sm text-white hover:bg-white/10">{region}</button>)}</div> : null}
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-white">{t("adminWizardMunicipality")}</label>
                  <input type="text" value={assignmentMunicipalityQuery} disabled={!assignmentRegion} onChange={(event) => { setAssignmentMunicipalityQuery(event.target.value); if (normalizeLocation(event.target.value) !== normalizeLocation(assignmentMunicipality)) setAssignmentMunicipality(""); }} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none disabled:opacity-50" placeholder={assignmentRegion ? t("adminWizardMunicipalityPlaceholder") : t("adminWizardChooseRegionFirst")} />
                  {municipalitySuggestions.length ? <div className="max-h-56 space-y-2 overflow-auto rounded-2xl border border-white/10 bg-slate-950/70 p-2"><button type="button" onClick={() => { setAssignmentMunicipality(""); setAssignmentMunicipalityQuery(""); }} className="w-full rounded-2xl bg-cyan-400/10 px-4 py-3 text-left text-sm text-cyan-100 hover:bg-cyan-400/15">{t("adminCommonAllMunicipalsInRegion", { region: assignmentRegion })}</button>{municipalitySuggestions.map((municipality) => <button key={municipality} type="button" onClick={() => { setAssignmentMunicipality(municipality); setAssignmentMunicipalityQuery(municipality); }} className="w-full rounded-2xl bg-white/5 px-4 py-3 text-left text-sm text-white hover:bg-white/10">{municipality}</button>)}</div> : null}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">{t("adminWizardAutoZone")}</p>
                <p className="mt-2 text-sm text-white">{currentZone || t("adminWizardZoneAppearsAfterRegion")}</p>
              </div>
              <button type="button" onClick={addCoverageAssignment} className="rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950">
                {t("adminWizardAddAssignment")}
              </button>
            </div>
            <div className="space-y-3 rounded-[28px] border border-white/10 bg-slate-950/35 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">{t("adminWizardAssignments")}</p>
              <p className="text-sm leading-7 text-slate-300">{t("adminWizardAssignmentsBody")}</p>
              {value.coverage_assignments.length ? value.coverage_assignments.map((assignment) => <div key={`${assignment.desk}-${assignment.region}-${assignment.municipality}`} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-sm font-semibold text-white">{translateAdminDesk(t, assignment.desk)}</p><p className="mt-2 text-sm text-slate-300">{assignment.region}{assignment.municipality ? ` / ${assignment.municipality}` : ` / ${t("adminCommonAllMunicipals")}`}</p><p className="mt-2 text-xs uppercase tracking-[0.16em] text-cyan-200">{assignment.zone}</p><button type="button" onClick={() => setField("coverage_assignments", value.coverage_assignments.filter((item) => item !== assignment))} className="mt-3 text-sm font-semibold text-rose-200">{t("adminWizardRemoveAssignment")}</button></div>) : <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">{requiresCoverage ? t("adminWizardAssignmentRequired") : t("adminWizardAssignmentOptional")}</div>}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white">{t("adminWizardUsername")}</span>
              <input type="text" value={value.username} disabled={mode === "edit"} onChange={(event) => setField("username", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none disabled:opacity-60" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-white">{mode === "create" ? t("adminWizardTemporaryPassword") : t("adminWizardResetPasswordOptional")}</span>
              <input type="password" value={value.password} onChange={(event) => setField("password", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none" />
            </label>
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-4">
              <p className="text-sm font-semibold text-white">{t("adminWizardAccountStatus")}</p>
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={() => setField("is_active", true)} className={`rounded-full px-4 py-2 text-sm font-semibold ${value.is_active ? "bg-emerald-400/15 text-emerald-100" : "bg-white/5 text-slate-300"}`}>{t("adminWizardActive")}</button>
                <button type="button" onClick={() => setField("is_active", false)} className={`rounded-full px-4 py-2 text-sm font-semibold ${!value.is_active ? "bg-rose-400/15 text-rose-100" : "bg-white/5 text-slate-300"}`}>{t("adminWizardInactive")}</button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white">{t("adminWizardRoleTitle")}</span>
                <input type="text" value={value.role_title} onChange={(event) => setField("role_title", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none" placeholder={isAnalyst ? t("adminWizardRoleTitleAnalystPlaceholder") : t("adminWizardRoleTitleGeneralPlaceholder")} />
              </label>
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">{t("adminWizardAnalystStatus")}</p>
                <p className="mt-2 text-sm leading-7 text-white">{isAnalyst ? t("adminWizardAnalystEnabled") : t("adminWizardAnalystDisabled")}</p>
              </div>
            </div>
            <div className="space-y-3 rounded-[28px] border border-white/10 bg-slate-950/35 p-5">
              <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/50">
                {value.signature_image_preview_url ? <img src={value.signature_image_preview_url} alt={t("adminProfileSignature")} className="h-full w-full object-contain" /> : <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("adminProfileSignature")}</span>}
              </div>
              <label className="inline-flex cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                {t("adminWizardUploadSignature")}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleImageUpload(event.target.files?.[0] ?? null, { data: "signature_image_data_url", name: "signature_image_filename", preview: "signature_image_preview_url" })} />
              </label>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_240px]">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-white">{t("adminWizardOrganizationName")}</span>
                <input type="text" value={value.organization_name} onChange={(event) => setField("organization_name", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-white">{t("adminWizardOfficeAddress")}</span>
                <textarea value={value.organization_address} onChange={(event) => setField("organization_address", event.target.value)} rows={3} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white">{t("adminWizardOfficeEmail")}</span>
                <input type="email" value={value.organization_email} onChange={(event) => setField("organization_email", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-white">{t("adminWizardOfficePhone")}</span>
                <input type="text" value={value.organization_phone} onChange={(event) => setField("organization_phone", event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none" />
              </label>
            </div>
            <div className="space-y-3 rounded-[28px] border border-white/10 bg-slate-950/35 p-5">
              <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/50">
                {value.organization_logo_preview_url ? <img src={value.organization_logo_preview_url} alt={t("adminWizardLogo")} className="h-full w-full object-contain" /> : <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("adminWizardLogo")}</span>}
              </div>
              <label className="inline-flex cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                {t("adminWizardUploadLogo")}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleImageUpload(event.target.files?.[0] ?? null, { data: "organization_logo_data_url", name: "organization_logo_filename", preview: "organization_logo_preview_url" })} />
              </label>
            </div>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{t("adminWizardIdentityReview")}</p><p className="mt-3 text-lg font-semibold text-white">{value.full_name || t("adminCommonNotSet")}</p><p className="mt-2 text-sm text-slate-300">{value.display_name || t("adminWizardNoDisplayName")} | {value.email || t("adminCommonNoPersonalEmail")}</p><p className="mt-2 text-sm text-slate-300">{value.mobile_number || t("adminCommonNoPersonalMobile")}</p><p className="mt-3 text-sm font-semibold text-white">{t("adminProfileRoles")}</p><p className="mt-2 text-sm text-slate-300">{value.roles.length ? value.roles.map((role) => translateAdminRole(t, role)).join(", ") : t("adminWizardNoRolesSelected")}</p></div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{t("adminWizardCoverageReview")}</p><div className="mt-3 space-y-2 text-sm text-slate-300">{value.coverage_assignments.length ? value.coverage_assignments.map((assignment) => <p key={`${assignment.desk}-${assignment.region}-${assignment.municipality}`}>{translateAdminDesk(t, assignment.desk)} | {assignment.region}{assignment.municipality ? ` / ${assignment.municipality}` : ` / ${t("adminCommonAllMunicipals")}`} | {assignment.zone}</p>) : <p>{t("adminWizardNoScopedAssignments")}</p>}</div></div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{t("adminWizardSystemAccessReview")}</p><p className="mt-3 text-sm text-slate-300">{t("adminWizardUsernameReview", { username: value.username || t("adminCommonNotSet") })}</p><p className="mt-2 text-sm text-slate-300">{t("adminWizardStatusReview", { status: value.is_active ? t("adminWizardActive") : t("adminWizardInactive") })}</p></div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-5"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{t("adminWizardReportAttributionReview")}</p><p className="mt-3 text-sm text-slate-300">{value.role_title || t("adminCommonNoRoleTitle")}</p><p className="mt-2 text-sm text-slate-300">{value.organization_name || t("adminCommonNoOrganization")} | {value.organization_email || t("adminCommonNoOfficeEmail")}</p><p className="mt-2 text-sm text-slate-300">{value.organization_phone || t("adminCommonNoOfficePhone")}</p></div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">{mode === "create" ? t("adminWizardReviewCreateNote") : t("adminWizardReviewEditNote")}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {step > 1 ? <button type="button" onClick={goBack} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">{t("adminWizardPrevious")}</button> : null}
          {step < stepLabels.length ? (
            <button type="button" onClick={goNext} className="rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-5 py-3 text-sm font-semibold text-slate-950">{t("adminWizardNext")}</button>
          ) : (
            <button type="button" disabled={submitting} onClick={() => void submit()} className="rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
              {submitting ? t("adminWizardSaving") : mode === "create" ? t("adminWizardCreateUser") : t("adminWizardSaveChanges")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default AdminUserWizard;

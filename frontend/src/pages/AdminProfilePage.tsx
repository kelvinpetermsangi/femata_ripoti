import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { regionMunicipalityMap } from "../data/tanzaniaLocations";
import { API_BASE } from "../lib/apiBase";
import { adminFetch, type AdminUser } from "../lib/adminAuth";
import { translateAdminDesk, translateAdminRole } from "../lib/adminI18n";
import { readFileAsDataUrl } from "../lib/fileDataUrl";
import { useAdminLayoutContext } from "../components/adminLayoutContext";

type ProfileResponse = {
  user: AdminUser;
  directory: AdminUser[];
};

const AdminProfilePage = () => {
  const { refreshSession, theme } = useAdminLayoutContext();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<AdminUser | null>(null);
  const [directory, setDirectory] = useState<AdminUser[]>([]);
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [avatarFilename, setAvatarFilename] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signatureFilename, setSignatureFilename] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await adminFetch(`${API_BASE}/admin/profile`);
      if (!response.ok) return;
      const data = (await response.json()) as ProfileResponse;
      if (!active) return;
      setProfile(data.user);
      setDirectory(data.directory.filter((item) => item.user_id !== data.user.user_id));
      setFullName(data.user.full_name || "");
      setDisplayName(data.user.display_name || "");
      setRoleTitle(data.user.role_title || "");
      setAvatarDataUrl(data.user.profile_image_url || null);
      setAvatarFilename(data.user.profile_image_filename || null);
      setSignatureDataUrl(data.user.signature_image_url || null);
      setSignatureFilename(data.user.signature_image_filename || null);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const coveredMunicipalities = useMemo(() => {
    if (!profile) return [];
    return [...new Set(profile.assigned_regions.flatMap((region) => regionMunicipalityMap[region] || []))].slice(0, 20);
  }, [profile]);

  const coverageLines = useMemo(() => profile?.coverage_assignments || [], [profile]);
  const shellClass = theme === "light" ? "border border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(148,163,184,0.14)]" : "border border-white/10 bg-white/5 backdrop-blur-md";
  const cardClass = theme === "light" ? "border border-slate-200/80 bg-slate-50/80" : "border border-white/10 bg-slate-950/40";
  const mutedClass = theme === "light" ? "text-slate-600" : "text-slate-300";
  const subtleClass = theme === "light" ? "text-slate-500" : "text-slate-400";
  const inputClass = theme === "light" ? "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none" : "w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none";

  const handleAvatarChange = async (file: File | null) => {
    if (!file) return;
    const asset = await readFileAsDataUrl(file);
    setAvatarDataUrl(asset.dataUrl);
    setAvatarFilename(asset.name);
  };

  const handleSignatureChange = async (file: File | null) => {
    if (!file) return;
    const asset = await readFileAsDataUrl(file);
    setSignatureDataUrl(asset.dataUrl);
    setSignatureFilename(asset.name);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await adminFetch(`${API_BASE}/admin/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          display_name: displayName,
          role_title: roleTitle || undefined,
          current_password: currentPassword || undefined,
          new_password: newPassword || undefined,
          profile_image_data_url: avatarDataUrl?.startsWith("data:") ? avatarDataUrl : undefined,
          profile_image_filename: avatarFilename || undefined,
          signature_image_data_url: signatureDataUrl?.startsWith("data:") ? signatureDataUrl : undefined,
          signature_image_filename: signatureFilename || undefined,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as AdminUser & { detail?: string };
      if (!response.ok) {
        throw new Error(data.detail || t("adminProfileSaveError"));
      }
      const updatedProfile = data as AdminUser;
      setProfile(updatedProfile);
      setFullName(updatedProfile.full_name || "");
      setDisplayName(updatedProfile.display_name || "");
      setRoleTitle(updatedProfile.role_title || "");
      setAvatarDataUrl(updatedProfile.profile_image_url || null);
      setAvatarFilename(updatedProfile.profile_image_filename || null);
      setSignatureDataUrl(updatedProfile.signature_image_url || null);
      setSignatureFilename(updatedProfile.signature_image_filename || null);
      setCurrentPassword("");
      setNewPassword("");
      await refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminProfileSaveError"));
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
        <div className={`rounded-[32px] p-8 text-center text-sm ${shellClass} ${mutedClass}`}>
        {t("adminProfileLoading")}
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className={`rounded-[32px] p-6 ${shellClass}`}>
          <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{t("adminProfileEyebrow")}</p>
          <h1 className={`mt-4 text-3xl font-bold ${theme === "light" ? "text-slate-950" : "text-white"}`}>{t("adminProfileTitle")}</h1>
          <p className={`mt-4 text-sm leading-7 ${mutedClass}`}>{t("adminProfileDesc")}</p>
          {error ? <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
          <div className="mt-6 grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-start">
            <div className="flex flex-col items-center gap-3">
              <div className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] ${cardClass}`}>
                {avatarDataUrl ? <img src={avatarDataUrl} alt={t("adminProfileTitle")} className="h-full w-full object-cover" /> : <span className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminProfileAvatar")}</span>}
              </div>
              <label className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold ${theme === "light" ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-100" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}>
                {t("adminProfileChangePicture")}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleAvatarChange(event.target.files?.[0] ?? null)} />
              </label>
            </div>
            <div className="space-y-4">
              <label className="block">
                  <span className={`mb-2 block text-sm font-semibold ${theme === "light" ? "text-slate-900" : "text-white"}`}>{t("adminProfileFullName")}</span>
                <input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} />
              </label>
              <label className="block">
                  <span className={`mb-2 block text-sm font-semibold ${theme === "light" ? "text-slate-900" : "text-white"}`}>{t("adminProfileDisplayName")}</span>
                <input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={inputClass} />
              </label>
              <label className="block">
                  <span className={`mb-2 block text-sm font-semibold ${theme === "light" ? "text-slate-900" : "text-white"}`}>{t("adminProfileRoleTitle")}</span>
                <input type="text" value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} className={inputClass} />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={`mb-2 block text-sm font-semibold ${theme === "light" ? "text-slate-900" : "text-white"}`}>{t("adminProfileCurrentPassword")}</span>
                  <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={`mb-2 block text-sm font-semibold ${theme === "light" ? "text-slate-900" : "text-white"}`}>{t("adminProfileNewPassword")}</span>
                  <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} />
                </label>
              </div>
              <div className={`rounded-[28px] p-4 ${cardClass}`}>
                <div className={`flex h-24 w-full items-center justify-center overflow-hidden rounded-[24px] ${cardClass}`}>
                  {signatureDataUrl ? <img src={signatureDataUrl} alt={t("adminProfileSignature")} className="h-full w-full object-contain" /> : <span className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminProfileSignature")}</span>}
                </div>
                <label className={`mt-3 inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold ${theme === "light" ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-100" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}>
                  {t("adminProfileChangeSignature")}
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleSignatureChange(event.target.files?.[0] ?? null)} />
                </label>
              </div>
              <button type="button" disabled={saving} onClick={() => void handleSave()} className="rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
                {saving ? t("adminProfileSaving") : t("adminProfileSave")}
              </button>
            </div>
          </div>
        </div>

        <div className={`rounded-[32px] p-6 ${shellClass}`}>
          <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === "light" ? "text-amber-700" : "text-amber-200"}`}>{t("adminProfileReadOnlyTitle")}</p>
          <div className="mt-5 space-y-4 text-sm">
            <div className={`rounded-2xl p-4 ${cardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminProfileEmail")}</p><p className={`mt-2 ${theme === "light" ? "text-slate-900" : "text-white"}`}>{profile.email || t("adminCommonNotSet")}</p></div>
            <div className={`rounded-2xl p-4 ${cardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminProfileMobile")}</p><p className={`mt-2 ${theme === "light" ? "text-slate-900" : "text-white"}`}>{profile.mobile_number || t("adminCommonNotSet")}</p></div>
            <div className={`rounded-2xl p-4 ${cardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminProfileRoles")}</p><p className={`mt-2 ${theme === "light" ? "text-slate-900" : "text-white"}`}>{profile.roles.map((role) => translateAdminRole(t, role)).join(", ")}</p></div>
            <div className={`rounded-2xl p-4 ${cardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminProfileAssignedZones")}</p><p className={`mt-2 ${theme === "light" ? "text-slate-900" : "text-white"}`}>{profile.assigned_zones?.length ? profile.assigned_zones.join(", ") : t("adminCommonNone")}</p></div>
            <div className={`rounded-2xl p-4 ${cardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminProfileAssignedDesks")}</p><p className={`mt-2 ${theme === "light" ? "text-slate-900" : "text-white"}`}>{profile.assigned_desks.length ? profile.assigned_desks.map((desk) => translateAdminDesk(t, desk)).join(", ") : t("adminCommonNone")}</p></div>
            <div className={`rounded-2xl p-4 ${cardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminProfileAssignedRegions")}</p><p className={`mt-2 ${theme === "light" ? "text-slate-900" : "text-white"}`}>{profile.assigned_regions.length ? profile.assigned_regions.join(", ") : t("adminCommonNone")}</p></div>
            <div className={`rounded-2xl p-4 ${cardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminProfileCoveredMunicipals")}</p><p className={`mt-2 ${theme === "light" ? "text-slate-900" : "text-white"}`}>{coveredMunicipalities.length ? coveredMunicipalities.join(", ") : t("adminProfileMunicipalCoveragePending")}</p></div>
            <div className={`rounded-2xl p-4 ${cardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminProfileOrganizationHeader")}</p><p className={`mt-2 ${theme === "light" ? "text-slate-900" : "text-white"}`}>{profile.organization_name || t("adminCommonNotSet")}</p><p className={`mt-2 text-sm ${mutedClass}`}>{profile.organization_email || t("adminCommonNoOfficeEmail")} | {profile.organization_phone || t("adminCommonNoOfficePhone")}</p><p className={`mt-2 text-sm ${mutedClass}`}>{profile.organization_address || t("adminCommonNoOfficeAddress")}</p></div>
            <div className={`rounded-2xl p-4 ${cardClass}`}><p className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminProfileCoverageAssignments")}</p><div className={`mt-2 space-y-2 text-sm ${theme === "light" ? "text-slate-900" : "text-white"}`}>{coverageLines.length ? coverageLines.map((item) => <p key={`${item.desk}-${item.region}-${item.municipality}`}>{translateAdminDesk(t, item.desk)} | {item.region}{item.municipality ? ` / ${item.municipality}` : ` / ${t("adminCommonAllMunicipals")}`} | {item.zone || t("adminWizardZonePending")}</p>) : <p>{t("adminCommonNone")}</p>}</div></div>
          </div>
        </div>
      </section>

      <section className={`rounded-[32px] p-6 ${shellClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{t("adminProfileDirectoryEyebrow")}</p>
            <h2 className={`mt-3 text-2xl font-bold ${theme === "light" ? "text-slate-950" : "text-white"}`}>{t("adminProfileDirectoryTitle")}</h2>
          </div>
          <Link to="/dashboard/inbox" className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15">
            {t("adminProfileOpenInbox")}
          </Link>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {directory.map((user) => {
            const municipals = [...new Set(user.assigned_regions.flatMap((region) => regionMunicipalityMap[region] || []))].slice(0, 8);
            return (
              <div key={user.user_id} className={`rounded-[28px] p-5 ${cardClass}`}>
                <div className="flex items-start gap-4">
                  <div className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl ${cardClass}`}>
                    {user.profile_image_url ? <img src={user.profile_image_url} alt={user.username} className="h-full w-full object-cover" /> : <span className={`text-xs uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminProfileAvatar")}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-lg font-semibold ${theme === "light" ? "text-slate-950" : "text-white"}`}>{user.display_name || user.username}</p>
                    <p className={`mt-1 text-sm ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{user.email || user.username}</p>
                    <p className={`mt-2 text-sm ${mutedClass}`}>{user.assigned_regions.join(", ") || t("adminProfileNoRegionPosted")}</p>
                    <p className={`mt-2 text-xs uppercase tracking-[0.16em] ${theme === "light" ? "text-amber-700" : "text-amber-200"}`}>{user.assigned_zones?.join(", ") || t("adminProfileNoZoneCoverage")}</p>
                    <p className={`mt-2 text-xs leading-6 ${subtleClass}`}>{municipals.length ? t("adminProfileMunicipalsLabel", { list: municipals.join(", ") }) : t("adminProfileMunicipalsDerived")}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/dashboard/inbox?compose=${user.user_id}`} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15">
                    {t("adminProfileMessage")}
                  </Link>
                  <a href={`mailto:${user.email || ""}`} className={`rounded-full border px-4 py-2 text-sm font-semibold ${theme === "light" ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-100" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}>
                    {t("adminProfileEmailAction")}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default AdminProfilePage;

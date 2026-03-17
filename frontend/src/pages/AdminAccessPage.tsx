import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import AdminUserWizard, { createEmptyAdminUserWizardValue, type AdminUserWizardValue } from "../components/AdminUserWizard";
import { useAdminLayoutContext } from "../components/adminLayoutContext";
import { API_BASE } from "../lib/apiBase";
import { adminFetch, type AdminUser } from "../lib/adminAuth";
import { translateAdminDesk, translateAdminRole } from "../lib/adminI18n";

type ZoneRecord = {
  zone_id: string;
  name: string;
  regions: string[];
};

const mapUserToWizardValue = (user: AdminUser): AdminUserWizardValue => ({
  username: user.username,
  password: "",
  display_name: user.display_name || "",
  full_name: user.full_name || "",
  email: user.email || "",
  mobile_number: user.mobile_number || "",
  roles: user.roles,
  coverage_assignments: (user.coverage_assignments || []).map((assignment) => ({
    desk: assignment.desk,
    region: assignment.region,
    municipality: assignment.municipality || "",
    zone: assignment.zone || "",
  })),
  profile_image_data_url: null,
  profile_image_filename: user.profile_image_filename || null,
  profile_image_preview_url: user.profile_image_url || null,
  is_active: user.is_active,
  role_title: user.role_title || "",
  reporting_line: user.reporting_line || "",
  signature_image_data_url: null,
  signature_image_filename: user.signature_image_filename || null,
  signature_image_preview_url: user.signature_image_url || null,
  organization_name: user.organization_name || "FEMATA",
  organization_address: user.organization_address || "",
  organization_email: user.organization_email || "",
  organization_phone: user.organization_phone || "",
  organization_logo_data_url: null,
  organization_logo_filename: user.organization_logo_filename || null,
  organization_logo_preview_url: user.organization_logo_url || null,
});

const buildPayload = (value: AdminUserWizardValue, mode: "create" | "edit") => {
  const payload: Record<string, unknown> = {
    display_name: value.display_name || null,
    full_name: value.full_name || null,
    roles: value.roles,
    coverage_assignments: value.coverage_assignments.map((assignment) => ({
      desk: assignment.desk,
      region: assignment.region,
      municipality: assignment.municipality || null,
    })),
    email: value.email || null,
    mobile_number: value.mobile_number || null,
    role_title: value.role_title || null,
    reporting_line: value.reporting_line || null,
    organization_name: value.organization_name || null,
    organization_address: value.organization_address || null,
    organization_email: value.organization_email || null,
    organization_phone: value.organization_phone || null,
    is_active: value.is_active,
  };

  if (mode === "create") {
    payload.username = value.username;
    payload.password = value.password;
  } else if (value.password.trim()) {
    payload.password = value.password;
  }

  if (value.profile_image_data_url?.startsWith("data:")) {
    payload.profile_image_data_url = value.profile_image_data_url;
    payload.profile_image_filename = value.profile_image_filename;
  }
  if (value.signature_image_data_url?.startsWith("data:")) {
    payload.signature_image_data_url = value.signature_image_data_url;
    payload.signature_image_filename = value.signature_image_filename;
  }
  if (value.organization_logo_data_url?.startsWith("data:")) {
    payload.organization_logo_data_url = value.organization_logo_data_url;
    payload.organization_logo_filename = value.organization_logo_filename;
  }

  return payload;
};

const AdminAccessPage = () => {
  const { session, refreshSession } = useAdminLayoutContext();
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [createWizardKey, setCreateWizardKey] = useState(0);

  const canManageUsers = session.permissions.includes("manage_users");
  const zoneLookup = useMemo(() => Object.fromEntries(zones.flatMap((zone) => zone.regions.map((region) => [region, zone.name]))), [zones]);
  const editingUser = useMemo(() => users.find((user) => user.user_id === editingUserId) ?? null, [editingUserId, users]);
  const editingWizardValue = useMemo(() => (editingUser ? mapUserToWizardValue(editingUser) : null), [editingUser]);
  const createWizardValue = useMemo(() => createEmptyAdminUserWizardValue(), []);
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [
        user.username,
        user.display_name,
        user.full_name,
        user.email,
        user.organization_name,
        ...(user.assigned_regions || []),
        ...(user.assigned_desks || []),
      ]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(query)),
    );
  }, [searchQuery, users]);

  const load = useMemo(() => async () => {
    setLoading(true);
    setError("");
    try {
      const [usersResponse, zonesResponse] = await Promise.all([
        adminFetch(`${API_BASE}/admin/users`),
        adminFetch(`${API_BASE}/admin/zones`),
      ]);

      if (!usersResponse.ok) throw new Error(t("adminAccessLoadUsersError"));
      if (!zonesResponse.ok) throw new Error(t("adminZonesLoadError"));

      const [usersData, zonesData] = await Promise.all([usersResponse.json(), zonesResponse.json()]);
      setUsers(usersData as AdminUser[]);
      setZones(zonesData as ZoneRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminAccessLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (value: AdminUserWizardValue) => {
    setSaving(true);
    setError("");
    try {
      const response = await adminFetch(`${API_BASE}/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(value, "create")),
      });
      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) throw new Error(data.detail || t("adminAccessCreateError"));
      await load();
      setTemporaryPassword(value.password);
      setCreateWizardKey((current) => current + 1);
      await refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminAccessCreateError"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (value: AdminUserWizardValue) => {
    if (!editingUser) return;
    setSaving(true);
    setError("");
    try {
      const response = await adminFetch(`${API_BASE}/admin/users/${editingUser.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(value, "edit")),
      });
      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) throw new Error(data.detail || t("adminAccessUpdateError"));
      await load();
      setEditingUserId(null);
      await refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminAccessUpdateError"));
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (userId: string, action: "revoke" | "delete" | "reset") => {
    setActionUserId(userId);
    setError("");
    setTemporaryPassword("");
    try {
      if (action === "revoke") {
        const response = await adminFetch(`${API_BASE}/admin/users/${userId}/revoke-sessions`, { method: "POST" });
        const data = (await response.json().catch(() => ({}))) as { detail?: string };
        if (!response.ok) throw new Error(data.detail || t("adminAccessRevokeError"));
      }
      if (action === "delete") {
        const response = await adminFetch(`${API_BASE}/admin/users/${userId}`, { method: "DELETE" });
        const data = (await response.json().catch(() => ({}))) as { detail?: string };
        if (!response.ok) throw new Error(data.detail || t("adminAccessDeleteError"));
      }
      if (action === "reset") {
        const response = await adminFetch(`${API_BASE}/admin/users/${userId}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = (await response.json().catch(() => ({}))) as { detail?: string; temporary_password?: string };
        if (!response.ok) throw new Error(data.detail || t("adminAccessResetError"));
        setTemporaryPassword(data.temporary_password || "");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminAccessActionError"));
    } finally {
      setActionUserId("");
    }
  };

  if (!canManageUsers) {
    return <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 text-sm text-slate-300">{t("adminAccessUnauthorized")}</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(7,20,38,0.95),rgba(10,30,48,0.9),rgba(10,18,34,0.96))] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{t("adminAccessEyebrow")}</p>
            <h1 className="mt-4 text-3xl font-bold text-white">{t("adminAccessTitle")}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{t("adminAccessDesc")}</p>
          </div>
          <Link to="/dashboard/zones" className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15">
            {t("adminAccessOpenZones")}
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t("adminAccessProtectedUsers")}</p><p className="mt-3 text-3xl font-bold text-white">{users.length}</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t("adminAccessAnalysts")}</p><p className="mt-3 text-3xl font-bold text-white">{users.filter((user) => user.roles.includes("analyst")).length}</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t("adminAccessActiveAccounts")}</p><p className="mt-3 text-3xl font-bold text-white">{users.filter((user) => user.is_active).length}</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4"><p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t("adminAccessDefinedZones")}</p><p className="mt-3 text-3xl font-bold text-white">{zones.length}</p></div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      {temporaryPassword ? <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">{t("adminAccessTemporaryPassword", { password: temporaryPassword })}</div> : null}

      <AdminUserWizard key={`create-${createWizardKey}`} mode="create" initialValue={createWizardValue} zoneLookup={zoneLookup} submitting={saving} onSubmit={handleCreate} />

      {editingUser ? (
        <div className="rounded-[32px] border border-cyan-300/20 bg-cyan-400/10 p-2">
          <AdminUserWizard mode="edit" initialValue={editingWizardValue || createEmptyAdminUserWizardValue()} zoneLookup={zoneLookup} submitting={saving} onSubmit={handleEdit} />
          <div className="px-5 pb-5">
            <button type="button" onClick={() => setEditingUserId(null)} className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
              {t("adminAccessCloseEditing")}
            </button>
          </div>
        </div>
      ) : null}

      <section className="space-y-5 rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">{t("adminAccessDirectoryEyebrow")}</p>
            <h2 className="mt-3 text-2xl font-bold text-white">{t("adminAccessDirectoryTitle")}</h2>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("adminAccessSearchPlaceholder")}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
          />
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-8 text-center text-sm text-slate-300">{t("adminAccessLoading")}</div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredUsers.map((user) => (
              <div key={user.user_id} className="rounded-[28px] border border-white/10 bg-slate-950/35 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[22px] border border-white/10 bg-white/5">
                    {user.profile_image_url ? <img src={user.profile_image_url} alt={user.username} className="h-full w-full object-cover" /> : <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("adminAccessAvatar")}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-white">{user.full_name || user.display_name || user.username}</p>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${user.is_active ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border border-rose-300/20 bg-rose-400/10 text-rose-100"}`}>{user.is_active ? t("adminAccessActive") : t("adminAccessInactive")}</span>
                    </div>
                    <p className="mt-1 text-sm text-cyan-200">{user.username}</p>
                    <p className="mt-2 text-sm text-slate-300">{user.role_title || t("adminCommonNoRoleTitle")} | {user.organization_name || t("adminCommonNoOrganization")}</p>
                    <p className="mt-2 text-xs leading-6 text-slate-400">{user.roles.map((role) => translateAdminRole(t, role)).join(", ")}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{t("adminAccessCoverage")}</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    {user.coverage_assignments?.length ? user.coverage_assignments.map((assignment) => (
                      <p key={`${assignment.desk}-${assignment.region}-${assignment.municipality}`}>{translateAdminDesk(t, assignment.desk)} | {assignment.region}{assignment.municipality ? ` / ${assignment.municipality}` : ` / ${t("adminCommonAllMunicipals")}`} | {assignment.zone || t("adminWizardZonePending")}</p>
                    )) : <p>{t("adminAccessNoAssignments")}</p>}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditingUserId(user.user_id)} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15">
                    {t("adminAccessEdit")}
                  </button>
                  <button type="button" disabled={actionUserId === user.user_id} onClick={() => void handleAction(user.user_id, "revoke")} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60">
                    {t("adminAccessRevokeSessions")}
                  </button>
                  <button type="button" disabled={actionUserId === user.user_id} onClick={() => void handleAction(user.user_id, "reset")} className="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-400/15 disabled:opacity-60">
                    {t("adminAccessResetPassword")}
                  </button>
                  {!user.is_system ? (
                    <button type="button" disabled={actionUserId === user.user_id} onClick={() => void handleAction(user.user_id, "delete")} className="rounded-full border border-rose-300/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/15 disabled:opacity-60">
                      {t("adminAccessDelete")}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminAccessPage;

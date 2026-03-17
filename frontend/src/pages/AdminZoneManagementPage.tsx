import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { normalizeLocation, regions } from "../data/tanzaniaLocations";
import { useAdminLayoutContext } from "../components/adminLayoutContext";
import { API_BASE } from "../lib/apiBase";
import { adminFetch } from "../lib/adminAuth";

type ZoneRecord = {
  zone_id: string;
  name: string;
  regions: string[];
};

const AdminZoneManagementPage = () => {
  const { session, theme } = useAdminLayoutContext();
  const { t } = useTranslation();
  const [zones, setZones] = useState<ZoneRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queryByZone, setQueryByZone] = useState<Record<string, string>>({});
  const [renameByZone, setRenameByZone] = useState<Record<string, string>>({});
  const [savingZoneId, setSavingZoneId] = useState("");

  const canManageUsers = session.permissions.includes("manage_users");
  const assignedRegions = useMemo(() => new Set(zones.flatMap((zone) => zone.regions)), [zones]);
  const shellClass = theme === "light" ? "border border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(148,163,184,0.14)]" : "border border-white/10 bg-white/5 backdrop-blur-md";
  const cardClass = theme === "light" ? "border border-slate-200/80 bg-slate-50/80" : "border border-white/10 bg-slate-950/55";
  const mutedClass = theme === "light" ? "text-slate-600" : "text-slate-300";
  const subtleClass = theme === "light" ? "text-slate-500" : "text-slate-400";
  const inputClass = theme === "light" ? "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400" : "w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500";

  const load = useMemo(() => async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminFetch(`${API_BASE}/admin/zones`);
      if (!response.ok) throw new Error(t("adminZoneLoadError"));
      const data = (await response.json()) as ZoneRecord[];
      setZones(data);
      setRenameByZone(Object.fromEntries(data.map((zone) => [zone.zone_id, zone.name])));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminZoneLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRename = async (zoneId: string) => {
    setSavingZoneId(zoneId);
    setError("");
    try {
      const response = await adminFetch(`${API_BASE}/admin/zones/${zoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameByZone[zoneId] }),
      });
      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) throw new Error(data.detail || t("adminZoneRenameError"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminZoneRenameError"));
    } finally {
      setSavingZoneId("");
    }
  };

  const handleAddRegion = async (zoneId: string, regionName: string) => {
    setSavingZoneId(zoneId);
    setError("");
    try {
      const response = await adminFetch(`${API_BASE}/admin/zones/${zoneId}/regions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region_name: regionName }),
      });
      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) throw new Error(data.detail || t("adminZoneAddRegionError"));
      setQueryByZone((current) => ({ ...current, [zoneId]: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminZoneAddRegionError"));
    } finally {
      setSavingZoneId("");
    }
  };

  const handleRemoveRegion = async (zoneId: string, regionName: string) => {
    setSavingZoneId(zoneId);
    setError("");
    try {
      const response = await adminFetch(`${API_BASE}/admin/zones/${zoneId}/regions/${encodeURIComponent(regionName)}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) throw new Error(data.detail || t("adminZoneRemoveRegionError"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminZoneRemoveRegionError"));
    } finally {
      setSavingZoneId("");
    }
  };

  if (!canManageUsers) {
    return <div className={`rounded-[32px] p-8 text-sm ${shellClass} ${mutedClass}`}>{t("adminZoneUnauthorized")}</div>;
  }

  return (
    <div className="space-y-6">
      <section className={`rounded-[32px] p-6 sm:p-8 ${theme === "light" ? "border border-slate-200 bg-[linear-gradient(145deg,#ffffff,#eef6ff)] text-slate-950 shadow-[0_20px_60px_rgba(148,163,184,0.16)]" : "border border-white/10 bg-[linear-gradient(160deg,rgba(7,20,38,0.95),rgba(10,30,48,0.9),rgba(10,18,34,0.96))]"}`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{t("adminZoneEyebrow")}</p>
        <h1 className={`mt-4 text-3xl font-bold ${theme === "light" ? "text-slate-950" : "text-white"}`}>{t("adminZoneTitle")}</h1>
        <p className={`mt-4 max-w-3xl text-sm leading-7 ${mutedClass}`}>{t("adminZoneDesc")}</p>
      </section>

      {error ? <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      {loading ? (
        <div className={`rounded-[32px] p-8 text-center text-sm ${shellClass} ${mutedClass}`}>{t("adminZoneLoading")}</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {zones.map((zone) => {
            const query = queryByZone[zone.zone_id] || "";
            const suggestions = regions.filter((region) => !zone.regions.includes(region) && normalizeLocation(region).includes(normalizeLocation(query)));
            return (
              <section key={zone.zone_id} className={`rounded-[30px] p-5 ${shellClass}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={renameByZone[zone.zone_id] || zone.name}
                    onChange={(event) => setRenameByZone((current) => ({ ...current, [zone.zone_id]: event.target.value }))}
                    className={`min-w-0 flex-1 font-semibold ${inputClass}`}
                  />
                  <button type="button" disabled={savingZoneId === zone.zone_id} onClick={() => void handleRename(zone.zone_id)} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15 disabled:opacity-60">
                    {t("adminZoneRename")}
                  </button>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {zone.regions.map((region) => (
                    <button key={region} type="button" onClick={() => void handleRemoveRegion(zone.zone_id, region)} className="rounded-full border border-white/10 bg-slate-950/45 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500/10">
                      {region}
                    </button>
                  ))}
                </div>
                <div className="mt-5 space-y-3">
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQueryByZone((current) => ({ ...current, [zone.zone_id]: event.target.value }))}
                    placeholder={t("adminZoneRegionPlaceholder")}
                    className={inputClass}
                  />
                  {query.trim() ? (
                    <div className={`max-h-60 space-y-2 overflow-auto rounded-2xl p-2 ${cardClass}`}>
                      {suggestions.length ? suggestions.map((region) => (
                        <button key={region} type="button" onClick={() => void handleAddRegion(zone.zone_id, region)} className={`w-full rounded-2xl px-4 py-3 text-left text-sm ${theme === "light" ? "bg-white text-slate-900 hover:bg-slate-100" : "bg-white/5 text-white hover:bg-white/10"}`}>
                          {region}
                        </button>
                      )) : <div className={`rounded-2xl px-4 py-3 text-sm ${subtleClass}`}>{t("adminZoneNoMatchingRegions")}</div>}
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <section className={`rounded-[30px] p-5 ${shellClass}`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === "light" ? "text-amber-700" : "text-amber-200"}`}>{t("adminZoneCoverageCheck")}</p>
        <p className={`mt-3 text-sm leading-7 ${mutedClass}`}>{t("adminZoneCoverageBody", { assigned: assignedRegions.size, total: regions.length })}</p>
      </section>
    </div>
  );
};

export default AdminZoneManagementPage;

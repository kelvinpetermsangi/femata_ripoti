import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAdminLayoutContext } from "../components/adminLayoutContext";
import { API_BASE } from "../lib/apiBase";
import { adminFetch } from "../lib/adminAuth";
import { supportedLanguages } from "../i18n";

type LocaleInfo = {
  code: string;
  namespaces: string[];
};

type LocalesResponse = {
  available: LocaleInfo[];
  enabled: string[];
};

const AdminLocalesPage = () => {
  const { session, theme } = useAdminLayoutContext();
  const { t } = useTranslation();
  const [locales, setLocales] = useState<LocalesResponse>({ available: [], enabled: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [enabledSet, setEnabledSet] = useState<Set<string>>(new Set());

  const canManageUsers = session.permissions.includes("manage_users");
  const shellClass = theme === "light" ? "border border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(148,163,184,0.14)]" : "border border-white/10 bg-white/5 backdrop-blur-md";
  const cardClass = theme === "light" ? "border border-slate-200/80 bg-slate-50/80" : "border border-white/10 bg-slate-950/55";
  const mutedClass = theme === "light" ? "text-slate-600" : "text-slate-300";
  const subtleClass = theme === "light" ? "text-slate-500" : "text-slate-400";

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminFetch(`${API_BASE}/admin/locales`);
      if (!response.ok) throw new Error(t("adminLocalesLoadError"));
      const data = (await response.json()) as LocalesResponse;
      setLocales(data);
      setEnabledSet(new Set(data.enabled));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminLocalesLoadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleToggleLocale = (code: string) => {
    const newSet = new Set(enabledSet);
    if (newSet.has(code)) {
      newSet.delete(code);
    } else {
      newSet.add(code);
    }
    setEnabledSet(newSet);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await adminFetch(`${API_BASE}/admin/locales`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: Array.from(enabledSet) }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Error(data.detail || t("adminLocalesSaveError"));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminLocalesSaveError"));
    } finally {
      setSaving(false);
    }
  };

  if (!canManageUsers) {
    return <div className={`rounded-[32px] p-8 text-sm ${shellClass} ${mutedClass}`}>{t("adminLocalesUnauthorized")}</div>;
  }

  return (
    <div className="space-y-6">
      <section className={`rounded-[32px] p-6 sm:p-8 ${theme === "light" ? "border border-slate-200 bg-[linear-gradient(145deg,#ffffff,#eef6ff)] text-slate-950 shadow-[0_20px_60px_rgba(148,163,184,0.16)]" : "border border-white/10 bg-[linear-gradient(160deg,rgba(7,20,38,0.95),rgba(10,30,48,0.9),rgba(10,18,34,0.96))]"}`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === "light" ? "text-sky-700" : "text-cyan-200"}`}>{t("adminLocalesEyebrow")}</p>
        <h1 className={`mt-4 text-3xl font-bold ${theme === "light" ? "text-slate-950" : "text-white"}`}>{t("adminLocalesTitle")}</h1>
        <p className={`mt-4 max-w-3xl text-sm leading-7 ${mutedClass}`}>{t("adminLocalesDesc")}</p>
      </section>

      {error ? <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      {loading ? (
        <div className={`rounded-[32px] p-8 text-center text-sm ${shellClass} ${mutedClass}`}>{t("adminLocalesLoading")}</div>
      ) : (
        <>
          <section className={`rounded-[30px] p-5 ${shellClass}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-semibold ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                  {t("adminLocalesEnabledCount", { count: enabledSet.size, total: locales.available.length })}
                </p>
                <p className={`mt-1 text-xs ${subtleClass}`}>{t("adminLocalesEnabledHint")}</p>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15 disabled:opacity-60"
              >
                {saving ? t("adminLocalesSaving") : t("adminLocalesSave")}
              </button>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {locales.available.map((locale) => {
              const isEnabled = enabledSet.has(locale.code);
              const langInfo = supportedLanguages.find(l => l.code === locale.code);
              return (
                <div key={locale.code} className={`rounded-[30px] p-5 ${shellClass}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${theme === "light" ? "text-slate-900" : "text-white"}`}>
                          {langInfo?.label || locale.code}
                        </span>
                        <span className={`text-xs font-medium ${theme === "light" ? "text-slate-500" : "text-slate-400"}`}>
                          ({locale.code})
                        </span>
                      </div>
                      <p className={`mt-1 text-xs ${subtleClass}`}>
                        {t("adminLocalesNamespaces", { count: locale.namespaces.length })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleLocale(locale.code)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        isEnabled
                          ? "border border-emerald-300/20 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15"
                          : "border border-slate-300/20 bg-slate-400/10 text-slate-300 hover:bg-slate-400/15"
                      }`}
                    >
                      {isEnabled ? t("adminLocalesEnabled") : t("adminLocalesDisabled")}
                    </button>
                  </div>
                  {locale.namespaces.length > 0 && (
                    <div className={`mt-4 rounded-2xl p-3 ${cardClass}`}>
                      <p className={`text-xs font-semibold ${subtleClass}`}>{t("adminLocalesNamespacesTitle")}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {locale.namespaces.map((ns) => (
                          <span
                            key={ns}
                            className={`rounded-full px-3 py-1.5 text-xs ${
                              theme === "light"
                                ? "bg-white text-slate-700"
                                : "bg-white/5 text-slate-300"
                            }`}
                          >
                            {ns}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <section className={`rounded-[30px] p-5 ${shellClass}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${theme === "light" ? "text-amber-700" : "text-amber-200"}`}>{t("adminLocalesNotesEyebrow")}</p>
            <ul className={`mt-3 space-y-2 text-sm leading-7 ${mutedClass}`}>
              <li>{t("adminLocalesNote1")}</li>
              <li>{t("adminLocalesNote2")}</li>
              <li>{t("adminLocalesNote3")}</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
};

export default AdminLocalesPage;
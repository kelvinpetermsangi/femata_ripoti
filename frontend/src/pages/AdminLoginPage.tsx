import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getAdminSession, loginAdmin } from "../lib/adminAuth";
import { collectClientContext } from "../lib/clientContext";
import { changeAppLanguage, resolveAdminLanguage } from "../i18n";

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const routeState = (location.state as { from?: string } | null) ?? null;
  const redirectPath = useMemo(() => routeState?.from || "/dashboard", [routeState?.from]);
  const requestedLanguage = searchParams.get("lang");
  const currentLanguage = i18n.resolvedLanguage || i18n.language || "sw";
  const targetLanguage = useMemo(() => resolveAdminLanguage(requestedLanguage, currentLanguage), [currentLanguage, requestedLanguage]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [languageReady, setLanguageReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const applyLanguage = async () => {
      if (targetLanguage !== currentLanguage) {
        await changeAppLanguage(targetLanguage);
      }
      if (active) setLanguageReady(true);
    };
    void applyLanguage();
    return () => {
      active = false;
    };
  }, [currentLanguage, targetLanguage]);

  useEffect(() => {
    if (!languageReady) return;
    let active = true;

    const verify = async () => {
      try {
        await getAdminSession();
        if (active) navigate(redirectPath, { replace: true });
      } catch {
        if (active) setCheckingSession(false);
      }
    };

    void verify();
    return () => {
      active = false;
    };
  }, [languageReady, navigate, redirectPath]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await loginAdmin(username.trim(), password, collectClientContext());
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminLoginSignInError"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!languageReady || checkingSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-10 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
            <p className="mt-6 text-lg font-semibold">{t("adminLoginCheckingSession")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_26%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.16),transparent_24%)]" />
        <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10">
          <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.1fr)_420px] lg:items-center">
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-md sm:p-8">
              <div className="flex items-center gap-4">
                <img src="/femata-logo.jpeg" alt="FEMATA" className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">{t("adminLoginEyebrow")}</p>
                  <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">{t("adminLoginTitle")}</h1>
                </div>
              </div>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                {t("adminLoginDesc")}
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">{t("adminLoginCard1Title")}</p>
                  <p className="mt-2 text-sm text-slate-300">{t("adminLoginCard1Body")}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">{t("adminLoginCard2Title")}</p>
                  <p className="mt-2 text-sm text-slate-300">{t("adminLoginCard2Body")}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">{t("adminLoginCard3Title")}</p>
                  <p className="mt-2 text-sm text-slate-300">{t("adminLoginCard3Body")}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-slate-950/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">{t("adminLoginFormEyebrow")}</p>
              <h2 className="mt-3 text-2xl font-bold text-white">{t("adminLoginFormTitle")}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{t("adminLoginFormDesc")}</p>

              <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-5">
                <div>
                  <label htmlFor="admin-username" className="mb-2 block text-sm font-semibold text-white">{t("adminLoginUsername")}</label>
                  <input
                    id="admin-username"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                    placeholder={t("adminLoginUsernamePlaceholder")}
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label htmlFor="admin-password" className="mb-2 block text-sm font-semibold text-white">{t("adminLoginPassword")}</label>
                  <div className="relative">
                    <input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pr-20 text-sm text-white outline-none placeholder:text-slate-500"
                      placeholder={t("adminLoginPasswordPlaceholder")}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                      aria-label={showPassword ? t("hidePassword", "Hide password") : t("showPassword", "Show password")}
                    >
                      {showPassword ? t("hide", "Hide") : t("show", "Show")}
                    </button>
                  </div>
                </div>

                {error ? <div className="rounded-3xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100">{error}</div> : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-70"
                  >
                    {submitting ? t("adminLoginSigningIn") : t("adminLoginSignIn")}
                  </button>
                  <Link
                    to="/"
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    {t("adminLoginBackHome")}
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;

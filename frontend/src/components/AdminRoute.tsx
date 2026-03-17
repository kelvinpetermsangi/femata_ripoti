import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { getAdminSession } from "../lib/adminAuth";
import { changeAppLanguage, resolveAdminLanguage } from "../i18n";

const AdminRoute = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<"checking" | "allowed" | "denied" | "error">("checking");
  const [languageReady, setLanguageReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const requestedLanguage = searchParams.get("lang");
  const currentLanguage = i18n.resolvedLanguage || i18n.language || "sw";
  const targetLanguage = resolveAdminLanguage(requestedLanguage, currentLanguage);

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
      setStatus("checking");
      setError("");
      try {
        await getAdminSession();
        if (active) setStatus("allowed");
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : t("adminRouteVerifyError");
        const lowerMessage = message.toLowerCase();
        if (lowerMessage.includes("required") || lowerMessage.includes("invalid") || lowerMessage.includes("expired") || lowerMessage.includes("inactive")) {
          setStatus("denied");
          return;
        }
        setError(message);
        setStatus("error");
      }
    };

    void verify();
    return () => {
      active = false;
    };
  }, [attempt, languageReady, t]);

  if (!languageReady || status === "checking") {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-10 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-amber-300/30 border-t-amber-300" />
            <p className="mt-6 text-lg font-semibold">{t("adminRouteCheckingAccess")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
          <div className="rounded-[32px] border border-rose-400/20 bg-rose-500/10 p-8 text-center">
            <p className="text-lg font-semibold">{error || t("adminRouteVerifyError")}</p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="mt-6 inline-flex rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              {t("adminRouteRetry")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return <Navigate to="/admin/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  }

  return <Outlet />;
};

export default AdminRoute;

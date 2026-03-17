import enSharedAdmin from "./shared/en/admin.json";
import swSharedAdmin from "./shared/sw/admin.json";
import frSharedAdmin from "./shared/fr/admin.json";
import zhSharedAdmin from "./shared/zh/admin.json";
import hiSharedAdmin from "./shared/hi/admin.json";
import bnSharedAdmin from "./shared/bn/admin.json";

export const adminTranslations: Record<string, Record<string, string>> = {
  en: enSharedAdmin,
  sw: swSharedAdmin,
  fr: frSharedAdmin,
  zh: zhSharedAdmin,
  hi: hiSharedAdmin,
  bn: bnSharedAdmin,
  ar: {
    adminLoginCheckingSession: "يتم التحقق من جلسة المسؤول الآمنة...",
    adminRouteCheckingAccess: "يتم التحقق من صلاحية وصول المسؤول...",
    adminRouteVerifyError: "تعذر التحقق من صلاحية وصول المسؤول.",
    adminRouteRetry: "إعادة المحاولة",
    adminLoginSignInError: "تعذر تسجيل الدخول.",
  },
  de: {
    adminLoginCheckingSession: "Sichere Admin-Sitzung wird geprueft...",
    adminRouteCheckingAccess: "Admin-Zugriff wird geprueft...",
    adminRouteVerifyError: "Der Admin-Zugriff konnte nicht geprueft werden.",
    adminRouteRetry: "Erneut versuchen",
    adminLoginSignInError: "Anmeldung fehlgeschlagen.",
  },
  am: {
    adminLoginCheckingSession: "የተጠበቀ የአስተዳዳሪ ክፍለ ጊዜ በመረጋገጥ ላይ...",
    adminRouteCheckingAccess: "የአስተዳዳሪ መዳረሻ በመረጋገጥ ላይ...",
    adminRouteVerifyError: "የአስተዳዳሪ መዳረሻን ማረጋገጥ አልተቻለም።",
    adminRouteRetry: "እንደገና ይሞክሩ",
    adminLoginSignInError: "መግባት አልተቻለም።",
  },
  ko: {
    adminLoginCheckingSession: "보안 관리자 세션을 확인하는 중입니다...",
    adminRouteCheckingAccess: "관리자 접근 권한을 확인하는 중입니다...",
    adminRouteVerifyError: "관리자 접근 권한을 확인할 수 없습니다.",
    adminRouteRetry: "다시 시도",
    adminLoginSignInError: "로그인할 수 없습니다.",
  },
  th: {
    adminLoginCheckingSession: "กำลังตรวจสอบเซสชันผู้ดูแลระบบที่ปลอดภัย...",
    adminRouteCheckingAccess: "กำลังตรวจสอบสิทธิ์การเข้าถึงของผู้ดูแลระบบ...",
    adminRouteVerifyError: "ไม่สามารถตรวจสอบสิทธิ์ผู้ดูแลระบบได้",
    adminRouteRetry: "ลองอีกครั้ง",
    adminLoginSignInError: "ไม่สามารถเข้าสู่ระบบได้",
  },
};

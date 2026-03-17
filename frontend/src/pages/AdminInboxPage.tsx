import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import AnimatedSelect, { type AnimatedSelectOption } from "../components/AnimatedSelect";
import { useAdminLayoutContext } from "../components/adminLayoutContext";
import { normalizeLocation, regionMunicipalityMap, regions } from "../data/tanzaniaLocations";
import { API_BASE } from "../lib/apiBase";
import { adminFetch, type AdminRole, type AdminUser } from "../lib/adminAuth";
import { formatAdminTimestamp, translateAdminRole } from "../lib/adminI18n";
import { readFileAsDataUrl } from "../lib/fileDataUrl";

type Attachment = { id?: string; name: string; content_type?: string; size_bytes?: number; url?: string; data_url?: string };
type Message = { message_id: string; sender_user_id: string; recipient_user_id: string; subject: string; message_text: string; attachments: Attachment[]; created_at: string; edited_at?: string | null; related_notification_id?: string | null; delivery_state?: "sent" | "delivered" | "read" };
type Thread = { thread_key: string; partner: AdminUser; last_message: Message; unread_count: number };
type ThreadDetail = { thread_key: string; partner: AdminUser; messages: Message[] };
type NotificationItem = { notification_id: string; title: string; body: string; created_at: string; read_at?: string | null; responded_at?: string | null; notification_type: string; sender?: AdminUser | null };
type ReplyContext = { notificationId: string; subject: string; recipientUserId: string; title: string };

const stamp = (value: string | null | undefined, language: string, t: ReturnType<typeof useTranslation>["t"]) => formatAdminTimestamp(value, language, t);
const stateGlyph = (state: "sent" | "delivered" | "read", light: boolean) => state === "sent"
  ? <svg viewBox="0 0 16 16" className={`h-4 w-4 ${light ? "text-slate-500" : "text-slate-300"}`} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 8.5l2.1 2.1L12 4.8" /></svg>
  : <svg viewBox="0 0 18 16" className={`h-4 w-4 ${state === "read" ? "text-emerald-500" : light ? "text-slate-500" : "text-slate-300"}`} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1.8 8.5l2.1 2.1L9.8 4.8" /><path d="M7.2 8.5l2.1 2.1 6-5.8" /></svg>;

const AdminInboxPage = () => {
  const { session, refreshNotifications, theme } = useAdminLayoutContext();
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || "sw";
  const threadScrollRef = useRef<HTMLDivElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [directory, setDirectory] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageText, setMessageText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [notifyRecipientUserId, setNotifyRecipientUserId] = useState("");
  const [regionValue, setRegionValue] = useState("");
  const [regionQuery, setRegionQuery] = useState("");
  const [municipalityValue, setMunicipalityValue] = useState("all");
  const [municipalityQuery, setMunicipalityQuery] = useState("");
  const [roleValue, setRoleValue] = useState("all");
  const [personSearch, setPersonSearch] = useState("");
  const [visiblePeople, setVisiblePeople] = useState(8);
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null);
  const [editingId, setEditingId] = useState("");
  const [editingSubject, setEditingSubject] = useState("");
  const [editingText, setEditingText] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const activeTab = searchParams.get("tab") === "notifications" ? "notifications" : "messages";
  const composeUserId = searchParams.get("compose") || "";
  const light = theme === "light";
  const roleOptions: AnimatedSelectOption[] = [
    { value: "all", label: t("adminInboxRoleAll"), note: t("adminInboxRoleAllNote") },
    { value: "super_admin", label: t("adminInboxRoleSuperAdmin") },
    { value: "case_manager", label: t("adminInboxRoleCaseManager") },
    { value: "reviewer", label: t("adminInboxRoleReviewer") },
    { value: "analyst", label: t("adminInboxRoleAnalyst") },
  ];
  const shellClass = light ? "border border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(148,163,184,0.14)]" : "border border-white/10 bg-white/5 backdrop-blur-md";
  const mutedClass = light ? "text-slate-600" : "text-slate-300";
  const subtleClass = light ? "text-slate-500" : "text-slate-400";
  const inputClass = light ? "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400" : "w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500";
  const softButtonClass = light ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100" : "border border-white/10 bg-white/5 text-white hover:bg-white/10";

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [threadsRes, notificationsRes, directoryRes] = await Promise.all([adminFetch(`${API_BASE}/admin/messages/threads`), adminFetch(`${API_BASE}/admin/notifications`), adminFetch(`${API_BASE}/admin/directory`)]);
      if (threadsRes.ok) setThreads((await threadsRes.json()) as Thread[]);
      if (notificationsRes.ok) setNotifications((await notificationsRes.json()) as NotificationItem[]);
      if (directoryRes.ok) setDirectory(((await directoryRes.json()) as AdminUser[]).filter((item) => item.user_id !== session.user.user_id));
      await refreshNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminInboxLoadError"));
    } finally {
      setLoading(false);
    }
  }, [refreshNotifications, session.user.user_id, t]);

  const loadThread = useCallback(async (userId: string) => {
    const response = await adminFetch(`${API_BASE}/admin/messages/thread/${userId}`);
    if (response.ok) {
      setThread((await response.json()) as ThreadDetail);
      await refreshNotifications();
    }
  }, [refreshNotifications]);

  useEffect(() => { void loadAll(); }, [loadAll]);
  useEffect(() => { const next = composeUserId || selectedUserId || threads[0]?.partner.user_id || ""; if (next) setSelectedUserId(next); }, [composeUserId, selectedUserId, threads]);
  useEffect(() => { if (selectedUserId && activeTab === "messages") void loadThread(selectedUserId); }, [activeTab, selectedUserId, loadThread]);
  useEffect(() => { setVisiblePeople(8); }, [municipalityValue, personSearch, regionValue, roleValue]);
  useEffect(() => {
    const node = threadScrollRef.current;
    if (!node || activeTab !== "messages") return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [activeTab, selectedUserId, sending, thread?.messages.length]);

  const regionOptions = useMemo(() => [...new Set([...regions, ...directory.flatMap((item) => item.assigned_regions)].filter((value) => value && value !== "All regions"))].sort((a, b) => a.localeCompare(b)), [directory]);
  const regionSuggestions = useMemo(() => !regionQuery.trim() ? [] : regionOptions.filter((item) => normalizeLocation(item).includes(normalizeLocation(regionQuery))), [regionOptions, regionQuery]);
  const municipalityOptions = useMemo(() => regionValue ? [...(regionMunicipalityMap[regionValue] || [])].sort((a, b) => a.localeCompare(b)) : [], [regionValue]);
  const municipalitySuggestions = useMemo(() => !municipalityQuery.trim() ? [] : municipalityOptions.filter((item) => normalizeLocation(item).includes(normalizeLocation(municipalityQuery))), [municipalityOptions, municipalityQuery]);
  const shouldRevealPeople = Boolean(regionValue || municipalityValue !== "all" || roleValue !== "all" || personSearch.trim());

  const filteredDirectory = useMemo(() => {
    const query = normalizeLocation(personSearch);
    return directory.filter((user) => {
      const globalAccess = user.roles.includes("super_admin") || user.roles.includes("analyst") || user.assigned_regions.includes("All regions");
      if (regionValue && !globalAccess && !user.assigned_regions.includes(regionValue)) return false;
      if (municipalityValue !== "all") {
        const scoped = (user.coverage_assignments || []).filter((item) => item.region === regionValue).map((item) => item.municipality).filter((item): item is string => Boolean(item));
        if (scoped.length && !scoped.includes(municipalityValue)) return false;
      }
      if (roleValue !== "all" && !user.roles.includes(roleValue as AdminRole)) return false;
      if (!query) return true;
      const haystack = [user.display_name, user.full_name, user.username, user.email, user.mobile_number, user.role_title, ...user.roles, ...user.assigned_regions, ...(user.assigned_municipalities || [])].filter(Boolean).join(" ");
      return normalizeLocation(haystack).includes(query);
    });
  }, [directory, municipalityValue, personSearch, regionValue, roleValue]);

  const visibleMatches = useMemo(() => filteredDirectory.slice(0, visiblePeople), [filteredDirectory, visiblePeople]);
  const notificationRecipientOptions = useMemo<AnimatedSelectOption[]>(
    () => [{ value: "", label: t("adminInboxAllAdministrators"), note: t("adminInboxAllAdministratorsNote") }, ...directory.map((user) => ({ value: user.user_id, label: user.display_name || user.username, note: `${user.roles.map((role) => translateAdminRole(t, role)).join(", ")}${user.assigned_regions.length ? ` | ${user.assigned_regions.join(", ")}` : ""}` }))],
    [directory, t],
  );

  const resetComposer = () => { setMessageSubject(""); setMessageText(""); setAttachments([]); setReplyContext(null); };
  const beginEdit = (item: Message) => { setEditingId(item.message_id); setEditingSubject(item.subject || ""); setEditingText(item.message_text || ""); };
  const cancelEdit = () => { setEditingId(""); setEditingSubject(""); setEditingText(""); };
  const addAttachments = async (files: FileList | null) => {
    if (!files?.length) return;
    const next = await Promise.all(Array.from(files).map((file) => readFileAsDataUrl(file)));
    setAttachments((current) => [...current, ...next.map((item) => ({ name: item.name, content_type: item.type, size_bytes: item.size, data_url: item.dataUrl }))]);
  };

  const sendMessage = async () => {
    const recipientId = replyContext?.recipientUserId || selectedUserId;
    if (!recipientId) return setError(t("adminInboxChooseAdminFirst"));
    setSending(true); setError("");
    try {
      const response = await adminFetch(`${API_BASE}/admin/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient_user_id: recipientId, subject: replyContext?.subject || messageSubject, message: messageText, attachments, related_notification_id: replyContext?.notificationId || undefined }) });
      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) throw new Error(data.detail || t("adminInboxSendError"));
      resetComposer(); await loadAll(); await loadThread(recipientId);
    } catch (err) { setError(err instanceof Error ? err.message : t("adminInboxSendError")); }
    finally { setSending(false); }
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true); setError("");
    try {
      const response = await adminFetch(`${API_BASE}/admin/messages/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: editingSubject, message: editingText }) });
      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) throw new Error(data.detail || t("adminInboxEditError"));
      cancelEdit(); await loadAll(); if (selectedUserId) await loadThread(selectedUserId);
    } catch (err) { setError(err instanceof Error ? err.message : t("adminInboxEditError")); }
    finally { setSavingEdit(false); }
  };

  const openNotification = async (notification: NotificationItem) => { await adminFetch(`${API_BASE}/admin/notifications/${notification.notification_id}/read`, { method: "POST" }); await loadAll(); };
  const replyToNotification = async (notification: NotificationItem) => {
    if (!notification.sender?.user_id) return;
      const subject = `RE: ${notification.title}`;
    setSelectedUserId(notification.sender.user_id);
    setReplyContext({ notificationId: notification.notification_id, subject, recipientUserId: notification.sender.user_id, title: notification.title });
    setMessageSubject(subject);
    setMessageText("");
    setAttachments([]);
    setSearchParams({ tab: "messages", compose: notification.sender.user_id });
    await openNotification(notification);
  };

  const sendNotification = async () => {
    setSendingNotification(true); setError("");
    try {
      const response = await adminFetch(`${API_BASE}/admin/notifications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: notifyTitle, body: notifyBody, recipient_user_id: notifyRecipientUserId || undefined, notification_type: "admin_alert" }) });
      const data = (await response.json().catch(() => ({}))) as { detail?: string };
      if (!response.ok) throw new Error(data.detail || t("adminInboxNotificationSendError"));
      setNotifyTitle(""); setNotifyBody(""); setNotifyRecipientUserId(""); await loadAll();
    } catch (err) { setError(err instanceof Error ? err.message : t("adminInboxNotificationSendError")); }
    finally { setSendingNotification(false); }
  };

  const handleAttachmentAction = async (attachment: Attachment, mode: "open" | "download") => {
    if (!attachment.url) return;
    const nextBusy = `${mode}-${attachment.id || attachment.name}`; setBusyKey(nextBusy); setError("");
    const popup = mode === "open" ? window.open("", "_blank", "noopener,noreferrer") : null;
    if (popup) popup.document.body.innerHTML = `<p style="font-family:sans-serif;padding:24px">${t("adminInboxOpeningAttachment")}</p>`;
    try {
      const response = await adminFetch(attachment.url.startsWith("http") ? attachment.url : `${API_BASE}${attachment.url}`);
      if (!response.ok) throw new Error(t("adminInboxOpenAttachmentError"));
      const objectUrl = URL.createObjectURL(await response.blob());
      if (mode === "open") {
        if (popup) popup.location.href = objectUrl; else window.open(objectUrl, "_blank", "noopener,noreferrer");
      } else {
        const link = document.createElement("a");
        link.href = objectUrl; link.download = attachment.name || "download"; document.body.appendChild(link); link.click(); link.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      if (popup) popup.close();
      setError(err instanceof Error ? err.message : t("adminInboxOpenAttachmentError"));
    } finally { setBusyKey(""); }
  };

  return (
    <div className="space-y-6">
      <section className={`rounded-[32px] p-6 ${shellClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${light ? "text-sky-700" : "text-cyan-200"}`}>{t("adminInboxEyebrow")}</p>
            <h1 className={`mt-3 text-3xl font-bold ${light ? "text-slate-950" : "text-white"}`}>{t("adminInboxTitle")}</h1>
            <p className={`mt-3 max-w-3xl text-sm leading-7 ${mutedClass}`}>{t("adminInboxDesc")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSearchParams({ tab: "messages" })} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "messages" ? "bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 text-slate-950" : light ? "border border-slate-200 bg-white text-slate-700" : "border border-white/10 bg-white/5 text-white"}`}>{t("adminInboxTabMessages")}</button>
            <button type="button" onClick={() => setSearchParams({ tab: "notifications" })} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "notifications" ? "bg-gradient-to-r from-cyan-300 via-sky-400 to-emerald-300 text-slate-950" : light ? "border border-slate-200 bg-white text-slate-700" : "border border-white/10 bg-white/5 text-white"}`}>{t("adminInboxTabNotifications")}</button>
          </div>
        </div>
        {error ? <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      </section>

      {activeTab === "notifications" ? (
        <section className="space-y-4">
          {session.permissions.includes("manage_notifications") ? (
            <div className={`rounded-[28px] p-5 ${light ? "border border-slate-200 bg-[linear-gradient(145deg,#ffffff,#eef6ff)]" : "border border-cyan-300/15 bg-[linear-gradient(160deg,rgba(7,20,38,0.95),rgba(10,30,48,0.9),rgba(10,18,34,0.96))]"}`}>
              <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${light ? "text-sky-700" : "text-cyan-200"}`}>{t("adminInboxNotificationEyebrow")}</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                <AnimatedSelect value={notifyRecipientUserId} onChange={setNotifyRecipientUserId} options={notificationRecipientOptions} placeholder={t("adminInboxNotificationRecipientPlaceholder")} lightMode={light} />
                <div className="space-y-3">
                  <input value={notifyTitle} onChange={(event) => setNotifyTitle(event.target.value)} placeholder={t("adminInboxNotificationTitlePlaceholder")} className={inputClass} />
                  <textarea value={notifyBody} onChange={(event) => setNotifyBody(event.target.value)} rows={4} placeholder={t("adminInboxNotificationBodyPlaceholder")} className={`${inputClass} min-h-[120px] resize-y`} />
                  <button type="button" disabled={sendingNotification || !directory.length} onClick={() => void sendNotification()} className="rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">{sendingNotification ? t("adminInboxSendingNotification") : t("adminInboxSendNotification")}</button>
                </div>
              </div>
            </div>
          ) : null}

          {notifications.map((notification) => (
            <div key={notification.notification_id} className={`rounded-[28px] p-5 ${shellClass}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${light ? "text-sky-700" : "text-cyan-200"}`}>{notification.notification_type}</p>
                  <h2 className={`mt-2 text-xl font-bold ${light ? "text-slate-950" : "text-white"}`}>{notification.title}</h2>
                  <p className={`mt-3 text-sm leading-7 ${mutedClass}`}>{notification.body}</p>
                  <p className={`mt-3 text-xs ${subtleClass}`}>{stamp(notification.created_at, language, t)}{notification.responded_at ? ` | ${t("adminInboxNotificationResponseSent", { time: stamp(notification.responded_at, language, t) })}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!notification.read_at ? <button type="button" onClick={() => void openNotification(notification)} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100">{t("adminInboxMarkRead")}</button> : null}
                  {notification.sender?.user_id ? <button type="button" onClick={() => void replyToNotification(notification)} className="rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100">{t("adminInboxRespondDirectly")}</button> : null}
                </div>
              </div>
            </div>
          ))}

          {!loading && !notifications.length ? <div className={`rounded-[28px] border border-dashed px-5 py-10 text-center text-sm ${light ? "border-slate-300 text-slate-500" : "border-white/10 text-slate-400"}`}>{t("adminInboxNoNotifications")}</div> : null}
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className={`rounded-[28px] p-5 ${shellClass}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${light ? "text-amber-700" : "text-amber-200"}`}>{t("adminInboxStartConversation")}</p>
                  <p className={`mt-3 text-sm leading-7 ${mutedClass}`}>{t("adminInboxStartConversationBody")}</p>
                </div>
                {regionValue || municipalityValue !== "all" || roleValue !== "all" || personSearch.trim() ? <button type="button" onClick={() => { setRegionValue(""); setRegionQuery(""); setMunicipalityValue("all"); setMunicipalityQuery(""); setRoleValue("all"); setPersonSearch(""); }} className={`rounded-full px-4 py-2 text-xs font-semibold ${softButtonClass}`}>{t("adminInboxReset")}</button> : null}
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-3">
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminInboxStepRegion")}</p>
                  {regionValue ? (
                    <div className={`rounded-[22px] p-4 ${light ? "border border-emerald-300 bg-emerald-50" : "border border-emerald-300/20 bg-emerald-400/10"}`}>
                      <p className={`text-xs uppercase tracking-[0.18em] ${light ? "text-emerald-700" : "text-emerald-200"}`}>{t("adminInboxSelectedRegion")}</p>
                      <p className={`mt-2 text-base font-semibold ${light ? "text-slate-950" : "text-white"}`}>{regionValue}</p>
                      <button type="button" onClick={() => { setRegionValue(""); setRegionQuery(""); setMunicipalityValue("all"); setMunicipalityQuery(""); }} className={`mt-4 rounded-full px-4 py-2 text-sm font-semibold ${softButtonClass}`}>{t("adminInboxChangeRegion")}</button>
                    </div>
                  ) : (
                    <>
                      <input value={regionQuery} onChange={(event) => setRegionQuery(event.target.value)} placeholder={t("adminInboxRegionPlaceholder")} className={inputClass} />
                      {regionQuery.trim() ? <div className={`max-h-64 space-y-2 overflow-y-auto rounded-[24px] p-3 ${light ? "border border-slate-200 bg-white" : "border border-white/10 bg-slate-950/60"}`}>{regionSuggestions.length ? regionSuggestions.map((item) => <button key={item} type="button" onClick={() => { setRegionValue(item); setRegionQuery(item); setMunicipalityValue("all"); setMunicipalityQuery(""); }} className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition ${light ? "bg-slate-50 text-slate-900 hover:bg-slate-100" : "bg-white/5 text-white hover:bg-white/10"}`}>{item}</button>) : <div className={`rounded-2xl border border-dashed px-4 py-5 text-sm ${subtleClass}`}>{t("adminInboxNoRegionMatches")}</div>}</div> : null}
                    </>
                  )}
                </div>

                {regionValue ? <div className="space-y-3"><p className={`text-xs font-semibold uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminInboxStepMunicipality")}</p><button type="button" onClick={() => { setMunicipalityValue("all"); setMunicipalityQuery(""); }} className={`rounded-full px-4 py-2 text-sm font-semibold ${municipalityValue === "all" ? "bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 text-slate-950" : softButtonClass}`}>{t("adminCommonAllMunicipalsInRegion", { region: regionValue })}</button><input value={municipalityQuery} onChange={(event) => setMunicipalityQuery(event.target.value)} placeholder={t("adminInboxMunicipalityPlaceholder", { region: regionValue })} className={inputClass} />{municipalityQuery.trim() ? <div className={`max-h-64 space-y-2 overflow-y-auto rounded-[24px] p-3 ${light ? "border border-slate-200 bg-white" : "border border-white/10 bg-slate-950/60"}`}>{municipalitySuggestions.length ? municipalitySuggestions.map((item) => <button key={item} type="button" onClick={() => { setMunicipalityValue(item); setMunicipalityQuery(item); }} className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition ${light ? "bg-slate-50 text-slate-900 hover:bg-slate-100" : "bg-white/5 text-white hover:bg-white/10"}`}>{item}</button>) : <div className={`rounded-2xl border border-dashed px-4 py-5 text-sm ${subtleClass}`}>{t("adminInboxNoMunicipalityMatches")}</div>}</div> : null}</div> : null}
                <div className="space-y-3"><p className={`text-xs font-semibold uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminInboxStepRole")}</p><AnimatedSelect value={roleValue} onChange={setRoleValue} options={roleOptions} placeholder={t("adminInboxRolePlaceholder")} lightMode={light} /></div>
                <div className="space-y-3"><p className={`text-xs font-semibold uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminInboxStepPerson")}</p><input value={personSearch} onChange={(event) => setPersonSearch(event.target.value)} placeholder={t("adminInboxPersonPlaceholder")} className={inputClass} /></div>
              </div>

              <div className="mt-5 space-y-3">
                {shouldRevealPeople ? (
                  <>
                    <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminInboxMatchCount", { count: filteredDirectory.length })}</p>
                    {visibleMatches.length ? visibleMatches.map((user) => <button key={user.user_id} type="button" onClick={() => setSelectedUserId(user.user_id)} className={`w-full rounded-[22px] border p-4 text-left transition ${selectedUserId === user.user_id ? "border-cyan-300/20 bg-cyan-400/10" : light ? "border-slate-200 bg-white hover:bg-slate-100" : "border-white/10 bg-slate-950/45 hover:bg-white/10"}`}><div className="flex items-start justify-between gap-3"><div><p className={`text-sm font-semibold ${light ? "text-slate-950" : "text-white"}`}>{user.display_name || user.username}</p><p className={`mt-1 text-xs ${subtleClass}`}>{user.role_title || user.username}</p></div><span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${light ? "border border-slate-200 bg-slate-100 text-slate-700" : "border border-white/10 bg-white/5 text-slate-200"}`}>{user.roles.map((role) => translateAdminRole(t, role)).join(", ")}</span></div><p className={`mt-3 text-sm ${mutedClass}`}>{user.assigned_regions.length ? user.assigned_regions.join(", ") : user.roles.includes("analyst") || user.roles.includes("super_admin") ? t("adminInboxCrossRegionCoverage") : t("adminInboxNoRegionAssignment")}</p></button>) : <div className={`rounded-2xl border border-dashed px-4 py-6 text-sm ${light ? "border-slate-300 text-slate-500" : "border-white/10 text-slate-400"}`}>{t("adminInboxNoDirectoryMatches")}</div>}
                    {filteredDirectory.length > visibleMatches.length ? <button type="button" onClick={() => setVisiblePeople((current) => current + 8)} className={`w-full rounded-full px-4 py-3 text-sm font-semibold ${softButtonClass}`}>{t("adminInboxShowMorePeople")}</button> : null}
                  </>
                ) : <div className={`rounded-2xl border border-dashed px-4 py-6 text-sm ${light ? "border-slate-300 text-slate-500" : "border-white/10 text-slate-400"}`}>{t("adminInboxDirectoryHint")}</div>}
              </div>
            </div>

            <div className={`rounded-[28px] p-5 ${shellClass}`}>
              <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${light ? "text-sky-700" : "text-cyan-200"}`}>{t("adminInboxRecentThreads")}</p>
              <div className="mt-4 space-y-3">{threads.map((item) => <button key={item.thread_key} type="button" onClick={() => setSelectedUserId(item.partner.user_id)} className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedUserId === item.partner.user_id ? "border-cyan-300/20 bg-cyan-400/10" : light ? "border-slate-200 bg-white hover:bg-slate-100" : "border-white/10 bg-slate-950/45 hover:bg-white/10"}`}><div className="flex items-center justify-between gap-3"><p className={`text-sm font-semibold ${light ? "text-slate-950" : "text-white"}`}>{item.partner.display_name || item.partner.username}</p>{item.unread_count ? <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-0.5 text-[11px] font-bold text-amber-100">{item.unread_count}</span> : null}</div><div className="mt-2 flex items-center gap-2">{stateGlyph(item.last_message.delivery_state || "sent", light)}<p className={`text-sm ${mutedClass}`}>{item.last_message.subject ? `${item.last_message.subject}: ` : ""}{item.last_message.message_text || t("adminInboxAttachmentOnly")}</p></div></button>)}{!threads.length ? <div className={`rounded-2xl border border-dashed px-4 py-6 text-sm ${light ? "border-slate-300 text-slate-500" : "border-white/10 text-slate-400"}`}>{t("adminInboxNoThreads")}</div> : null}</div>
            </div>
          </div>

          <div className={`rounded-[32px] p-4 sm:p-6 ${shellClass}`}>
            {selectedUserId && thread ? (
              <div className="flex min-h-[640px] flex-col">
                <div className={`flex flex-wrap items-center justify-between gap-4 border-b pb-4 ${light ? "border-slate-200" : "border-white/10"}`}><div><p className={`text-lg font-semibold ${light ? "text-slate-950" : "text-white"}`}>{thread.partner.display_name || thread.partner.username}</p><p className={`mt-1 text-sm ${mutedClass}`}>{thread.partner.assigned_regions.length ? thread.partner.assigned_regions.join(", ") : t("adminInboxNoRegionAssignment")}</p></div><div className="flex flex-wrap gap-2">{thread.partner.roles.map((role) => <span key={`${thread.partner.user_id}-${role}`} className={`rounded-full px-3 py-1 text-xs font-semibold ${light ? "border border-slate-200 bg-slate-100 text-slate-700" : "border border-white/10 bg-white/5 text-slate-200"}`}>{translateAdminRole(t, role)}</span>)}</div></div>
                {replyContext ? <div className={`mt-5 rounded-[24px] p-4 ${light ? "border border-amber-200 bg-amber-50" : "border border-amber-300/20 bg-amber-400/10"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className={`text-xs font-semibold uppercase tracking-[0.18em] ${light ? "text-amber-800" : "text-amber-100"}`}>{t("adminInboxNotificationResponseMode")}</p><p className={`mt-2 text-sm ${light ? "text-slate-800" : "text-white"}`}>{t("adminInboxNotificationResponseBody", { title: replyContext.title })}</p></div><button type="button" onClick={() => setReplyContext(null)} className={`rounded-full px-4 py-2 text-sm font-semibold ${softButtonClass}`}>{t("adminInboxCancelReply")}</button></div></div> : null}
                <div ref={threadScrollRef} className={`mt-5 h-[min(52vh,520px)] min-h-[320px] space-y-3 overflow-y-auto pr-1 ${light ? "text-slate-900" : ""}`}>{thread.messages.map((item) => { const own = item.sender_user_id === session.user.user_id; const editing = editingId === item.message_id; const subjectLocked = Boolean(item.related_notification_id); return <div key={item.message_id} className={`rounded-[24px] border p-4 ${own ? "border-cyan-300/20 bg-cyan-400/10" : light ? "border-slate-200 bg-white" : "border-white/10 bg-slate-950/45"}`}>{editing ? <div className="space-y-3"><input value={editingSubject} onChange={(event) => setEditingSubject(event.target.value)} disabled={subjectLocked} className={`${inputClass} disabled:opacity-70`} placeholder={t("adminInboxSubject")} /><textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} rows={4} className={`${inputClass} min-h-[120px] resize-y`} /><div className="flex flex-wrap gap-2"><button type="button" disabled={savingEdit} onClick={() => void saveEdit()} className="rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">{savingEdit ? t("adminCasesSaving") : t("adminInboxSaveEdit")}</button><button type="button" onClick={cancelEdit} className={`rounded-full px-4 py-2 text-sm font-semibold ${softButtonClass}`}>{t("adminInboxCancel")}</button></div></div> : <>{item.subject ? <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${light ? "text-sky-700" : "text-cyan-200"}`}>{item.subject}</p> : null}<p className={`mt-2 whitespace-pre-wrap text-sm leading-7 ${light ? "text-slate-900" : "text-white"}`}>{item.message_text || t("adminInboxAttachmentOnly")}</p>{item.attachments.length ? <div className="mt-4 space-y-2">{item.attachments.map((attachment) => { const openKey = `open-${attachment.id || attachment.name}`; const downloadKey = `download-${attachment.id || attachment.name}`; return <div key={`${item.message_id}-${attachment.name}`} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 ${light ? "border border-slate-200 bg-slate-50" : "border border-white/10 bg-white/5"}`}><div><p className={`text-sm font-semibold ${light ? "text-slate-900" : "text-white"}`}>{attachment.name}</p><p className={`mt-1 text-xs ${subtleClass}`}>{attachment.content_type || t("adminInboxAttachmentLabel")}{attachment.size_bytes ? ` | ${(attachment.size_bytes / 1024 / 1024).toFixed(2)} MB` : ""}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busyKey === openKey || busyKey === downloadKey} onClick={() => void handleAttachmentAction(attachment, "open")} className={`rounded-full px-3 py-2 text-xs font-semibold ${softButtonClass}`}>{busyKey === openKey ? t("adminInboxOpening") : t("adminInboxOpen")}</button><button type="button" disabled={busyKey === openKey || busyKey === downloadKey} onClick={() => void handleAttachmentAction(attachment, "download")} className={`rounded-full px-3 py-2 text-xs font-semibold ${softButtonClass}`}>{busyKey === downloadKey ? t("adminInboxPreparing") : t("adminInboxDownload")}</button></div></div>; })}</div> : null}<div className={`mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] ${subtleClass}`}><div className="flex flex-wrap items-center gap-2"><span>{stamp(item.created_at, language, t)}</span>{item.edited_at ? <span>{t("adminInboxEdited")}</span> : null}</div>{own ? <div className="flex items-center gap-2">{stateGlyph(item.delivery_state || "sent", light)}<span>{item.delivery_state === "read" ? t("adminInboxOpened") : item.delivery_state === "delivered" ? t("adminInboxDelivered") : t("adminInboxSent")}</span></div> : null}</div>{own ? <div className="mt-3 flex justify-end"><button type="button" onClick={() => beginEdit(item)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${softButtonClass}`}>{t("adminInboxEditMessage")}</button></div> : null}</>}</div>; })}{!thread.messages.length ? <div className={`rounded-2xl border border-dashed px-4 py-8 text-center text-sm ${light ? "border-slate-300 text-slate-500" : "border-white/10 text-slate-400"}`}>{t("adminInboxNoMessages")}</div> : null}</div>
                <div className={`mt-5 border-t pt-5 ${light ? "border-slate-200" : "border-white/10"}`}><p className={`mb-3 text-xs uppercase tracking-[0.16em] ${subtleClass}`}>{t("adminInboxMessageHistoryHint")}</p><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]"><div className="space-y-3"><input value={replyContext?.subject || messageSubject} onChange={(event) => setMessageSubject(event.target.value)} disabled={Boolean(replyContext)} placeholder={t("adminInboxSubject")} className={`${inputClass} disabled:opacity-70`} />{replyContext ? <p className={`text-xs ${subtleClass}`}>{t("adminInboxSubjectLockedHint")}</p> : null}</div><div className={`rounded-[22px] px-4 py-3 text-sm ${light ? "border border-slate-200 bg-slate-50" : "border border-white/10 bg-slate-950/45"}`}><p className={`text-xs uppercase tracking-[0.16em] ${subtleClass}`}>{t("adminInboxDeliveryGuide")}</p><div className="mt-3 space-y-2"><div className="flex items-center gap-2">{stateGlyph("sent", light)}<span className={mutedClass}>{t("adminInboxSent")}</span></div><div className="flex items-center gap-2">{stateGlyph("delivered", light)}<span className={mutedClass}>{t("adminInboxDelivered")}</span></div><div className="flex items-center gap-2">{stateGlyph("read", light)}<span className={mutedClass}>{t("adminInboxOpened")}</span></div></div></div></div><textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} rows={4} className={`${inputClass} mt-4 min-h-[120px] resize-y`} placeholder={replyContext ? t("adminInboxResponsePlaceholder") : t("adminInboxMessagePlaceholder")} /><div className="mt-4 flex flex-wrap items-center gap-3"><label className={`inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold ${softButtonClass}`}>{t("adminInboxAttachLabel")}<input type="file" multiple className="hidden" onChange={(event) => void addAttachments(event.target.files)} /></label>{attachments.map((attachment, index) => <span key={`${attachment.name}-${index}`} className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">{attachment.name}</span>)}</div><div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={sending} onClick={() => void sendMessage()} className="rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">{sending ? t("adminInboxSending") : t("adminInboxSendMessage")}</button>{(messageText || messageSubject || attachments.length || replyContext) ? <button type="button" onClick={resetComposer} className={`rounded-full px-5 py-3 text-sm font-semibold ${softButtonClass}`}>{t("adminInboxClearComposer")}</button> : null}</div></div>
              </div>
            ) : <div className={`rounded-2xl border border-dashed px-5 py-16 text-center text-sm ${light ? "border-slate-300 text-slate-500" : "border-white/10 text-slate-400"}`}>{directory.length ? t("adminInboxNoConversationSelected") : t("adminInboxNoOtherAdmins")}</div>}
          </div>
        </section>
      )}
    </div>
  );
};

export default AdminInboxPage;

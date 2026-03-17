import { useEffect, useRef, useState, useMemo, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAdminLayoutContext } from "../components/adminLayoutContext";
import { API_BASE } from "../lib/apiBase";
import { adminFetch } from "../lib/adminAuth";

type AgentKey = "michelle" | "melvin";

type TrainingMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  agentKey?: AgentKey;
  agentName?: string;
  kind?: "message" | "handoff";
};

type TrainingChatResponse = {
  reply?: string;
  detail?: string;
  agent_key?: AgentKey;
  agent_name?: string;
  handoff_note?: string | null;
  suggested_prompts?: string[];
};

const agentProfiles: Record<AgentKey, { name: string; role: string; summary: string }> = {
  michelle: {
    name: "Michelle",
    role: "Direct guide",
    summary: "Handles day-to-day operational guidance, quick explanations, and practical next steps inside FEMATA.",
  },
  melvin: {
    name: "Melvin",
    role: "Reasoning specialist",
    summary: "Steps in for deeper comparisons, diagnosis, prioritization, and structured reasoning when a question needs heavier analysis.",
  },
};

const AdminTrainingPage = () => {
  const { theme } = useAdminLayoutContext();
  const { t, i18n } = useTranslation();
  const messagePaneRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const starterMessages = [
    {
      id: "desk-online",
      role: "system" as const,
      kind: "handoff" as const,
      content: t("adminTrainingStarterOnline"),
    },
    {
      id: "intro-michelle",
      role: "assistant" as const,
      agentKey: "michelle" as const,
      agentName: "Michelle",
      content: t("adminTrainingStarterIntro"),
    },
  ];
  const [messages, setMessages] = useState<TrainingMessage[]>(() => starterMessages);
  const [activeAgent, setActiveAgent] = useState<AgentKey>("michelle");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const localizedPrompts = useMemo(
    () => [t("adminTrainingPrompt1"), t("adminTrainingPrompt2"), t("adminTrainingPrompt3"), t("adminTrainingPrompt4"), t("adminTrainingPrompt5")],
    [t],
  );
  const [promptSuggestions, setPromptSuggestions] = useState<string[]>(() => localizedPrompts);
  const agentRoleLabel = (agentKey: AgentKey) => (agentKey === "michelle" ? t("adminTrainingAgentMichelleRole") : t("adminTrainingAgentMelvinRole"));
  const agentSummaryLabel = (agentKey: AgentKey) => (agentKey === "michelle" ? t("adminTrainingAgentMichelleSummary") : t("adminTrainingAgentMelvinSummary"));

  const light = theme === "light";
  const shellClass = light
    ? "border border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(148,163,184,0.14)]"
    : "border border-white/10 bg-white/5 backdrop-blur-md";
  const cardClass = light
    ? "border border-slate-200 bg-[linear-gradient(145deg,#ffffff,#f7fbff)]"
    : "border border-white/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.95),rgba(17,24,39,0.92),rgba(12,18,34,0.98))]";
  const mutedClass = light ? "text-slate-600" : "text-slate-300";
  const subtleClass = light ? "text-slate-500" : "text-slate-400";
  const inputClass = light
    ? "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
    : "w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500";
  const headerSurfaceClass = light ? "border-slate-200/80 bg-white/85" : "border-white/10 bg-slate-950/75";
  const composerSurfaceClass = light ? "border-slate-200/80 bg-white/92" : "border-white/10 bg-slate-950/88";

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const node = messagePaneRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
    setShowJumpToLatest(false);
    nearBottomRef.current = true;
  };

  useEffect(() => {
    const node = messagePaneRef.current;
    if (!node) return undefined;

    const onScroll = () => {
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
      const isNearBottom = distance < 120;
      nearBottomRef.current = isNearBottom;
      setShowJumpToLatest(!isNearBottom);
    };

    onScroll();
    node.addEventListener("scroll", onScroll);
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      const node = messagePaneRef.current;
      if (!node) return;
      if (nearBottomRef.current) {
        scrollToBottom(messages.length <= 2 ? "auto" : "smooth");
      } else {
        const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
        setShowJumpToLatest(distance >= 120);
      }
    });
  }, [messages]);

  useEffect(() => {
    if (!sending || !nearBottomRef.current) return;
    requestAnimationFrame(() => scrollToBottom("smooth"));
  }, [sending]);

  const clearConversation = () => {
    setMessages(starterMessages);
    setActiveAgent("michelle");
    setPromptSuggestions(localizedPrompts);
    setError("");
    requestAnimationFrame(() => scrollToBottom("auto"));
  };

  useEffect(() => {
    setPromptSuggestions((current) => {
      const hasConversation = current.length !== 5 || messages.some((item) => item.role === "user");
      return hasConversation ? current : localizedPrompts;
    });
  }, [localizedPrompts, messages]);

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void sendMessage();
  };

  const sendMessage = async (nextMessage?: string) => {
    const content = (nextMessage ?? input).trim();
    if (!content || sending) return;

    const userMessage: TrainingMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
    };

    nearBottomRef.current = true;
    setShowJumpToLatest(false);
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setSending(true);
    setError("");

    try {
      const response = await adminFetch(`${API_BASE}/admin/training/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          active_agent: activeAgent,
          preferred_language: i18n.resolvedLanguage || i18n.language || "sw",
          client_time_iso: new Date().toISOString(),
          client_timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
          history: [...messages, userMessage]
            .filter((item) => item.role === "user" || item.role === "assistant")
            .slice(-8)
            .map((item) => ({ role: item.role, content: item.content })),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as TrainingChatResponse;
      if (!response.ok) throw new Error(data.detail || t("adminTrainingError"));

      const nextAgent = data.agent_key || activeAgent;
      const nextMessages: TrainingMessage[] = [];

      if (data.handoff_note) {
        nextMessages.push({
          id: `handoff-${Date.now()}`,
          role: "system",
          kind: "handoff",
          content: data.handoff_note,
          agentKey: nextAgent,
        });
      }

      nextMessages.push({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply || t("adminTrainingFallbackReply"),
        agentKey: nextAgent,
        agentName: data.agent_name || agentProfiles[nextAgent].name,
      });

      setActiveAgent(nextAgent);
      setMessages((current) => [...current, ...nextMessages]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminTrainingError"));
    } finally {
      setSending(false);
    }
  };

  const renderMessage = (message: TrainingMessage) => {
    if (message.role === "system") {
      return (
        <div key={message.id} className="flex justify-center">
          <div
            className={`max-w-2xl rounded-full px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] ${
              light ? "border border-slate-200 bg-slate-100 text-slate-600" : "border border-white/10 bg-white/5 text-slate-300"
            }`}
          >
            {message.content}
          </div>
        </div>
      );
    }

    const own = message.role === "user";
    const agentKey = message.agentKey || "michelle";
    const assistantSurface = agentKey === "melvin"
      ? light
        ? "border-amber-200 bg-amber-50/90"
        : "border-amber-300/20 bg-amber-400/10"
      : light
        ? "border-pink-200 bg-white"
        : "border-pink-300/20 bg-[linear-gradient(145deg,rgba(244,114,182,0.14),rgba(15,23,42,0.35))]";

    return (
      <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[88%] rounded-[28px] border px-4 py-3 sm:max-w-[78%] ${
            own
              ? light
                ? "border-sky-200 bg-sky-50 text-slate-950"
                : "border-cyan-300/20 bg-cyan-400/10 text-white"
              : `${assistantSurface} ${light ? "text-slate-950" : "text-white"}`
          } ${own ? "rounded-br-[10px]" : "rounded-bl-[10px]"}`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                own
                  ? light
                    ? "bg-sky-100 text-sky-700"
                    : "bg-cyan-300/15 text-cyan-200"
                  : agentKey === "melvin"
                    ? light
                      ? "bg-amber-100 text-amber-800"
                      : "bg-amber-300/15 text-amber-100"
                    : light
                      ? "bg-pink-100 text-pink-700"
                      : "bg-pink-300/15 text-pink-100"
              }`}
            >
              {own ? t("adminTrainingYou") : message.agentName || agentProfiles[agentKey].name}
            </span>
            {!own ? <span className={`text-[11px] ${subtleClass}`}>{agentRoleLabel(agentKey)}</span> : null}
          </div>
          <p className={`mt-3 whitespace-pre-wrap text-sm leading-7 ${light ? "text-slate-900" : "text-white"}`}>{message.content}</p>
        </div>
      </div>
    );
  };

  const activeAgentProfile = agentProfiles[activeAgent];
  const canSend = Boolean(input.trim()) && !sending;

  return (
    <div className="space-y-4">
      <section
        className={`rounded-[30px] p-5 sm:p-6 ${
          light
            ? "border border-slate-200 bg-[linear-gradient(145deg,#ffffff,#eef6ff)] text-slate-950 shadow-[0_20px_60px_rgba(148,163,184,0.16)]"
            : "border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_26%),radial-gradient(circle_at_top_right,rgba(244,114,182,0.12),transparent_24%),linear-gradient(160deg,rgba(23,37,84,0.98),rgba(17,24,39,0.96),rgba(12,18,34,0.98))] text-white shadow-[0_24px_80px_rgba(2,6,23,0.34)]"
        }`}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${light ? "text-sky-700" : "text-cyan-200"}`}>{t("adminTrainingEyebrow")}</p>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{t("adminTrainingTitle")}</h1>
            <p className={`mt-3 max-w-3xl text-sm leading-7 ${mutedClass}`}>
              {t("adminTrainingDesc")}
            </p>
          </div>

          <div className={`rounded-[24px] px-4 py-3 ${light ? "border border-slate-200 bg-white/80" : "border border-white/10 bg-slate-950/35"}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminTrainingRoomStatus")}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${activeAgent === "michelle" ? (light ? "bg-pink-100 text-pink-700" : "bg-pink-300/15 text-pink-100") : light ? "bg-amber-100 text-amber-800" : "bg-amber-300/15 text-amber-100"}`}>
                {activeAgentProfile.name}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${light ? "bg-emerald-50 text-emerald-700" : "bg-emerald-300/12 text-emerald-100"}`}>
                {t("adminTrainingEncryption")}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {promptSuggestions.slice(0, 5).map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={sending}
              onClick={() => void sendMessage(prompt)}
              className={`w-full rounded-2xl px-4 py-2.5 text-left text-sm font-semibold leading-5 transition sm:w-auto sm:max-w-[360px] ${
                light ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="order-2 grid gap-4 sm:grid-cols-2 xl:order-1 xl:grid-cols-1">
          {(Object.entries(agentProfiles) as Array<[AgentKey, (typeof agentProfiles)[AgentKey]]>).map(([key, profile]) => {
            const active = activeAgent === key;
            return (
              <div
                key={key}
                className={`rounded-[28px] p-5 ${cardClass} ${
                  active ? (light ? "ring-2 ring-sky-200" : "ring-1 ring-cyan-300/30") : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${key === "michelle" ? (light ? "text-pink-700" : "text-pink-200") : light ? "text-amber-700" : "text-amber-200"}`}>{key === "michelle" ? t("adminTrainingAgentMichelleRole") : t("adminTrainingAgentMelvinRole")}</p>
                    <h2 className={`mt-2 text-xl font-bold ${light ? "text-slate-950" : "text-white"}`}>{profile.name}</h2>
                  </div>
                  {active ? (
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${light ? "bg-sky-100 text-sky-700" : "bg-cyan-300/15 text-cyan-200"}`}>
                      {t("adminTrainingActive")}
                    </span>
                  ) : null}
                </div>
                <p className={`mt-3 text-sm leading-7 ${mutedClass}`}>{agentSummaryLabel(key)}</p>
              </div>
            );
          })}

          <div className={`rounded-[28px] p-5 ${cardClass}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${light ? "text-slate-700" : "text-slate-300"}`}>{t("adminTrainingGuardrailTitle")}</p>
            <p className={`mt-3 text-sm leading-7 ${mutedClass}`}>
              {t("adminTrainingGuardrailBody")}
            </p>
          </div>
        </aside>

        <div className={`${shellClass} order-1 min-h-0 overflow-hidden rounded-[34px] xl:order-2`}>
          <div className={`sticky top-0 z-20 border-b px-4 py-4 backdrop-blur-xl sm:px-6 ${headerSurfaceClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${subtleClass}`}>{t("adminTrainingConversationSupport")}</p>
                <h2 className={`mt-1 text-xl font-bold ${light ? "text-slate-950" : "text-white"}`}>{t("adminTrainingTitle")}</h2>
                <p className={`mt-1 text-sm ${mutedClass}`}>{t("adminTrainingLead", { name: activeAgentProfile.name })}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] ${activeAgent === "michelle" ? (light ? "bg-pink-100 text-pink-700" : "bg-pink-300/15 text-pink-100") : light ? "bg-amber-100 text-amber-800" : "bg-amber-300/15 text-amber-100"}`}>
                  {activeAgentProfile.name}
                </span>
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] ${light ? "bg-emerald-50 text-emerald-700" : "bg-emerald-300/12 text-emerald-100"}`}>
                  {t("adminTrainingEncryption")}
                </span>
              </div>
            </div>
          </div>

          <div className="relative flex h-[72svh] min-h-[480px] flex-col sm:h-[min(76vh,760px)] sm:min-h-[620px]">
            <div ref={messagePaneRef} className="admin-shell-scroll flex-1 overflow-y-auto overscroll-y-contain px-4 py-5 pb-36 sm:px-6 sm:pb-40">
              <div className="flex min-h-full flex-col justify-end gap-4">
                {messages.map(renderMessage)}
                {sending ? (
                  <div className="flex justify-start" aria-live="polite">
                    <div className={`max-w-[88%] rounded-[28px] rounded-bl-[10px] border px-4 py-3 sm:max-w-[78%] ${activeAgent === "melvin" ? (light ? "border-amber-200 bg-amber-50 text-slate-950" : "border-amber-300/20 bg-amber-400/10 text-white") : light ? "border-pink-200 bg-white text-slate-950" : "border-pink-300/20 bg-[linear-gradient(145deg,rgba(244,114,182,0.14),rgba(15,23,42,0.35))] text-white"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${activeAgent === "melvin" ? (light ? "bg-amber-100 text-amber-800" : "bg-amber-300/15 text-amber-100") : light ? "bg-pink-100 text-pink-700" : "bg-pink-300/15 text-pink-100"}`}>
                          {activeAgentProfile.name}
                        </span>
                        <span className={`text-[11px] ${subtleClass}`}>{agentRoleLabel(activeAgent)}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          {[0, 1, 2].map((index) => (
                            <span
                              key={`typing-dot-${index}`}
                              className={`h-2.5 w-2.5 rounded-full ${light ? "bg-slate-400" : "bg-white/70"}`}
                              style={{
                                animation: `typingPulse 1.1s ease-in-out ${index * 0.16}s infinite`,
                              }}
                            />
                          ))}
                        </div>
                        <p className={`text-sm leading-7 ${mutedClass}`}>{t("adminTrainingTyping", { name: activeAgentProfile.name })}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {showJumpToLatest ? (
              <button
                type="button"
                onClick={() => scrollToBottom("smooth")}
                className={`absolute bottom-[116px] right-4 z-20 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] shadow-lg sm:right-6 ${
                  light ? "border border-slate-200 bg-white text-slate-700" : "border border-cyan-300/20 bg-slate-950/90 text-cyan-100"
                }`}
              >
                {t("adminTrainingJumpLatest")}
              </button>
            ) : null}

            <div className={`sticky bottom-0 z-20 border-t p-4 backdrop-blur-xl sm:px-6 ${composerSurfaceClass}`}>
              <div className="flex items-end gap-2 sm:gap-3">
                <div className="relative flex-1">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    rows={3}
                    className={`${inputClass} min-h-[88px] max-h-40 resize-none pr-14 sm:min-h-[92px] sm:pr-16`}
                    placeholder={t("adminTrainingPlaceholder")}
                  />
                  <button
                    type="button"
                    disabled={!canSend}
                    onClick={() => void sendMessage()}
                    className={`absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full transition sm:h-10 sm:w-10 ${
                      canSend
                        ? "bg-gradient-to-r from-pink-300 via-rose-300 to-amber-300 text-slate-950 shadow-[0_10px_25px_rgba(244,114,182,0.28)]"
                        : light
                          ? "border border-slate-200 bg-slate-100 text-slate-400"
                          : "border border-white/10 bg-white/5 text-slate-500"
                    }`}
                    aria-label={t("adminTrainingSend")}
                    title={t("adminTrainingSend")}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2L11 13" />
                      <path d="M22 2L15 22 11 13 2 9l20-7z" />
                    </svg>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={clearConversation}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition sm:h-11 sm:w-11 ${
                    light ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                  aria-label={t("adminTrainingClear")}
                  title={t("adminTrainingClear")}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className={`mt-2 text-[11px] uppercase tracking-[0.16em] ${subtleClass}`}>{t("adminTrainingEnterHint")}</p>
              {error ? <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
            </div>
          </div>
        </div>
      </section>
      <style>{`@keyframes typingPulse { 0%, 80%, 100% { transform: scale(0.7); opacity: 0.35; } 40% { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
};

export default AdminTrainingPage;

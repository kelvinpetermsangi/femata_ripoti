import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../i18n';
import { usePublicGuidanceChat, type PublicChatState } from '../lib/publicGuidanceChat';

interface TalkToAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentState?: PublicChatState;
  city?: string;
}

const TalkToAgentModal = ({
  isOpen,
  onClose,
  currentState = 'Chat',
  city,
}: TalkToAgentModalProps) => {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage || i18n.language;
  const {
    messages,
    input,
    setInput,
    isLoading,
    messageContainerRef,
    sendMessage,
    clearConversation,
  } = usePublicGuidanceChat({
    language: currentLanguage,
    city,
    autoStart: isOpen,
    initialState: currentState,
    fallbackWelcome: t('chatWelcomeMessage', 'Habari! Ninaweza kukusaidiaje leo kuhusu masuala ya madini?'),
    fallbackError: t('chatErrorMessage', 'Samahani, kuna hitilafu. Tafadhali jaribu tena baadaye.'),
  });

  const quickPrompts = [
    {
      label: t('chatQuickQuestion1', 'How do I report a safety issue?'),
      topic: 'register complaints',
    },
    {
      label: t('chatQuickQuestion2', 'What information do I need to provide?'),
      topic: 'what information to share',
    },
    {
      label: t('chatQuickQuestion3', 'Is my report anonymous?'),
      topic: 'why the platform is secure',
    },
    {
      label: t('chatQuickQuestion4', 'How long does it take to get a response?'),
      topic: 'what happens after filing',
    },
    {
      label: t('chatQuickQuestion5', 'What do I do with the reference number?'),
      topic: 'reference number guidance',
    },
  ];

  const languageLabel =
    supportedLanguages.find((language) => language.code === currentLanguage)?.label ?? currentLanguage;
  const [faqOpen, setFaqOpen] = useState(false);

  const handleSend = () => {
    if (isLoading || !input.trim()) return;
    const text = input;
    setInput('');
    void sendMessage(text);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousBodyPaddingRight = document.body.style.paddingRight;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const appRoot = document.getElementById('root');
    const previousRootOverflow = appRoot?.style.overflow ?? '';
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    html.style.overflow = 'hidden';
    body.classList.add('femata-popup-open');
    html.classList.add('femata-popup-open');
    if (appRoot) {
      appRoot.style.overflow = 'hidden';
      appRoot.classList.add('femata-popup-scroll-lock');
    }

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      body.style.paddingRight = previousBodyPaddingRight;
      html.style.overflow = previousHtmlOverflow;
      body.classList.remove('femata-popup-open');
      html.classList.remove('femata-popup-open');
      if (appRoot) {
        appRoot.style.overflow = previousRootOverflow;
        appRoot.classList.remove('femata-popup-scroll-lock');
      }
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-slate-950/80 px-2 py-2 backdrop-blur-sm sm:items-center sm:px-4 sm:py-4"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="femata-popup-shell flex h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[22px] border border-cyan-300/20 bg-slate-900 shadow-2xl sm:h-[min(calc(100dvh-2rem),46rem)] sm:rounded-[28px]">
        <div className="shrink-0 border-b border-white/10 px-3 py-3 sm:px-5 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-400 p-1 sm:h-14 sm:w-14">
                  <img src="/femata-logo.jpeg" alt={t('logoAlt')} className="h-full w-full rounded-[14px] object-cover" />
                </div>
                <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-slate-900 bg-emerald-400 shadow-[0_0_20px_rgba(74,222,128,0.6)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white sm:text-2xl">{t('chatModalTitle', 'Talk to FEMATA Agent')}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-300 sm:mt-2">
                  {t('chatModalDesc', 'Ask questions about mining safety, reporting process, or get guidance in your preferred language.')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-slate-300 hover:bg-white/10"
              aria-label={t('close', 'Close')}
            >
              &times;
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 px-3 py-3 sm:px-5 sm:py-4">
          <div
            ref={messageContainerRef}
            className="chat-message-container femata-popup-content h-full overflow-y-auto overscroll-contain pr-1"
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t('chatDisclaimerTitle', 'Important')}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {t('chatDisclaimerText', 'This AI assistant provides general guidance only. For official reporting, please use the report form. Your conversation may be logged for quality improvement.')}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-300/40 bg-emerald-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  {t('chatReferenceReminderTitle', 'Keep your reference number')}
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  {t(
                    'chatReferenceReminderText',
                    'Save the reference number you receive after submitting a report. You can log back in with it to add new information or give updates about safety concerns.',
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  {t('chatQuickQuestionsTitle', 'Quick questions')}
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  {t('chatQuickTipsBody', 'Ask short, specific questions about reporting, tracking, safety, or privacy to get the clearest guidance.')}
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/50 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          message.isUser
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                            : 'bg-white/10 text-slate-200 backdrop-blur-sm'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {!message.isUser && (
                            <div className="mt-1 h-6 w-6 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                          </div>
                          {message.isUser && (
                            <div className="mt-1 h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-2xl bg-white/10 px-4 py-3 text-slate-200 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400" />
                          <div className="flex space-x-1">
                            <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
                            <div
                              className="h-2 w-2 animate-bounce rounded-full bg-cyan-300"
                              style={{ animationDelay: '0.1s' }}
                            />
                            <div
                              className="h-2 w-2 animate-bounce rounded-full bg-cyan-300"
                              style={{ animationDelay: '0.2s' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-slate-900/95 px-3 py-3 sm:px-5 sm:py-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-400">
                {t('chatLanguageLabel', 'Language')}:{' '}
                <span className="font-semibold text-cyan-300">{languageLabel}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-slate-400">
                  {messages.length} {t('chatMessagesLabel', 'messages')}
                </div>
                <button
                  type="button"
                  onClick={() => setFaqOpen((open) => !open)}
                  className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                >
                  {faqOpen ? t('chatHideFaq', 'Hide FAQ') : t('chatShowFaq', 'FAQ')}
                </button>
                <button
                  type="button"
                  onClick={clearConversation}
                  className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
                >
                  {t('clearChat', 'Clear Chat')}
                </button>
              </div>
            </div>

            {faqOpen ? (
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-2">
                <div className="femata-quick-prompts flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-2 lg:overflow-visible lg:pb-0">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt.topic}
                      type="button"
                      onClick={() => {
                        setFaqOpen(false);
                        void sendMessage(prompt.label, prompt.topic);
                      }}
                      className="min-w-[11rem] shrink-0 rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2 text-xs text-cyan-100 transition hover:bg-cyan-400/20 lg:min-w-0"
                    >
                      {prompt.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('chatInputPlaceholder', 'Type your message here...')}
                  disabled={isLoading}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20 disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="shrink-0 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50 sm:px-6"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {t('chatSending', 'Sending...')}
                  </span>
                ) : (
                  t('chatSendButton', 'Send')
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TalkToAgentModal;

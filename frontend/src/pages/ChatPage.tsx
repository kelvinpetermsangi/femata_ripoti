import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { supportedLanguages } from '../i18n';
import { usePublicGuidanceChat } from '../lib/publicGuidanceChat';

const ChatPage = () => {
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
    city: 'Dar es Salaam',
    autoStart: true,
    initialState: 'Chat',
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3">
              <img src="/femata-logo.jpeg" alt={t('logoAlt')} className="h-10 w-10 rounded-xl object-cover ring-1 ring-white/10" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-amber-200">{t('chatBrandName', 'FEMATA')}</p>
                <p className="truncate text-xs text-white/70">{t('headerSubtitle')}</p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              {t('backToHome')}
            </Link>
            <button
              type="button"
              onClick={clearConversation}
              className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
            >
              {t('clearChat')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
            {t('chatPageTitle', 'Talk to FEMATA Agent')}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-7 text-slate-300">
            {t('chatPageDesc', 'Ask questions about mining safety, reporting process, or get guidance in your preferred language.')}
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
              <span className="text-sm font-semibold text-cyan-100">
                {t('chatLanguageLabel', 'Language')}:{' '}
                <span className="text-cyan-300">{languageLabel}</span>
              </span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2">
              <span className="text-sm font-semibold text-amber-100">
                {messages.length} {t('chatMessagesLabel', 'messages')}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <div className="mb-5 flex items-center gap-4">
                <div className="relative">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-400 p-1">
                    <img src="/femata-logo.jpeg" alt={t('logoAlt')} className="h-full w-full rounded-[14px] object-cover" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-slate-900 bg-emerald-400 shadow-[0_0_20px_rgba(74,222,128,0.6)]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{t('chatAssistantTitle', 'FEMATA Agent')}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {t('chatAssistantDesc', 'Available at any time to guide you on mining safety, reporting, and anonymous follow-up.')}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                    {t('chatCapabilitiesTitle', 'What I can help with')}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    <li className="flex items-center gap-2">&bull; {t('chatCapabilityReporting', 'Reporting procedures')}</li>
                    <li className="flex items-center gap-2">&bull; {t('chatCapabilitySafety', 'Safety guidance')}</li>
                    <li className="flex items-center gap-2">&bull; {t('chatCapabilityTracking', 'Tracking your report')}</li>
                    <li className="flex items-center gap-2">&bull; {t('chatCapabilityLanguage', 'Language guidance')}</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                    {t('chatQuickTipsTitle', 'Quick tips')}
                  </p>
                  <p className="mt-3 text-sm text-slate-300">
                    {t('chatQuickTipsBody', 'Ask short, specific questions about reporting, tracking, safety, or privacy to get the clearest guidance.')}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {t('chatQuickQuestionsTitle', 'Quick questions')}
              </p>
              <div className="mt-4 space-y-3">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt.topic}
                    type="button"
                    onClick={() => {
                      void sendMessage(prompt.label, prompt.topic);
                    }}
                    className="w-full rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-left text-sm text-cyan-100 transition hover:bg-cyan-400/20"
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-[30px] border border-cyan-300/20 bg-slate-900 p-6 shadow-2xl">
              <div
                ref={messageContainerRef}
                className="chat-message-container mb-6 h-[400px] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/50 p-4"
              >
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
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
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

              <div className="space-y-4">
                <div className="flex gap-2">
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
                    className="rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
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
                      'Save the reference number you receive after submitting a report. You can log back in with it to add new information or provide more context.',
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-12 border-t border-white/10 bg-slate-950/80 py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-400 sm:px-6 lg:px-8">
          <p>{t('footerText')}</p>
          <p className="mt-2">
            {t('maintainedBy')}{' '}
            <a href="https://ottana.site" target="_blank" rel="noreferrer" className="font-medium text-amber-300 hover:text-amber-200">
              Ottana Creatives
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ChatPage;

import { useEffect, useRef, useState } from 'react';
import { API_BASE } from './apiBase';

export type PublicChatState = 'Chat' | 'Loader' | 'Scrolling';

export interface PublicChatMessage {
  id: number;
  text: string;
  isUser: boolean;
}

interface PublicGuidancePayloadArgs {
  message: string;
  history: PublicChatMessage[];
  language?: string | null;
  city?: string | null;
  topic?: string | null;
  currentState?: PublicChatState;
  isFirstInteraction?: boolean;
}

interface PublicGuidanceResponse {
  reply?: string;
}

interface UsePublicGuidanceChatOptions {
  language?: string | null;
  fallbackWelcome: string;
  fallbackError: string;
  city?: string | null;
  autoStart?: boolean;
  initialState?: PublicChatState;
}

const LANGUAGE_STORAGE_KEY = 'femataLng';
const DEFAULT_CITY = 'Dar es Salaam';
const DEFAULT_STATE: PublicChatState = 'Chat';

const normalizeLanguageCode = (value?: string | null) => {
  if (!value) return '';
  return value.trim().toLowerCase().split('-')[0];
};

export const resolvePublicChatLanguage = (language?: string | null) => {
  const direct = normalizeLanguageCode(language);
  if (direct) return direct;

  if (typeof window !== 'undefined') {
    try {
      const stored = normalizeLanguageCode(localStorage.getItem(LANGUAGE_STORAGE_KEY));
      if (stored) return stored;
    } catch {
      // ignore storage access failures
    }
  }

  return 'en';
};

export const resolvePublicChatCity = (city?: string | null) => {
  const value = city?.trim();
  return value || DEFAULT_CITY;
};

const formatLocalClock = (date: Date) =>
  date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const formatGuidanceHistory = (messages: PublicChatMessage[]) =>
  messages.slice(-6).map((message) => ({
    role: message.isUser ? 'user' : 'assistant',
    content: message.text,
  }));

export const buildPublicGuidancePayload = ({
  message,
  history,
  language,
  city,
  topic,
  currentState = DEFAULT_STATE,
  isFirstInteraction = false,
}: PublicGuidancePayloadArgs) => {
  const now = new Date();
  const userLanguage = resolvePublicChatLanguage(language);

  return {
    message: message.trim(),
    language: userLanguage,
    history: formatGuidanceHistory(history),
    client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    client_time_iso: now.toISOString(),
    is_first_interaction: isFirstInteraction,
    context: {
      topic,
      time: formatLocalClock(now),
      city: resolvePublicChatCity(city),
      user_lang: userLanguage,
      current_state: currentState,
    },
  };
};

export const scrollMessageContainerToBottom = (
  node: HTMLDivElement | null,
  behavior: ScrollBehavior = 'smooth',
) => {
  if (!node) return;
  node.scrollTo({ top: node.scrollHeight, behavior });
};

export const usePublicGuidanceChat = ({
  language,
  fallbackWelcome,
  fallbackError,
  city,
  autoStart = false,
  initialState = DEFAULT_STATE,
}: UsePublicGuidanceChatOptions) => {
  const normalizedLanguage = resolvePublicChatLanguage(language);
  const [messages, setMessages] = useState<PublicChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const autoStartKeyRef = useRef('');
  const lastLanguageRef = useRef(normalizedLanguage);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    scrollMessageContainerToBottom(messageContainerRef.current, behavior);
  };

  useEffect(() => {
    scrollToBottom(messages.length <= 1 ? 'auto' : 'smooth');
  }, [messages]);

  useEffect(() => {
    if (lastLanguageRef.current === normalizedLanguage) return;
    lastLanguageRef.current = normalizedLanguage;
    autoStartKeyRef.current = '';
    setMessages([]);
    setInput('');
  }, [normalizedLanguage]);

  const sendRequest = async (
    rawMessage: string,
    requestState: PublicChatState = DEFAULT_STATE,
    topic?: string,
    isFirstInteraction = false,
  ) => {
    const trimmed = rawMessage.trim();
    if ((!trimmed && !isFirstInteraction) || isLoading) return;

    const nextMessages = isFirstInteraction
      ? messages
      : [
          ...messages,
          {
            id: Date.now(),
            text: trimmed,
            isUser: true,
          },
        ];

    if (!isFirstInteraction) {
      setMessages(nextMessages);
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/ai-chat/guidance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          buildPublicGuidancePayload({
            message: trimmed,
            history: nextMessages,
            language: normalizedLanguage,
            city,
            topic,
            currentState: requestState,
            isFirstInteraction,
          }),
        ),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as PublicGuidanceResponse;
      const reply =
        data.reply?.trim() || (isFirstInteraction ? fallbackWelcome : fallbackError);

      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + Math.floor(Math.random() * 1000),
          text: reply,
          isUser: false,
        },
      ]);
    } catch (error) {
      console.error('Error sending guidance request:', error);
      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + Math.floor(Math.random() * 1000),
          text: isFirstInteraction ? fallbackWelcome : fallbackError,
          isUser: false,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (rawMessage: string, topic?: string) =>
    sendRequest(rawMessage, 'Chat', topic, false);

  const startConversation = async (_requestState: PublicChatState = initialState) => {
    if (messages.length > 0 || isLoading) return;

    setMessages([
      {
        id: Date.now(),
        text: fallbackWelcome,
        isUser: false,
      },
    ]);
  };

  const clearConversation = () => {
    autoStartKeyRef.current = '';
    setMessages([]);
    setInput('');
  };

  useEffect(() => {
    if (!autoStart || isLoading || messages.length > 0) return;

    const autoStartKey = `${normalizedLanguage}:${resolvePublicChatCity(city)}:${initialState}`;
    if (autoStartKeyRef.current === autoStartKey) return;

    autoStartKeyRef.current = autoStartKey;
    void startConversation(initialState);
  }, [autoStart, city, initialState, isLoading, messages.length, normalizedLanguage]);

  return {
    messages,
    input,
    setInput,
    isLoading,
    messageContainerRef,
    scrollToBottom,
    sendMessage,
    startConversation,
    clearConversation,
  };
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getApiBase = () => {
  const envBase = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_BASE;
  if (envBase?.trim()) return trimTrailingSlash(envBase.trim());
  return "";
};

export const API_BASE = getApiBase();

import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      am: typeof import('./locales/shared/am/common.json');
      ar: typeof import('./locales/shared/ar/common.json');
      bn: typeof import('./locales/shared/bn/common.json');
      de: typeof import('./locales/shared/de/common.json');
      en: typeof import('./locales/shared/en/common.json');
      fr: typeof import('./locales/shared/fr/common.json');
      hi: typeof import('./locales/shared/hi/common.json');
      ko: typeof import('./locales/shared/ko/common.json');
      sw: typeof import('./locales/shared/sw/common.json');
      th: typeof import('./locales/shared/th/common.json');
      zh: typeof import('./locales/shared/zh/common.json');
    };
  }
}

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import de from './locales/de.json';
import en from './locales/en.json';
import tr from './locales/tr.json';
import ar from './locales/ar.json';
import uk from './locales/uk.json';
import ru from './locales/ru.json';

export const SUPPORTED_LANGUAGES = ['de', 'en', 'tr', 'ar', 'uk', 'ru'] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

/** Languages that render right-to-left. */
export const RTL_LANGUAGES: LanguageCode[] = ['ar'];

export const isRtl = (lng: string): boolean =>
  RTL_LANGUAGES.includes(lng.split('-')[0] as LanguageCode);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
      tr: { translation: tr },
      ar: { translation: ar },
      uk: { translation: uk },
      ru: { translation: ru },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'oriso-lang',
    },
  });

/** Keep <html lang/dir> in sync so RTL and font rendering are correct. */
const applyDocumentDirection = (lng: string) => {
  document.documentElement.lang = lng;
  document.documentElement.dir = isRtl(lng) ? 'rtl' : 'ltr';
};
applyDocumentDirection(i18n.language || 'de');
i18n.on('languageChanged', applyDocumentDirection);

export default i18n;

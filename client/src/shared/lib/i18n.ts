import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import commonEn from '../../locales/en/common.json';
import commonFr from '../../locales/fr/common.json';
import commonDe from '../../locales/de/common.json';
import commonAr from '../../locales/ar/common.json';

import dashboardEn from '../../locales/en/dashboard.json';
import dashboardFr from '../../locales/fr/dashboard.json';
import dashboardDe from '../../locales/de/dashboard.json';
import dashboardAr from '../../locales/ar/dashboard.json';

import settingsEn from '../../locales/en/settings.json';
import settingsFr from '../../locales/fr/settings.json';
import settingsDe from '../../locales/de/settings.json';
import settingsAr from '../../locales/ar/settings.json';

import pagesEn from '../../locales/en/pages.json';
import pagesFr from '../../locales/fr/pages.json';
import pagesDe from '../../locales/de/pages.json';
import pagesAr from '../../locales/ar/pages.json';

/**
 * Custom detector to get language from IP via a free GeoIP API
 * This is a fallback if no localStorage or navigator language is preferred
 */
  // const _ipLanguageDetector = {
  // name: 'ipDetector',
  // lookup() {
    // We can't do a synchronous fetch here easily, 
    // but we can trigger an async check and change language later
    // return undefined;
  // },
  // cacheUserLanguage() {}
// };

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: commonEn,
        dashboard: dashboardEn,
        settings: settingsEn,
        pages: pagesEn,
      },
      fr: {
        common: commonFr,
        dashboard: dashboardFr,
        settings: settingsFr,
        pages: pagesFr,
      },
      de: {
        common: commonDe,
        dashboard: dashboardDe,
        settings: settingsDe,
        pages: pagesDe,
      },
      ar: {
        common: commonAr,
        dashboard: dashboardAr,
        settings: settingsAr,
        pages: pagesAr,
      },
    },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en', 'de', 'ar'],
    ns: ['common', 'dashboard', 'settings', 'pages'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      // Order of detection: 
      // 1. URL query string (?lng=en)
      // 2. LocalStorage (user preference saved)
      // 3. Browser navigator language
      // 4. HTML lang attribute
      order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
      lookupQuerystring: 'lng',
      caches: ['localStorage'],
      excludeCacheFor: ['cimode'],
    },
  });

/**
 * Logic to detect language by IP if no preference is stored
 */
const detectLanguageByIP = async () => {
  // Only run if the user hasn't manually set a language in localStorage
  if (!localStorage.getItem('i18nextLng')) {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      
      if (data.languages) {
        // data.languages is a comma-separated list like "en-US,es-US,fr-US"
        const primaryLang = data.languages.split(",")?.[0]?.split("-")?.[0] ?? "";
        const supported = ['fr', 'en', 'de', 'ar'];
        
        if (supported.includes(primaryLang)) {
          if (import.meta.env.DEV) { console.log(`[i18n] IP detected language: ${primaryLang} (Country: ${data.country_name})`); }
          i18n.changeLanguage(primaryLang);
        }
      }
    } catch (error: any) {
      console.error('[i18n] Failed to detect language by IP:', error);
    }
  }
};

// Execute IP detection
detectLanguageByIP();

export default i18n;

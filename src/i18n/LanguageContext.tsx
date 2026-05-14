import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import SettingsService from '../services/SettingsService';
import { Language } from '../types/Settings';
import { LANGUAGE_META, translate } from './translations';

interface LanguageContextValue {
  language: Language;
  direction: 'ltr' | 'rtl';
  /** Translate a string key, with optional {placeholder} substitution. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Persist a new language choice and re-render the whole app. */
  setLanguage: (lang: Language) => Promise<void>;
}

const defaultValue: LanguageContextValue = {
  language: 'en',
  direction: 'ltr',
  t: (key) => key,
  setLanguage: async () => {},
};

const LanguageContext = createContext<LanguageContextValue>(defaultValue);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    SettingsService.load().then(s => {
      if (s.language && s.language !== language) setLanguageState(s.language);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(key, language, params),
    [language],
  );

  const setLanguage = useCallback(async (lang: Language) => {
    const settings = await SettingsService.load();
    await SettingsService.save({ ...settings, language: lang });
    setLanguageState(lang);
  }, []);

  const direction = LANGUAGE_META[language].direction;

  return (
    <LanguageContext.Provider value={{ language, direction, t, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation(): LanguageContextValue {
  return useContext(LanguageContext);
}

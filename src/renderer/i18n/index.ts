import { en, type Strings } from './en';
import { he } from './he';

export type Lang = 'en' | 'he';
export type { Strings };

export const tables: Record<Lang, Strings> = { en, he };

/** The app follows the machine's language unless a choice has been saved. */
export function detectLang(navigatorLanguage: string | undefined): Lang {
  return (navigatorLanguage || 'en').toLowerCase().startsWith('he') ? 'he' : 'en';
}

export function strings(lang: Lang): Strings {
  return tables[lang] || en;
}

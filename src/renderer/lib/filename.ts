// Builds "<tab label> <year>.<ext>".
//
// Names come from the tab labels, in the current language, so a new tab is
// named correctly for free and nothing has to be translated twice. The main
// process sanitises again on its side — this side is building a name, that
// side is defending a filesystem.

/** Illegal in Windows filenames. Hebrew is fine; these are not. */
const FORBIDDEN = /[\\/:*?"<>|]/g;
const CONTROL = /[\u0000-\u001F\u007F]/g;

const FALLBACK = 'Kindergarten Helper';

/**
 * Defensive on purpose: these strings are user-facing labels that may change,
 * and a tab could one day be named something with a colon in it.
 */
export function safeFilename(value: string): string {
  const cleaned = String(value == null ? '' : value)
    .replace(FORBIDDEN, ' ')
    .replace(CONTROL, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .slice(0, 150)
    .trim();
  return cleaned || FALLBACK;
}

/**
 * @param label the tab's name in the current language
 * @param ext   without the dot
 * @param now   injectable so the year is testable
 */
export function exportName(label: string, ext: string, now: Date = new Date()): string {
  return safeFilename(label + ' ' + now.getFullYear()) + '.' + ext;
}

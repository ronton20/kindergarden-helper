// The string tables.
//
// `Strings` is derived from the English table, so a *missing* Hebrew key is
// already a compile error. These cover what types cannot: a key that exists
// but was left in English, and the labels the export filenames are built from.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { en } from '../../src/renderer/i18n/en';
import { he } from '../../src/renderer/i18n/he';
import { strings, detectLang, tables } from '../../src/renderer/i18n';

const golden = JSON.parse(
  readFileSync(join(__dirname, '..', 'characterization', 'golden.json'), 'utf8')
);

const HEBREW = /[֐-׿]/;

describe('string tables', () => {
  it('has the same keys in both languages', () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
  });

  it('has no blank strings', () => {
    for (const [key, value] of Object.entries({ ...en, ...he })) {
      expect(value, key).not.toBe('');
    }
  });

  it('actually translates every label that a person reads', () => {
    // A handful are deliberately the same in both languages: file formats and
    // proper nouns are not translated.
    const sharedOnPurpose = new Set(['appTitle']);
    const untranslated: string[] = [];

    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      if (sharedOnPurpose.has(key)) continue;
      const hebrew = he[key];
      // If the Hebrew is identical to the English and contains no Hebrew
      // letters at all, it was never translated.
      if (hebrew === en[key] && !HEBREW.test(hebrew)) untranslated.push(key);
    }

    expect(untranslated).toEqual([]);
  });

  it('matches the tab labels the shipped app renders', () => {
    expect([en.tabChildren, en.tabLarge, en.tabSmall, en.tabAtt, en.tabGrad])
      .toEqual(golden.englishTabLabels);
    expect([he.tabChildren, he.tabLarge, he.tabSmall, he.tabAtt, he.tabGrad])
      .toEqual(golden.hebrewTabLabels);
  });
});

describe('detectLang', () => {
  it('follows the machine into Hebrew', () => {
    expect(detectLang('he')).toBe('he');
    expect(detectLang('he-IL')).toBe('he');
    expect(detectLang('HE-il')).toBe('he');
  });

  it('uses English for everything else, including nothing at all', () => {
    expect(detectLang('en-GB')).toBe('en');
    expect(detectLang('fr')).toBe('en');
    expect(detectLang(undefined)).toBe('en');
    expect(detectLang('')).toBe('en');
  });
});

describe('strings', () => {
  it('returns the table for the language', () => {
    expect(strings('he')).toBe(he);
    expect(strings('en')).toBe(en);
    expect(Object.keys(tables)).toEqual(['en', 'he']);
  });
});

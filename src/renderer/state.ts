// The app's state, and everything that mutates it.
//
// One hook rather than a store: the state is a single saved object plus a
// handful of transient flags, and every change persists. Keeping that in one
// place means there is exactly one call to `save`, rather than a persistence
// call sprinkled through every handler — which is how one gets forgotten.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { load, save, defaultState } from './lib/storage';
import { strings as stringsFor } from './i18n';
import type { SavedFile } from './lib/desktop';
import { bridge } from './lib/desktop';
import type {
  AttSettings, Child, ColorTarget, GradSettings, Lang, SavedState, StudioName, StudioSettings
} from './lib/types';

export type TabKey = 'children' | 'large' | 'small' | 'att' | 'grad';

export type BackupNote = 'backupDone' | 'backupRestored' | 'backupBad' | '';

export interface Transient {
  activeTab: TabKey;
  /** "Preparing the photo…" while a picture is being decoded. */
  gradBusy: string;
  gradErr: string;
  backupNote: BackupNote;
  backupErr: boolean;
  savedFile: SavedFile | null;
  saveError: boolean;
}

const INITIAL_TRANSIENT: Transient = {
  activeTab: 'children',
  gradBusy: '',
  gradErr: '',
  backupNote: '',
  backupErr: false,
  savedFile: null,
  saveError: false
};

const MAX_HISTORY = 10;

export function useAppState() {
  // Loaded once, synchronously, so the first paint is already correct rather
  // than flashing an empty list.
  const loaded = useRef(
    typeof window === 'undefined'
      ? { state: defaultState(), nextId: 1, hadSaved: false }
      : load(navigator.language)
  );

  const [saved, setSavedState] = useState<SavedState>(loaded.current.state);
  const [transient, setTransient] = useState<Transient>(INITIAL_TRANSIENT);
  const nextId = useRef(loaded.current.nextId);

  const strings = useMemo(() => stringsFor(saved.lang), [saved.lang]);

  // Every change to the saved half is written straight away. The photo can
  // exceed the storage quota; `save` drops it rather than losing the names,
  // and says so once.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const outcome = save(saved);
    if (outcome === 'saved-without-photo' && saved.grad.img) {
      setTransient((t) => (t.gradErr ? t : { ...t, gradErr: strings.photoTooBig }));
    }
  }, [saved, strings.photoTooBig]);

  // The main process reports where a file actually landed. Desktop only.
  useEffect(() => {
    bridge()?.onSaved((payload) =>
      setTransient((t) => ({ ...t, savedFile: payload, saveError: false })));
  }, []);

  useEffect(() => {
    document.documentElement.lang = saved.lang;
    document.documentElement.dir = saved.lang === 'he' ? 'rtl' : 'ltr';
  }, [saved.lang]);

  const patch = useCallback((changes: Partial<Transient>) => {
    setTransient((t) => ({ ...t, ...changes }));
  }, []);

  const setLang = useCallback((lang: Lang) => {
    setSavedState((s) => ({ ...s, lang }));
  }, []);

  const setTab = useCallback((activeTab: TabKey) => {
    // The "saved" line belongs to the export that produced it.
    setTransient((t) => ({ ...t, activeTab, savedFile: null, saveError: false }));
  }, []);

  // ── children ────────────────────────────────────────────────────────────
  const addChild = useCallback(() => {
    const id = nextId.current++;
    setSavedState((s) => ({ ...s, children: [...s.children, { id, first: '', last: '', tz: '' }] }));
  }, []);

  const removeChild = useCallback((id: number) => {
    setSavedState((s) => ({ ...s, children: s.children.filter((c) => c.id !== id) }));
  }, []);

  const editChild = useCallback((id: number, field: keyof Omit<Child, 'id'>, value: string) => {
    setSavedState((s) => ({
      ...s,
      children: s.children.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    }));
  }, []);

  // ── studios ─────────────────────────────────────────────────────────────
  const updateStudio = useCallback((studio: StudioName, changes: Partial<StudioSettings>) => {
    setSavedState((s) => ({ ...s, [studio]: { ...s[studio], ...changes } }));
  }, []);

  /**
   * Setting a colour writes to the studio when colouring uniformly, and to the
   * selected child's override when not. Either way the colour joins the
   * recently-used list, which is what makes a scheme reusable next year.
   */
  const setStudioColor = useCallback((studio: StudioName, target: ColorTarget, color: string) => {
    setSavedState((s) => {
      const current = s[studio];
      let next: StudioSettings;
      if (current.uniform || !current.selectedId) {
        next = { ...current, [target]: color };
      } else {
        const forChild = { ...(current.overrides[current.selectedId] || {}), [target]: color };
        next = { ...current, overrides: { ...current.overrides, [current.selectedId]: forChild } };
      }
      const history = [color, ...s.history.filter((c) => c.toLowerCase() !== color.toLowerCase())]
        .slice(0, MAX_HISTORY);
      return { ...s, [studio]: next, history };
    });
  }, []);

  const toggleUniform = useCallback((studio: StudioName) => {
    setSavedState((s) => {
      const current = s[studio];
      const uniform = !current.uniform;
      return { ...s, [studio]: { ...current, uniform, selectedId: uniform ? null : current.selectedId } };
    });
  }, []);

  const selectCard = useCallback((studio: StudioName, id: number) => {
    setSavedState((s) => {
      const current = s[studio];
      if (current.uniform) return s;
      return { ...s, [studio]: { ...current, selectedId: current.selectedId === id ? null : id } };
    });
  }, []);

  // ── graduation and attendance ───────────────────────────────────────────
  const updateGrad = useCallback((changes: Partial<GradSettings>) => {
    setSavedState((s) => ({ ...s, grad: { ...s.grad, ...changes } }));
  }, []);

  const updateAtt = useCallback((changes: Partial<AttSettings>) => {
    setSavedState((s) => ({ ...s, att: { ...s.att, ...changes } }));
  }, []);

  // ── backup ──────────────────────────────────────────────────────────────
  const replaceAll = useCallback((incoming: SavedState) => {
    nextId.current = incoming.children.reduce((max, c) => Math.max(max, c.id || 0), 0) + 1;
    setSavedState(incoming);
  }, []);

  return {
    saved,
    transient,
    strings,
    patch,
    setLang,
    setTab,
    addChild,
    removeChild,
    editChild,
    updateStudio,
    setStudioColor,
    toggleUniform,
    selectCard,
    updateGrad,
    updateAtt,
    replaceAll
  };
}

export type AppApi = ReturnType<typeof useAppState>;

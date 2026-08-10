// Getting the name cards onto paper.
//
// The cards only exist as a print stylesheet — there is no file to download —
// so the two builds take different routes to the same picture:
//
//   * installed: the main process renders the page with `printToPDF` and
//     writes the PDF into Documents. Page geometry is passed as options there,
//     so it is not duplicated here.
//   * browser: `window.print()` and the system dialog, which needs an @page
//     rule injected because that is the only way to state the paper size.
//
// Both reveal the right sheet by setting `body[data-print]`, which the print
// stylesheet keys off. Nothing changes on screen: those rules only exist
// inside `@media print`.

import { bridge } from './desktop';
import type { StudioName } from './types';

const PAGE_RULE_ID = 'kh-print-page';

/** Wait for the attribute to have been laid out before anything reads the page. */
const nextPaint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );

export type PrintOutcome = 'saved' | 'dialog' | 'failed';

export async function printCards(studio: StudioName, filename: string): Promise<PrintOutcome> {
  const kh = bridge();

  if (!kh) {
    // Browser: the injected rule is the only source of truth for page geometry
    // in this build, since window.print() takes no options.
    const style = document.getElementById(PAGE_RULE_ID);
    if (style) style.textContent = '@media print{ @page{ size:A4; margin:1cm; } }';
    document.body.setAttribute('data-print', studio);
    // A frame for the stylesheet to take effect, then hand over to the dialog.
    await nextPaint();
    window.print();
    // The dialog is modal in some browsers and not in others, so clear the
    // attribute after a beat rather than immediately.
    setTimeout(() => document.body.removeAttribute('data-print'), 400);
    return 'dialog';
  }

  document.body.setAttribute('data-print', studio);
  try {
    await nextPaint();
    const result = await kh.savePdf(filename);
    return result && result.ok ? 'saved' : 'failed';
  } catch {
    return 'failed';
  } finally {
    document.body.removeAttribute('data-print');
  }
}

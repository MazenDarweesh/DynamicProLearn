/**
 * DOM timing, quiescence settling, and form container resolution utilities.
 */

/**
 * True when the element is genuinely rendered (not display:none / visibility:hidden / detached from layout).
 * Background ERP tabs stay in the DOM without the `hidden` attribute, so `:not([hidden])` alone is not enough.
 */
export function isElementRendered(el: Element | null | undefined): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.getClientRects().length === 0) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function firstRendered(selector: string): Element | null {
  return Array.from(document.querySelectorAll(selector)).find((el) => isElementRendered(el)) || null;
}

/**
 * Resolves the container of the screen the user is actually looking at (visible tab page), so fields of
 * previously opened screens that remain mounted in the background are never inspected.
 */
export function getActiveScreenContainer(): Element | null {
  if (typeof document === 'undefined') return null;
  return firstRendered('.dp-shell__pages > div:not([hidden])');
}

/**
 * Resolves the live form container so hidden background tabs are never inspected.
 * Order: floating modal form → visible tab's form → visible tab → whole document (non-ERP/mock hosts).
 * Every tier requires the candidate to be rendered, not merely lacking the `hidden` attribute.
 */
export function getActiveFormRoot(): ParentNode {
  if (typeof document === 'undefined') return document;
  const root =
    firstRendered('.cdk-overlay-container .dp-modal app-add-or-edit') ||
    firstRendered('.dp-shell__pages > div:not([hidden]) app-add-or-edit') ||
    firstRendered('.dp-shell__pages > div:not([hidden])');
  return root || document;
}

/**
 * Waits for a condition to be satisfied using MutationObserver without arbitrary setTimeout.
 */
export async function waitFor<T>(
  predicate: () => T | null | undefined,
  timeoutMs: number = 2000
): Promise<T | null> {
  if (typeof document === 'undefined') return null;

  const initial = predicate();
  if (initial) return initial;

  return new Promise<T | null>((resolve) => {
    let timeoutId: any;
    const observer = new MutationObserver(() => {
      const result = predicate();
      if (result) {
        clearTimeout(timeoutId);
        observer.disconnect();
        resolve(result);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    timeoutId = setTimeout(() => {
      observer.disconnect();
      resolve(predicate() || null);
    }, timeoutMs);
  });
}

/**
 * Waits for DOM mutations to quiesce (settle) within container, with a safety ceiling.
 * Ensures Angular change detection, component transitions, and dependent field rendering
 * are completely finished before the next field is inspected or filled.
 */
export async function settle(
  container?: HTMLElement,
  options: { quietMs?: number; maxMs?: number; minMs?: number } = {}
): Promise<void> {
  if (typeof document === 'undefined') return;

  const quietMs = options.quietMs ?? 60;
  const maxMs = options.maxMs ?? 800;
  const minMs = options.minMs ?? 0;
  const startTime = Date.now();
  const target = container || document.body;

  return new Promise<void>((resolve) => {
    let timeoutId: any;
    let maxTimeoutId: any;
    let observer: MutationObserver | null = null;

    const cleanup = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < minMs) {
        setTimeout(cleanup, minMs - elapsed);
        return;
      }
      if (timeoutId) clearTimeout(timeoutId);
      if (maxTimeoutId) clearTimeout(maxTimeoutId);
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (typeof window !== 'undefined') {
        (window as any).__erpPageReady = true;
      }
      resolve();
    };

    maxTimeoutId = setTimeout(() => {
      cleanup();
    }, maxMs);

    const resetQuietTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        cleanup();
      }, quietMs);
    };

    observer = new MutationObserver(() => {
      resetQuietTimer();
    });

    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    // Start initial quiet timer
    resetQuietTimer();
  });
}

/**
 * Highlights an element temporarily to give the user visual feedback that AI filled it.
 */
export function highlightElement(el: HTMLElement): void {
  el.classList.add('ai-autofill-highlight');
  setTimeout(() => el.classList.remove('ai-autofill-highlight'), 3500);
}

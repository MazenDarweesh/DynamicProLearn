import { CopilotSource, CopilotFormFillData } from '../../../../core/services/ai-copilot/copilot.service';

export interface RenderableChatMessage {
  text: string;
  sources?: CopilotSource[];
  _cachedRawText?: string;
  _cachedSourcesLen?: number;
  _cachedRenderedMarkdown?: string;
}

/**
 * Removes duplicate sources based on URL + start/end timestamp combination.
 */
export function deduplicateCopilotSources(sources: CopilotSource[]): CopilotSource[] {
  const seen = new Set<string>();
  return sources.filter((src) => {
    const key = `${src.url ?? ''}::${src.start ?? 0}::${src.end ?? 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Formats seconds into MM:SS or HH:MM:SS display format.
 */
export function formatCopilotTimestamp(seconds?: number): string {
  if (seconds == null || seconds < 0) return '';
  const totalSeconds = Math.floor(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Builds a YouTube/Video URL that seeks to the given start time.
 */
export function buildCopilotSourceUrl(src: CopilotSource): string {
  if (!src.url) return '#';
  try {
    const url = new URL(src.url);
    if (src.start != null && src.start > 0 && !url.searchParams.has('t')) {
      url.searchParams.set('t', `${src.start}s`);
    }
    return url.toString();
  } catch {
    return src.url;
  }
}

function isRawFileNameOrId(str: string): boolean {
  return (
    /\.(mp4|mkv|avi|webm|mov|flv|pdf|docx|txt)$/i.test(str) ||
    /^lesson_[a-zA-Z0-9_-]+$/i.test(str) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) ||
    /^[a-zA-Z0-9_-]{11}$/.test(str)
  );
}

/**
 * Returns a clean, friendly display label for a source chip.
 */
export function formatCopilotSourceLabel(src: CopilotSource, index: number): string {
  const rawTitle = src.lesson_title || src.title;
  if (rawTitle && !isRawFileNameOrId(rawTitle)) {
    return rawTitle.replace(/^المصدر\s*\[\d+\]\s*[—\-]\s*/i, '').trim();
  }

  if (src.type === 'video' || (src.url && (src.url.includes('youtu') || src.url.includes('video')))) {
    return `مقطع فيديو تعليمي ${index + 1}`;
  }

  if (src.type === 'pdf') {
    if (src.page != null) {
      return `مستند دراسي (صفحة ${src.page})`;
    }
    return `مستند دراسي ${index + 1}`;
  }

  return `مصدر تعليمي ${index + 1}`;
}

/**
 * Memoized transformation of raw message text citations like [1], [1, 2] into markdown links.
 * Prevents re-running regex and URL construction on every Angular change detection cycle.
 */
export function renderCopilotMessageText(msg: RenderableChatMessage): string {
  if (!msg.text) return '';
  const sourcesLen = msg.sources?.length || 0;
  if (sourcesLen === 0) return msg.text;

  if (
    msg._cachedRenderedMarkdown !== undefined &&
    msg._cachedRawText === msg.text &&
    msg._cachedSourcesLen === sourcesLen
  ) {
    return msg._cachedRenderedMarkdown;
  }

  const citationRegex = /\[([0-9]+(?:\s*,\s*[0-9]+)*)\]/g;
  const rendered = msg.text.replace(citationRegex, (_match, group) => {
    const numbers = group.split(',').map((s: string) => parseInt(s.trim(), 10));
    const formattedLinks = numbers.map((num: number) => {
      const sourceIndex = num - 1;
      if (sourceIndex >= 0 && sourceIndex < msg.sources!.length) {
        const src = msg.sources![sourceIndex];
        const url = buildCopilotSourceUrl(src);
        const label = formatCopilotSourceLabel(src, sourceIndex);
        return `[\[${num}\]](${url} "${label}")`;
      }
      return `[${num}]`;
    });
    return formattedLinks.join(' ');
  });

  msg._cachedRawText = msg.text;
  msg._cachedSourcesLen = sourcesLen;
  msg._cachedRenderedMarkdown = rendered;
  return rendered;
}

/**
 * Validates whether form fill data contains actionable fields, rows, or batch items.
 */
export function isValidCopilotFormFill(data?: CopilotFormFillData): boolean {
  if (!data) return false;

  if (data.batch_mode) {
    return Array.isArray(data.batch_items) && data.batch_items.length > 0;
  }

  const hasFields =
    !!data.fields &&
    Object.keys(data.fields).some((k) => {
      const val = data.fields![k];
      return val != null && String(val).trim() !== '';
    });

  const hasRows =
    !!data.rows &&
    Array.isArray(data.rows) &&
    data.rows.length > 0 &&
    data.rows.some((row) => Object.values(row).some((val) => val != null && String(val).trim() !== ''));

  return hasFields || hasRows;
}


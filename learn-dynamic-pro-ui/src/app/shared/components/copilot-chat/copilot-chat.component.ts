import { Component, inject, ElementRef, ViewChild, AfterViewChecked, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { Subscription, timer } from 'rxjs';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { CopilotService, CopilotSource, CopilotFeedbackRequest, CopilotFilterState } from '../../../core/services/copilot.service';
import { AuthService } from '../../../core/services/auth.service';
import { CopilotTopFilterBarComponent } from '../copilot-top-filter-bar/copilot-top-filter-bar.component';

export interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  sources?: CopilotSource[];
  rating?: 'UP' | 'DOWN' | null;
  feedbackSubmitted?: boolean;
  feedbackComment?: string;
  showCommentBox?: boolean;
  isSubmittingFeedback?: boolean;
  selectedReasonTag?: string;
  isStreaming?: boolean;
  threadId?: string;
  lessonId?: string;
  lessonIds?: string[];
  filters?: CopilotFilterState;
  /** Stores the original user question paired with this assistant response */
  relatedUserQuery?: string;
  isRetrying?: boolean;
  cacheHit?: boolean;
  provenance?: string;
  latencyMs?: number;
}

@Component({
  selector: 'app-copilot-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownComponent, CdkDrag, CdkDragHandle, CopilotTopFilterBarComponent],
  templateUrl: './copilot-chat.component.html',
  styleUrls: ['./copilot-chat.component.css']
})
export class CopilotChatComponent implements OnInit, AfterViewChecked, OnDestroy {
  private copilotService = inject(CopilotService);
  private router = inject(Router);
  authService = inject(AuthService);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  isOpen = false;
  isMinimized = false;
  inputQuery = '';
  isStreaming = false;
  isClearingCache = false;
  clearCacheStatus: 'idle' | 'success' | 'error' = 'idle';

  // ── Smart Top Filter Bar State ───────────────────────────────────────────
  activeFilter: CopilotFilterState = { scope: 'all' };
  activeLessonId?: string;
  isFilterBarCollapsed = false;
  private lessonSub?: Subscription;

  isAiReady = true;
  isWarmingUp = false;
  hasConnectionError = false;
  currentAttempt = 0;
  readonly maxAttempts = 5;
  private readinessSub?: Subscription;

  get isAdmin(): boolean {
    return this.authService.userRole() === 'Admin';
  }

  get isLoggedIn(): boolean {
    const url = this.router.url || window.location.pathname;
    const isAuthRoute = url.includes('/login') || url.includes('/erp-redirect');
    return this.authService.isAuthenticated() && !isAuthRoute;
  }

  messages: ChatMessage[] = [
    {
      sender: 'assistant',
      text: 'مرحباً بك! أنا مساعدك الذكي في منصة DynamicProLearn. اسألني أي سؤال عن دروس وموديولات النظام وسأجيبك مباشرة من واقع الفيديوهات والمحتوى التعليمي! ✨'
    }
  ];

  ngOnInit() {
    this.lessonSub = this.copilotService.activeLessonId$.subscribe(lessonId => {
      if (lessonId) {
        this.activeLessonId = lessonId;
      }
    });
    this.detectLessonFromRoute();
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.stopReadinessPolling();
    this.lessonSub?.unsubscribe();
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.isMinimized = false;
      this.detectLessonFromRoute();
      this.checkAiReadiness();
    } else {
      this.stopReadinessPolling();
    }
  }

  onFilterChange(newFilter: CopilotFilterState) {
    this.activeFilter = newFilter;
  }

  onFilterCollapseChange(collapsed: boolean) {
    this.isFilterBarCollapsed = collapsed;
  }

  detectLessonFromRoute() {
    try {
      const url = this.router.url;
      const queryParams = new URLSearchParams(window.location.search);
      const queryLessonId = queryParams.get('lessonId');
      if (queryLessonId) {
        this.activeLessonId = queryLessonId;
        return;
      }
      const match = url.match(/\/lessons\/([a-f0-9\-]{36})/i);
      if (match && match[1]) {
        this.activeLessonId = match[1];
      }
    } catch (e) {
      // Safe fallback
    }
  }

  /**
   * Performs an initial check and bounds automatic polling to maxAttempts (5 times)
   * to avoid flooding the browser console when the AI engine is completely offline.
   */
  checkAiReadiness() {
    this.stopReadinessPolling();
    this.currentAttempt = 0;
    this.hasConnectionError = false;

    // Immediate initial check
    this.executeReadinessCheck();

    // Bounded polling every 2.5s
    this.readinessSub = timer(2500, 2500).subscribe(() => {
      this.executeReadinessCheck();
    });
  }

  private executeReadinessCheck() {
    this.currentAttempt++;
    this.copilotService.checkReadiness().subscribe({
      next: (res) => {
        if (res && res.ready) {
          this.isAiReady = true;
          this.isWarmingUp = false;
          this.hasConnectionError = false;
          this.stopReadinessPolling();
        } else {
          this.handleUnreadyAttempt();
        }
      },
      error: () => {
        this.handleUnreadyAttempt();
      }
    });
  }

  private handleUnreadyAttempt() {
    if (this.currentAttempt >= this.maxAttempts) {
      // 🛑 Max retries reached: Stop polling to protect browser performance and console logs
      this.stopReadinessPolling();
      this.isAiReady = false;
      this.isWarmingUp = false;
      this.hasConnectionError = true;
    } else {
      this.isAiReady = false;
      this.isWarmingUp = true;
      this.hasConnectionError = false;
    }
  }

  /**
   * Manual reconnect triggered by user clicking the retry button in the error banner
   */
  retryReadiness() {
    this.checkAiReadiness();
  }

  private stopReadinessPolling() {
    if (this.readinessSub) {
      this.readinessSub.unsubscribe();
      this.readinessSub = undefined;
    }
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
  }

  closeChat() {
    this.isOpen = false;
    this.stopReadinessPolling();
  }

  clearHistory() {
    this.messages = [
      {
        sender: 'assistant',
        text: 'مرحباً بك! أنا مساعدك الذكي في منصة DynamicProLearn. اسألني أي سؤال عن دروس وموديولات النظام وسأجيبك مباشرة من واقع الفيديوهات والمحتوى التعليمي! ✨'
      }
    ];
  }

  scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) {}
  }

  /**
   * Removes duplicate sources based on URL + start time combination.
   */
  deduplicateSources(sources: CopilotSource[]): CopilotSource[] {
    const seen = new Set<string>();
    return sources.filter(src => {
      const key = `${src.url ?? ''}::${src.start ?? 0}::${src.end ?? 0}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Formats seconds into MM:SS or HH:MM:SS display format.
   */
  formatTimestamp(seconds?: number): string {
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
   * Builds a YouTube URL that seeks to the given start time.
   */
  buildSourceUrl(src: CopilotSource): string {
    if (!src.url) return '#';
    try {
      const url = new URL(src.url);
      // Only add t= if not already set by the server
      if (src.start != null && src.start > 0 && !url.searchParams.has('t')) {
        url.searchParams.set('t', `${src.start}s`);
      }
      return url.toString();
    } catch {
      return src.url;
    }
  }

  /**
   * Returns a clean, friendly display label for a source chip.
   * Avoids showing raw video IDs, file extensions, or system hashes.
   */
  formatSourceLabel(src: CopilotSource, index: number): string {
    let rawTitle = src.lesson_title || src.title;
    if (rawTitle && !this.isRawFileNameOrId(rawTitle)) {
      // Strip redundant "المصدر [X] — " prefix from title if sent by backend
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

  private isRawFileNameOrId(str: string): boolean {
    return /\.(mp4|mkv|avi|webm|mov|flv|pdf|docx|txt)$/i.test(str)
      || /^lesson_[a-zA-Z0-9_-]+$/i.test(str)
      || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
      || /^[a-zA-Z0-9_-]{11}$/.test(str);
  }

  /**
   * Transforms raw message text citations like [1], [1, 2], [1][2] into markdown links
   * pointing directly to the corresponding source URL with timestamp.
   * If a citation index exceeds available sources, preserves it gracefully without broken links.
   */
  renderMessageText(msg: ChatMessage): string {
    if (!msg.text) return '';
    if (!msg.sources || msg.sources.length === 0) return msg.text;

    // Matches bracketed citations e.g. [1], [1, 2], [1, 2, 3] or 【1】
    const citationRegex = /\[([0-9]+(?:\s*,\s*[0-9]+)*)\]/g;

    return msg.text.replace(citationRegex, (match, group) => {
      const numbers = group.split(',').map((s: string) => parseInt(s.trim(), 10));
      const formattedLinks = numbers.map((num: number) => {
        const sourceIndex = num - 1;
        if (sourceIndex >= 0 && sourceIndex < msg.sources!.length) {
          const src = msg.sources![sourceIndex];
          const url = this.buildSourceUrl(src);
          const label = this.formatSourceLabel(src, sourceIndex);
          return `[\[${num}\]](${url} "${label}")`;
        }
        // Graceful fallback for hallucinated citation indices
        return `[${num}]`;
      });
      return formattedLinks.join(' ');
    });
  }

  /**
   * Intercepts clicks on markdown links in message bubbles to open them
   * in a new tab and prevent in-app route changes.
   */
  onBubbleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href && !anchor.href.endsWith('#')) {
      event.preventDefault();
      event.stopPropagation();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Opens a source URL in a new tab.
   */
  openSource(src: CopilotSource): void {
    const url = this.buildSourceUrl(src);
    if (url && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  async sendMessage(skipCache: boolean = false) {
    const query = this.inputQuery.trim();
    if (!query || this.isStreaming || !this.isAiReady) return;

    // Add user message
    this.messages.push({
      sender: 'user',
      text: query
    });

    this.inputQuery = '';
    await this.streamQuery(query, skipCache);
  }

  /** Core stream method — shared by sendMessage() and retryMessage() */
  private async streamQuery(query: string, skipCache: boolean = false) {
    this.isStreaming = true;

    // Create assistant message placeholder
    const assistantMsgIndex = this.messages.length;
    this.messages.push({
      sender: 'assistant',
      text: '',
      sources: [],
      isStreaming: true,
      relatedUserQuery: query,
      filters: { ...this.activeFilter },
      lessonId: this.activeFilter.lessonId,
      lessonIds: this.activeFilter.lessonIds ? [...this.activeFilter.lessonIds] : undefined
    });

    await this.copilotService.streamSearch(
      query,
      this.activeFilter.lessonId,
      (sources: CopilotSource[]) => {
        this.messages[assistantMsgIndex].sources = this.deduplicateSources(sources);
      },
      (token: string) => {
        this.messages[assistantMsgIndex].text += token;
      },
      (meta?: any) => {
        this.messages[assistantMsgIndex].isStreaming = false;
        this.messages[assistantMsgIndex].isRetrying = false;
        this.isStreaming = false;
        if (meta?.thread_id) {
          this.messages[assistantMsgIndex].threadId = meta.thread_id;
        }
        if (meta) {
          this.messages[assistantMsgIndex].cacheHit = meta.cache_hit ?? false;
          this.messages[assistantMsgIndex].provenance = meta.provenance;
          this.messages[assistantMsgIndex].latencyMs = meta.metrics?.total_latency_ms ?? meta.latency_ms;
        }
      },
      (err: any) => {
        this.messages[assistantMsgIndex].text += '\n\n⚠️ تعذر إكمال الإجابة. يرجى التأكد من تشغيل محرك الذكاء الاصطناعي.';
        this.messages[assistantMsgIndex].isStreaming = false;
        this.messages[assistantMsgIndex].isRetrying = false;
        this.isStreaming = false;
      },
      skipCache,
      this.activeFilter
    );
  }

  /**
   * Retries the answer for a specific assistant message at msgIndex,
   * bypassing both Exact Cache and Semantic Cache (skip_cache: true).
   */
  async retryMessage(msgIndex: number) {
    const msg = this.messages[msgIndex];
    if (!msg || this.isStreaming || msg.isStreaming) return;

    const userQuery = msg.relatedUserQuery;
    if (!userQuery) return;

    // Reset assistant message in-place (clean slate for new answer)
    msg.text = '';
    msg.sources = [];
    msg.rating = null;
    msg.feedbackSubmitted = false;
    msg.feedbackComment = '';
    msg.showCommentBox = false;
    msg.selectedReasonTag = undefined;
    msg.isStreaming = true;
    msg.isRetrying = true;
    msg.threadId = undefined;

    console.info('%c[CoPilot] RETRY', 'color:#f59e0b;font-weight:bold', { userQuery, msgIndex });

    this.isStreaming = true;

    await this.copilotService.streamSearch(
      userQuery,
      msg.lessonId,
      (sources) => { msg.sources = this.deduplicateSources(sources); },
      (token) => { msg.text += token; },
      (meta?: any) => {
        msg.isStreaming = false;
        msg.isRetrying = false;
        this.isStreaming = false;
        if (meta?.thread_id) msg.threadId = meta.thread_id;
        if (meta) {
          msg.cacheHit = meta.cache_hit ?? false;
          msg.provenance = meta.provenance;
          msg.latencyMs = meta.metrics?.total_latency_ms ?? meta.latency_ms;
        }
      },
      (err) => {
        msg.text += '\n\n⚠️ تعذر إعادة المحاولة.';
        msg.isStreaming = false;
        msg.isRetrying = false;
        this.isStreaming = false;
      },
      true,   // skip_cache = true
      msg.filters || this.activeFilter
    );
  }

  /**
   * Admin-only: clears both Exact Cache and Semantic Cache in the Python AI engine.
   */
  clearAiCache() {
    if (this.isClearingCache) return;
    this.isClearingCache = true;
    this.clearCacheStatus = 'idle';

    this.copilotService.clearAiCache().subscribe({
      next: (res) => {
        this.isClearingCache = false;
        this.clearCacheStatus = 'success';
        console.info('[CoPilot Admin] Cache cleared:', res.message);
        setTimeout(() => this.clearCacheStatus = 'idle', 4000);
      },
      error: (err) => {
        this.isClearingCache = false;
        this.clearCacheStatus = 'error';
        console.error('[CoPilot Admin] Cache clear failed:', err);
        setTimeout(() => this.clearCacheStatus = 'idle', 4000);
      }
    });
  }

  /**
   * Predefined quick reason chips for downvoting.
   */
  readonly feedbackReasons: string[] = [
    'معلومات غير دقيقة',
    'شرح ناقص أو غير مكتمل',
    'مصادر غير مطابقة',
    'لم تجب على سؤالي'
  ];

  /**
   * Allows toggling and switching between thumbs up and down.
   */
  toggleRating(msgIndex: number, newRating: 'UP' | 'DOWN') {
    const msg = this.messages[msgIndex];
    if (msg.isSubmittingFeedback) return;

    if (newRating === 'UP') {
      // User clicked thumbs up
      msg.showCommentBox = false;
      msg.rating = 'UP';
      this.submitFeedback(msgIndex, 'UP', '');
    } else {
      // User clicked thumbs down
      msg.rating = 'DOWN';
      msg.showCommentBox = true;
      if (!msg.feedbackComment) {
        msg.feedbackComment = '';
      }
    }
  }

  /**
   * Fast select reason chip for feedback.
   */
  selectReasonChip(msgIndex: number, reason: string) {
    const msg = this.messages[msgIndex];
    if (msg.selectedReasonTag === reason) {
      msg.selectedReasonTag = undefined;
      msg.feedbackComment = '';
    } else {
      msg.selectedReasonTag = reason;
      msg.feedbackComment = reason;
    }
  }

  /**
   * Submits downvote feedback with optional comment or skips comment.
   */
  submitDownvote(msgIndex: number, skipComment: boolean = false) {
    const msg = this.messages[msgIndex];
    const comment = skipComment ? '' : (msg.feedbackComment || '').trim();
    msg.showCommentBox = false;
    this.submitFeedback(msgIndex, 'DOWN', comment);
  }

  /**
   * Closes the comment popover without revoking the downvote.
   */
  closeCommentBox(msgIndex: number) {
    const msg = this.messages[msgIndex];
    msg.showCommentBox = false;
  }

  /**
   * Dispatches the feedback request to the backend.
   */
  private submitFeedback(msgIndex: number, rating: 'UP' | 'DOWN', comment: string) {
    const msg = this.messages[msgIndex];
    msg.isSubmittingFeedback = true;

    // Find the prior user query
    let userQuery = '';
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (this.messages[i].sender === 'user') {
        userQuery = this.messages[i].text;
        break;
      }
    }

    const payload: CopilotFeedbackRequest = {
      query: userQuery || 'استفسار عام',
      answer: msg.text,
      rating: rating,
      comment: comment || undefined,
      lesson_id: msg.lessonId || undefined,
      thread_id: msg.threadId || undefined,
      sources: msg.sources || []
    };

    this.copilotService.sendFeedback(payload).subscribe({
      next: () => {
        msg.feedbackSubmitted = true;
        msg.isSubmittingFeedback = false;
      },
      error: (err) => {
        console.warn('[CoPilot Feedback] Error submitting feedback', err);
        msg.feedbackSubmitted = true;
        msg.isSubmittingFeedback = false;
      }
    });
  }
}

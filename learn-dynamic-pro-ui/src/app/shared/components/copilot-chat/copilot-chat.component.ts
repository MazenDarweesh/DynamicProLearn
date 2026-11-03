import { Component, inject, ElementRef, ViewChild, AfterViewChecked, OnDestroy, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, ChangeDetectorRef, booleanAttribute, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { Subscription, timer } from 'rxjs';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { CopilotService, CopilotSource, CopilotFeedbackRequest, CopilotFilterState, CopilotFormFillData, AgentStepItem } from '../../../core/services/copilot.service';
import { ErpFormDriverService, normalizeArabicText } from '../../../core/services/erp-form-driver.service';
import { ErpBatchStepperService } from '../../../core/services/erp-batch-stepper.service';
import { ErpNavigatorService } from '../../../core/services/erp-navigator.service';
import { ErpBridgeService } from '../../../core/services/erp-bridge.service';
import { ErpTelemetryService } from '../../../core/services/erp-telemetry.service';
import { FormFillExecutionReport, FormFieldSchema, ErpBatchItem, NavScored } from '../../../core/models/erp-form.models';
import { AuthService } from '../../../core/services/auth.service';
import { CopilotTopFilterBarComponent } from '../copilot-top-filter-bar/copilot-top-filter-bar.component';
import { CopilotHeaderComponent } from '../copilot-header/copilot-header.component';

export interface AgentExecutionState {
  isActive: boolean;
  goal: string;
  steps: AgentStepItem[];
  currentStatus: string;
  error?: string;
  isComplete?: boolean;
}

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
  /** In-DOM Form Fill payload extracted by AI */
  formFillData?: CopilotFormFillData;
  /** Whether the user clicked apply and values were injected into the host DOM */
  formFillApplied?: boolean;
  /** Structured execution report from ErpFormDriver */
  formFillReport?: FormFillExecutionReport;
  /** Whether batch stepper execution was triggered for this message */
  batchExecutionActive?: boolean;
  /** ID of AI routing decision for user confirmation feedback */
  decisionId?: string | null;
  /** Interactive navigation options suggested when intent is ambiguous (decision: 'ask') */
  askOptions?: NavScored[];
  /** Save lifecycle after the form was filled (manual confirm or optional auto-save) */
  saveStatus?: 'saving' | 'saved' | 'failed';
  /** User-facing result of the save attempt */
  saveMessage?: string;
  /** Immediate debouncing and loading state when user clicks apply button */
  isApplyingFormFill?: boolean;
  /** Vision / CDP Agent live execution stream state */
  agentExecution?: AgentExecutionState;
  /** Dual-path escalation: suggest launching Vision Agent when form is not currently open in DOM */
  canEscalateToVisionAgent?: boolean;
  escalationGoal?: string;
}

@Component({
  selector: 'app-copilot-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownComponent, CdkDrag, CdkDragHandle, CopilotTopFilterBarComponent, CopilotHeaderComponent],
  templateUrl: './copilot-chat.component.html',
  styleUrls: ['./copilot-chat.component.css']
})
export class CopilotChatComponent implements OnInit, OnChanges, AfterViewChecked, OnDestroy {
  private copilotService = inject(CopilotService);
  private formDriver = inject(ErpFormDriverService);
  private navigator = inject(ErpNavigatorService);
  private bridge = inject(ErpBridgeService);
  private telemetry = inject(ErpTelemetryService, { optional: true });
  batchStepper = inject(ErpBatchStepperService);
  /** Optional: when on, saves right after a clean (fully filled) form fill. Off by default. */
  autoSaveAfterFill = false;
  private router = inject(Router, { optional: true });
  private cdr = inject(ChangeDetectorRef);
  private elRef = inject(ElementRef);
  authService = inject(AuthService);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  @Input() erpKey?: string;
  @Input() activeScreenKey?: string;
  @Input() activeLessonId?: string;
  @Input() lmsPageId?: string;
  @Input() token?: string;
  @Input() u?: string;
  @Input() p?: string;
  @Input() apiUrl?: string;
  @Input() backendUrl?: string;
  @Input({ transform: booleanAttribute }) hideHeader: boolean = false;
  @Input({ transform: booleanAttribute }) inline: boolean = false;

  @HostBinding('class.inline-host') get isInlineHost(): boolean {
    return this.inline;
  }

  @Output() lessonNavigate = new EventEmitter<{ lessonId?: string; videoUrl?: string; timestamp?: number }>();

  isOpen = true;
  isMinimized = false;
  inputQuery = '';
  isStreaming = false;
  isClearingCache = false;
  clearCacheStatus: 'idle' | 'success' | 'error' = 'idle';

  // ── Mode State (Mutually Exclusive: Q&A default | Action ⚡ | Vision 👁️) ──
  isActionMode = false;
  isVisionAgentMode = false;
  cdpPort = 9222;
  cdpHost = typeof localStorage !== 'undefined' ? (localStorage.getItem('copilot_cdp_host') || '127.0.0.1') : '127.0.0.1';

  get currentModeKey(): string {
    if (this.isVisionAgentMode) return 'mode-vision';
    if (this.isActionMode) return 'mode-action';
    return 'mode-qa';
  }

  get inputPlaceholder(): string {
    if (this.isVisionAgentMode) {
      return 'اكتب هدفك للوكيل البصري (مثال: اشتر 10 سن من المورد حسين)...';
    }
    if (this.isActionMode) {
      return 'اكتب أمراً لتنفيذه مباشرة في شاشات النظام (مثال: سجل فاتورة مبيعات...)...';
    }
    if (this.hasConnectionError && !this.isAiReady) {
      return 'تعذر الاتصال بالمحرك، انقر إعادة الاتصال أعلاه...';
    }
    if (this.isWarmingUp) {
      return 'جاري تهيئة المحرك، يُرجى الانتظار لحظات...';
    }
    return 'اسأل أي سؤال عن النظام أو شروحات المحاضرات (أو فعّل ⚡ للتنفيذ)...';
  }

  // ── Smart Top Filter Bar State ───────────────────────────────────────────
  activeFilter: CopilotFilterState = { scope: 'all' };
  isFilterBarCollapsed = false;
  private lessonSub?: Subscription;

  isAiReady = true;
  isWarmingUp = false;
  hasConnectionError = false;
  currentAttempt = 0;
  readonly maxAttempts = 5;
  private readinessSub?: Subscription;

  isEmbedded = false;
  isAuthenticating = false;
  authError: string | null = null;

  get isAdmin(): boolean {
    return this.authService.userRole() === 'Admin';
  }

  get isLoggedIn(): boolean {
    // In embedded / inline Web Component mode, never hide based on host app URL!
    if (this.isEmbedded || this.inline) {
      return true;
    }
    const url = this.router?.url || '';
    const isAuthRoute = url.includes('/login') || url.includes('/erp-redirect');
    return this.authService.isAuthenticated() && !isAuthRoute;
  }

  get shouldRenderComponent(): boolean {
    // In embedded / inline mode, always render into the DOM, never hide based on window.location
    if (this.isEmbedded || this.inline) {
      return true;
    }
    return this.isLoggedIn;
  }

  messages: ChatMessage[] = [
    {
      sender: 'assistant',
      text: 'مرحباً بك! أنا مساعدك الذكي في منصة DynamicProLearn. اسألني أي سؤال عن دروس وموديولات النظام وسأجيبك مباشرة من واقع الفيديوهات والمحتوى التعليمي! ✨'
    }
  ];

  ngOnInit() {
    this.readAttributesFromHost();
    this.detectEmbeddedMode();
    this.applyInputs();
    this.setupAttributeObserver();
    this.lessonSub = this.copilotService.activeLessonId$.subscribe(lessonId => {
      if (lessonId) {
        this.activeLessonId = lessonId;
      }
    });
    this.detectLessonFromRoute();
    this.checkAiReadiness();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['token'] || changes['apiUrl'] || changes['backendUrl'] || changes['erpKey'] || changes['lmsPageId'] || changes['u'] || changes['p'] || changes['inline'] || changes['hideHeader']) {
      this.readAttributesFromHost();
      this.applyInputs();
      if (changes['apiUrl']) {
        this.checkAiReadiness();
      }
    }
  }

  private attrObserver?: MutationObserver;

  private readAttributesFromHost() {
    const hostEl: HTMLElement = this.elRef?.nativeElement;
    if (!hostEl || !hostEl.getAttribute) return;

    const getAttr = (kebab: string, camel: string) => {
      const val = hostEl.getAttribute(kebab) || hostEl.getAttribute(camel);
      return val ? val.trim() : undefined;
    };

    const clean = (val?: string) => {
      if (!val) return undefined;
      return val.trim().replace(/[<>]/g, '');
    };

    this.apiUrl = clean(this.apiUrl || getAttr('api-url', 'apiUrl'));
    this.backendUrl = clean(this.backendUrl || getAttr('backend-url', 'backendUrl'));
    this.erpKey = clean(
      this.erpKey ||
      this.activeScreenKey ||
      getAttr('active-screen-key', 'activeScreenKey') ||
      getAttr('erp-key', 'erpKey') ||
      getAttr('active-screen', 'activeScreen')
    );
    this.lmsPageId = clean(this.lmsPageId || getAttr('lms-page-id', 'lmsPageId'));
    this.u = clean(this.u || getAttr('u', 'u'));
    this.p = clean(this.p || getAttr('p', 'p'));
    this.token = clean(this.token || getAttr('token', 'token'));

    const hideHeaderAttr = getAttr('hide-header', 'hideHeader');
    if (hideHeaderAttr != null) {
      this.hideHeader = hideHeaderAttr === 'true' || hideHeaderAttr === '';
    }
    const inlineAttr = getAttr('inline', 'inline');
    if (inlineAttr != null) {
      this.inline = inlineAttr === 'true' || inlineAttr === '';
    }
  }

  private setupAttributeObserver() {
    const hostEl: HTMLElement = this.elRef?.nativeElement;
    if (!hostEl || typeof MutationObserver === 'undefined') return;

    this.attrObserver = new MutationObserver(() => {
      this.readAttributesFromHost();
      this.applyInputs();
      this.checkAiReadiness();
    });

    this.attrObserver.observe(hostEl, {
      attributes: true,
      attributeFilter: [
        'api-url', 'apiUrl', 'backend-url', 'backendUrl',
        'erp-key', 'erpKey', 'active-screen-key', 'activeScreenKey', 'active-screen', 'activeScreen',
        'lms-page-id', 'lmsPageId', 'u', 'p', 'token', 'hide-header', 'inline'
      ]
    });
  }

  private detectEmbeddedMode() {
    const hostEl: HTMLElement = this.elRef?.nativeElement;
    if (!hostEl) return;

    const tagName = hostEl.tagName?.toLowerCase() || '';
    const parent = hostEl.parentElement;
    const parentTag = parent?.tagName?.toLowerCase() || '';

    // If hosted as Web Component (<lms-ai-copilot> or <app-lms-copilot>) or inside an ERP container
    const isCustomElement = tagName.includes('lms-copilot') || tagName.includes('ai-copilot') || tagName.includes('lms-ai');
    const isInsideContainer = !!(parent && parentTag !== 'body' && parentTag !== 'app-root');
    const hasEmbeddedFlag = !!(window as any)?.__LMS_COPILOT_EMBEDDED__ || !!(window as any)?.__ERP_HOST__;

    if (isCustomElement || isInsideContainer || this.inline || hasEmbeddedFlag) {
      this.isEmbedded = true;
      this.inline = true;
      hostEl.style.display = 'flex';
      hostEl.style.flexDirection = 'column';
      hostEl.style.width = '100%';
      hostEl.style.height = '100%';
      hostEl.style.flex = '1';
      hostEl.style.minHeight = '0';

      // Defensive: stretch all intermediate parent wrappers up to the window container
      let current: HTMLElement | null = parent;
      while (current && current.tagName.toLowerCase() !== 'body' && current.tagName.toLowerCase() !== 'app-root') {
        if (current.classList.contains('ai-chat-window')) {
          break;
        }
        current.style.flex = '1';
        current.style.display = 'flex';
        current.style.flexDirection = 'column';
        current.style.minHeight = '0';
        current.style.height = '100%';
        current.style.overflow = 'hidden';
        current = current.parentElement;
      }

      // If ERP has its own header (.ai-chat-header), hide internal copilot header
      const hasOuterHeader = !!(
        parent?.closest?.('.ai-chat-window') ||
        parent?.querySelector?.('.ai-chat-header') ||
        parent?.parentElement?.querySelector?.('.ai-chat-header')
      );
      if (hasOuterHeader) {
        this.hideHeader = true;
      }
    }
  }

  private applyInputs() {
    if (this.lmsPageId) {
      if (!this.erpKey) this.erpKey = this.lmsPageId;
      if (!this.activeLessonId) this.activeLessonId = this.lmsPageId;
    }
    this.detectEmbeddedMode();

    if (this.backendUrl) {
      this.authService.setBackendUrl(this.backendUrl);
    }
    if (this.apiUrl || this.backendUrl) {
      this.copilotService.setBaseUrls(this.apiUrl, this.backendUrl);
    }
    if (this.token) {
      this.authService.login(this.token);
      this.isAuthenticating = false;
      this.authError = null;
    } else if (this.u && this.p && !this.authService.isAuthenticated()) {
      this.performErpLogin(this.u, this.p, this.erpKey || null);
    }
  }

  performErpLogin(u: string, p: string, erpKey: string | null) {
    this.isAuthenticating = true;
    this.authError = null;
    this.cdr.markForCheck();

    this.authService.erpLogin(u, p, erpKey).subscribe({
      next: (res: any) => {
        this.authService.login(res.token, res.refreshToken);
        if (res.erpRedirect?.lessonId) {
          this.activeLessonId = res.erpRedirect.lessonId;
        }
        this.isAuthenticating = false;
        this.authError = null;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.warn('[CopilotChat] Silent ERP Login failed:', err);
        this.isAuthenticating = false;
        this.authError = 'تعذر تسجيل الدخول التلقائي مع الـ ERP. يرجى التحقق من بيانات الاتصال أو خادم الـ API.';
        this.cdr.markForCheck();
      }
    });
  }

  retryAuth() {
    if (this.u && this.p) {
      this.performErpLogin(this.u, this.p, this.erpKey || null);
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.attrObserver?.disconnect();
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
      const url = this.router?.url || '';
      const queryParams = new URLSearchParams(window.location.search);

      // Check ERP Key query param (?erpKey=... or ?key=...)
      const queryErpKey = queryParams.get('erpKey') || queryParams.get('key');
      if (queryErpKey && !this.erpKey) {
        this.erpKey = queryErpKey;
      }

      // Check silent ERP handshake credentials (?u=...&p=...)
      const u = queryParams.get('u');
      const p = queryParams.get('p');
      if (u && p && !this.authService.isAuthenticated()) {
        this.performErpLogin(u, p, queryErpKey || null);
      }

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
    if (!this.isMinimized) {
      this.detectLessonFromRoute();
      this.checkAiReadiness();
    }
  }

  closeChat() {
    this.isMinimized = true;
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
    } catch (err) { }
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

  toggleActionMode(): void {
    this.isActionMode = !this.isActionMode;
    if (this.isActionMode) {
      this.isVisionAgentMode = false;
    }
    this.cdr.markForCheck();
  }

  toggleVisionAgentMode(): void {
    this.isVisionAgentMode = !this.isVisionAgentMode;
    if (this.isVisionAgentMode) {
      this.isActionMode = false;
    }
    this.cdr.markForCheck();
  }

  async sendMessage(skipCache: boolean = false) {
    const query = this.inputQuery.trim();
    if (!query || this.isStreaming || !this.isAiReady) return;

    const isAgentSlash = /^\/(agent|vision|cdp)\s*/i.test(query);
    if (isAgentSlash || this.isVisionAgentMode) {
      this.inputQuery = '';
      await this.runVisionAgent(query, this.cdpPort, this.cdpHost);
      return;
    }

    const currentMode = this.isVisionAgentMode ? 'vision' : (this.isActionMode ? 'action' : 'qa');
    this.telemetry?.log('USER_QUERY', `User: "${query}"`, {
      query,
      skipCache,
      screenKey: this.erpKey,
      mode: currentMode
    });

    // Add user message
    this.messages.push({
      sender: 'user',
      text: query
    });

    this.inputQuery = '';
    await this.streamQuery(query, skipCache);
  }

  /**
   * Executes autonomous Vision Agent loop via CDP over SSE.
   * Directly interfaces with Google Gemini 2.0 Multimodal Grounding Engine.
   */
  async runVisionAgent(goal: string, cdpPort: number = 9222, cdpHost?: string) {
    let cleanGoal = goal.replace(/^\/(agent|vision|cdp)\s*/i, '').trim();
    if (!cleanGoal || this.isStreaming) return;

    let host = (cdpHost || this.cdpHost || '127.0.0.1').trim();
    // Allow user to supply tunnel URL directly: /agent https://xxx.devtunnels.ms <goal>
    const hostPrefixMatch = cleanGoal.match(/^(https?:\/\/[^\s]+)\s+(.+)$/i);
    if (hostPrefixMatch) {
      host = hostPrefixMatch[1].trim();
      cleanGoal = hostPrefixMatch[2].trim();
    }

    this.cdpHost = host;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('copilot_cdp_host', host);
    }

    this.isStreaming = true;
    this.telemetry?.log('GENERAL', `Vision Agent goal: "${cleanGoal}"`, { goal: cleanGoal, cdpPort, cdpHost: host });

    this.messages.push({
      sender: 'user',
      text: `👁️ [أتمتة بصرية]: ${cleanGoal}`
    });

    const assistantMsg: ChatMessage = {
      sender: 'assistant',
      text: `🚀 جاري تشغيل الأتمتة البصرية (Vision Agent) عبر CDP للهدف: "${cleanGoal}"...`,
      agentExecution: {
        isActive: true,
        goal: cleanGoal,
        steps: [],
        currentStatus: `جاري الاتصال بالمتصفح عبر ${host}:${cdpPort}...`
      }
    };
    this.messages.push(assistantMsg);
    this.cdr.detectChanges();
    this.scrollToBottom();

    const sessId = this.telemetry?.getSessionId();

    await this.copilotService.streamAgentExecution(
      cleanGoal,
      cdpPort,
      host,
      15,
      sessId,
      (stepItem) => {
        if (!assistantMsg.agentExecution) return;
        assistantMsg.agentExecution.steps.push(stepItem);
        assistantMsg.agentExecution.currentStatus = stepItem.message || stepItem.thought || stepItem.status;

        // 📡 تسجيل الخطوة لحظياً في الصندوق الأسود (ErpTelemetryService)
        this.telemetry?.log(
          'GENERAL',
          `[Vision Step ${stepItem.step}] ${stepItem.status}: ${stepItem.message || ''}`,
          {
            step: stepItem.step,
            status: stepItem.status,
            action: stepItem.action,
            coordinate: stepItem.coordinate,
            thought: stepItem.thought,
            cdpHost: host,
            cdpPort
          },
          stepItem.status === 'error' ? 'ERROR' : 'INFO'
        );

        if (stepItem.status === 'error') {
          assistantMsg.agentExecution.error = stepItem.message;
          assistantMsg.agentExecution.isActive = false;
        } else if (stepItem.status === 'completed') {
          assistantMsg.agentExecution.isComplete = true;
          assistantMsg.agentExecution.isActive = false;
        }
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
      (lastStep) => {
        if (assistantMsg.agentExecution) {
          assistantMsg.agentExecution.isActive = false;
          if (!assistantMsg.agentExecution.isComplete && !assistantMsg.agentExecution.error) {
            assistantMsg.agentExecution.isComplete = true;
          }
        }
        this.isStreaming = false;
        this.telemetry?.flush();
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
      (err) => {
        if (assistantMsg.agentExecution) {
          assistantMsg.agentExecution.isActive = false;
          assistantMsg.agentExecution.error = err?.message || 'حدث خطأ أثناء الاتصال بالوكيل البصري.';
        }
        this.isStreaming = false;
        this.telemetry?.log('ERROR', `Vision Agent stream failed: ${err?.message || err}`, { error: String(err) });
        this.telemetry?.flush();
        this.cdr.detectChanges();
        this.scrollToBottom();
      }
    );
  }

  /**
   * Stops the ongoing Vision Agent execution immediately.
   */
  stopVisionAgent(msg?: ChatMessage) {
    console.info('[Copilot] Stop Vision Agent requested by user.');
    this.copilotService.stopAgentExecution();
    if (msg && msg.agentExecution) {
      msg.agentExecution.isActive = false;
      msg.agentExecution.error = '🛑 تم إيقاف التنفيذ يدوياً بواسطة المستخدم.';
      msg.agentExecution.currentStatus = 'توقف العميل.';
    }
    this.isStreaming = false;
    this.telemetry?.log('GENERAL', 'Vision Agent stopped by user', {}, 'WARN');
    this.telemetry?.flush();
    this.cdr.detectChanges();
  }

  /**
   * Executes the transaction goal directly in the current page via In-DOM automation,
   * completely bypassing CDP and external browser debugging requirements.
   */
  async executeGoalInCurrentDom(goal?: string) {
    if (!goal || this.isStreaming) return;
    this.isVisionAgentMode = false;
    this.isActionMode = true;
    await this.streamQuery(goal, false);
  }

  formatAgentAction(action?: string): string {
    switch (action) {
      case 'click': return '🖱️ نقر بالماوس';
      case 'type': return '✍️ كتابة نص';
      case 'press_key': return '⌨️ ضغط مفتاح';
      case 'wait': return '⏳ انتظار المزامنة';
      case 'done': return '✅ اكتمال المهمة';
      default: return action ? `⚙️ ${action}` : '👁️ تحليل بصري';
    }
  }

  /**
   * Inspects host ERP DOM using ErpFormDriverService to gather active input fields and schemas.
   */
  collectVisibleFormFields(): string[] {
    if (typeof document === 'undefined') return [];
    try {
      const schemas = this.formDriver.collectFormSchema(this.elRef?.nativeElement);
      return this.formDriver.buildVisibleFieldsSummary(schemas);
    } catch (e) {
      console.warn('[Copilot FormFill] Failed to inspect DOM fields:', e);
      return [];
    }
  }

  /**
   * Injects extracted values into host ERP elements sequentially via ErpFormDriverService.
   * Handles text, number, date, checkbox, ng-select, native selects, and calculated total fields.
   */
  async applyFormFill(msg: ChatMessage): Promise<void> {
    if (!msg.formFillData || typeof document === 'undefined' || msg.isApplyingFormFill) return;

    msg.isApplyingFormFill = true;
    this.cdr.detectChanges();

    const targetScreen = msg.formFillData.screenKey;
    this.telemetry?.log('FILL', `User clicked Apply Form Fill for '${targetScreen || this.erpKey}'`, {
      screenKey: targetScreen || this.erpKey,
      fields: msg.formFillData.fields,
      rows: msg.formFillData.rows
    });

    try {
      // 🚀 Safety Guard: Ensure ERP does not navigate away if already on matching domain screen!
      const currentActive = this.bridge.getActiveScreen()?.pageName || this.erpKey || '';
      const currentActiveNorm = currentActive.trim().toLowerCase();
      const targetNorm = (targetScreen || '').trim().toLowerCase();

      // If active screen is already in the same domain (e.g. both are purchases, sales, or entries)
      const isBothPurchases = currentActiveNorm.includes('purchas') && targetNorm.includes('purchas');
      const isBothSales = currentActiveNorm.includes('sale') && targetNorm.includes('sale');
      const isBothEntries = currentActiveNorm.includes('entry') && targetNorm.includes('entry');

      let effectiveTarget = targetScreen;
      if (targetScreen && !this.navigator.isScreenActive(targetScreen)) {
        if (isBothPurchases || isBothSales || isBothEntries) {
          console.info(
            `%c[Copilot FormFill] User is already on '${currentActive}'. Retaining active screen instead of switching to '${targetScreen}'`,
            'color:#10b981;font-weight:bold'
          );
          effectiveTarget = currentActive;
        } else {
          console.info('%c[Copilot FormFill] Screen mismatch detected! Switching to:', 'color:#3b82f6;font-weight:bold', targetScreen);
          await this.navigator.navigateToScreen(targetScreen);
          await this.formDriver.settle(undefined, { quietMs: 60, maxMs: 500 });
        }
      }
      this.syncErpKey(effectiveTarget || currentActive);

      // Ensure form entry is prepared/opened if currently on a list view
      await this.navigator.prepareFreshForm();

      const report = await this.formDriver.applyProgressiveFill(
        msg.formFillData.fields,
        msg.formFillData.rows,
        this.elRef?.nativeElement,
        this.copilotService,
        msg.relatedUserQuery
      );

      msg.formFillApplied = report.success;
      msg.formFillReport = report;
      this.cdr.markForCheck();
      console.info('%c[Copilot FormFill] Execution report:', 'color:#10b981;font-weight:bold', report);

      this.telemetry?.log('FILL', `applyFormFill finished with success=${report.success} (${report.filledCount} fields filled)`, {
        success: report.success,
        filledCount: report.filledCount,
        fieldsProcessed: report.fieldsProcessed,
        results: report.results
      });

      // 🧠 Train Decision Memory: If navigation decision was attached and fill succeeded, confirm to backend
      if (report.success && msg.decisionId && this.copilotService) {
        this.copilotService.feedbackErpNavigation(msg.decisionId, 'applied');
      }

      // 💾 Optional auto-save: only if every requested field was filled cleanly
      const hasUnresolved = report.results.some(r => r.status === 'not_found' || r.status === 'ambiguous');
      if (this.autoSaveAfterFill && report.success && !hasUnresolved) {
        await this.confirmSave(msg);
      }
    } catch (err) {
      console.error('[Copilot FormFill] Execution error:', err);
      this.telemetry?.logError('FILL', 'applyFormFill threw exception', err);
    } finally {
      msg.isApplyingFormFill = false;
      this.cdr.detectChanges();
    }
  }


  /**
   * Saves the currently open ERP form through the official bridge.
   * Triggered only by the user's explicit click or by the opt-in auto-save toggle.
   */
  async confirmSave(msg: ChatMessage): Promise<void> {
    if (msg.saveStatus === 'saving' || msg.saveStatus === 'saved') return;

    msg.saveStatus = 'saving';
    msg.saveMessage = undefined;
    this.cdr.markForCheck();

    if (!this.bridge.isAvailable) {
      msg.saveStatus = 'failed';
      msg.saveMessage = 'جسر الـ ERP غير متاح هنا. اضغط زر الحفظ يدوياً داخل الشاشة.';
      this.cdr.markForCheck();
      return;
    }

    const res = await this.bridge.submitActiveForm();
    if (res.success) {
      msg.saveStatus = 'saved';
      msg.saveMessage = res.docId
        ? `✅ تم الحفظ بنجاح في نظام الـ ERP! رقم المستند: #${res.docId}`
        : (res.message || '✅ تم إرسال أمر الحفظ بنجاح إلى الـ ERP.');
    } else {
      msg.saveStatus = 'failed';
      if (res.errors && res.errors.length > 0) {
        msg.saveMessage = `⚠️ لم يتم الحفظ لوجود حقول إلزامية ناقصة: ${res.errors.join('، ')}`;
      } else {
        msg.saveMessage = res.message || '⚠️ تعذر إرسال أمر الحفظ. راجع الحقول في الشاشة ثم اضغط حفظ يدوياً.';
      }
    }
    console.info('[Copilot Save] submitActiveForm result:', res);
    this.cdr.markForCheck();
  }


  /**
   * Keeps erpKey aligned with the real active ERP screen (bridge) instead of temporary DOM ids.
   */
  private syncErpKey(fallback?: string): void {
    const next = this.bridge.getActiveScreen()?.pageName || fallback;
    if (next) this.erpKey = next;
  }

  /**
   * Starts sequential batch stepper loop for multi-document extractions.
   */
  async startBatchExecution(msg: ChatMessage, autoAdvance = false): Promise<void> {
    const items = msg.formFillData?.batch_items;
    if (!items || items.length === 0) return;

    const targetScreen = msg.formFillData?.screenKey || this.erpKey;
    if (targetScreen && !this.navigator.isScreenActive(targetScreen)) {
      console.info('%c[Copilot Batch] Screen mismatch! Navigating to:', 'color:#3b82f6;font-weight:bold', targetScreen);
      await this.navigator.navigateToScreen(targetScreen);
      this.syncErpKey(targetScreen);
      await this.formDriver.settle(undefined, { quietMs: 350, maxMs: 1500 });
    }

    msg.batchExecutionActive = true;
    this.batchStepper.startBatch(
      items,
      targetScreen,
      autoAdvance
    );
    this.cdr.markForCheck();
  }

  /**
   * Helper to resolve batch items list safely for template rendering
   */
  getBatchItems(msg: ChatMessage): ErpBatchItem[] {
    if (msg.batchExecutionActive) {
      return this.batchStepper.state().items;
    }
    return (msg.formFillData?.batch_items || []) as ErpBatchItem[];
  }

  /**
   * Checks whether form fill data actually contains actionable fields, rows, or batch items.
   * Prevents displaying empty proposal cards when no data was extracted.
   */
  hasFormFillData(msg: ChatMessage): boolean {
    return !!msg.formFillData && this.isValidFormFill(msg.formFillData);
  }

  isValidFormFill(data?: CopilotFormFillData): boolean {
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
      data.rows.some((row) =>
        Object.values(row).some((val) => val != null && String(val).trim() !== '')
      );

    return hasFields || hasRows;
  }

  async selectAskOption(option: NavScored, originalQuery?: string) {
    console.info('%c[Copilot Navigation] User clicked ambiguity chip:', 'color:#3b82f6;font-weight:bold', option);
    this.isActionMode = true;
    await this.navigator.navigateToScreen(option.id);
    this.syncErpKey(option.id);
    // 2. Wait for DOM to settle
    await this.formDriver.settle(undefined, { quietMs: 250, maxMs: 2500, minMs: 120 });
    // 3. Re-run streamQuery on the newly selected screen
    if (originalQuery) {
      await this.streamQuery(originalQuery, true, true);
    }
  }

  getScreenDisplayName(key: string): string {
    const map: Record<string, string> = {
      'PURCHASE_INVOICE': 'فاتورة المشتريات',
      'SALES_INVOICE': 'فاتورة المبيعات',
      'NEW_CUSTOMER': 'تسجيل عميل جديد',
      'JOURNAL_ENTRY': 'قيود اليومية العامة',
      'INVENTORY_AUDIT': 'الجرد والتسويات المخزنية'
    };
    return map[key] || key;
  }

  /** Core stream method — shared by sendMessage() and retryMessage() */
  private async streamQuery(query: string, skipCache: boolean = false, skipNavCheck: boolean = false) {
    this.isStreaming = true;

    let pendingAskOptions: NavScored[] | undefined = undefined;
    let resolvedIntent: string | undefined = undefined;
    let resolvedDecisionId: string | null | undefined = undefined;
    let visibleFields: string[] | undefined = undefined;
    let formSchema: any[] | undefined = undefined;
    let shouldOfferVisionEscalation = false;

    if (this.isActionMode) {
      // 0. Autonomous ERP Navigation: Check if user intent targets a specific/different ERP screen
      const activeScreen = this.bridge.getActiveScreen();
      // CRITICAL: Do NOT fall back to stale this.erpKey if activeScreen has empty pageName/screenKey (e.g. on Dashboard/Main screen)
      const activeRaw = (activeScreen?.pageName || activeScreen?.screenKey || '').trim();
      const activeName = activeRaw.toLowerCase();
      const queryNorm = normalizeArabicText(query).toLowerCase();

      // Check domain relevance between query and current active screen
      const isPurchaseQuery =
        queryNorm.includes('مشتريات') ||
        queryNorm.includes('شراء') ||
        queryNorm.includes('فاتورة') ||
        queryNorm.includes('مورد');
      const isCurrentPurchase = !!activeName && (activeName.includes('purchas') || activeName.includes('مشتريات'));

      const isSalesQuery = queryNorm.includes('مبيعات') || queryNorm.includes('بيع') || queryNorm.includes('عميل');
      const isCurrentSales = !!activeName && (activeName.includes('sale') || activeName.includes('مبيعات'));

      const isExplicitNavRequest = /^(افتح|انتقل|اذهب|وديني|روح|شاشة|صفحة)\s+/i.test(query.trim());

      // Only skip navigation if activeName is genuinely present AND confirmed active in the DOM
      const isDomActive = !!activeRaw && (this.navigator.isScreenActive(activeRaw) || this.navigator.isScreenActive(activeName));
      const isAlreadyOnMatchingScreen =
        isDomActive &&
        ((isPurchaseQuery && isCurrentPurchase) || (isSalesQuery && isCurrentSales));

      // If user is already on a matching screen and did NOT explicitly ask to navigate to a different screen:
      if (isAlreadyOnMatchingScreen && !isExplicitNavRequest) {
        console.info(
          `%c[Copilot Navigation] Active screen '${activeName}' already matches query domain and is active in DOM. Staying on current screen!`,
          'color:#10b981;font-weight:bold'
        );
        skipNavCheck = true;
        resolvedIntent = 'action';
      }

      let navRes: any = null;
      if (!skipNavCheck && typeof document !== 'undefined') {
        try {
          navRes = await this.navigator.resolveAndNavigate(query);
          resolvedIntent = navRes?.rawResolution?.intent;
          resolvedDecisionId = navRes?.rawResolution?.decision_id;

          if (navRes?.success && navRes.chosen) {
            console.info('%c[Copilot Navigation] Auto-navigated to target screen:', 'color:#10b981;font-weight:bold', navRes.chosen.id);
            this.syncErpKey(navRes.chosen.id);
            // Wait for DOM & Angular components to settle on the new screen
            await this.formDriver.settle(undefined, { quietMs: 250, maxMs: 2500, minMs: 120 });
          } else if (navRes?.decision === 'ask' && navRes.askOptions && navRes.askOptions.length > 0) {
            console.info('%c[Copilot Navigation] Ambiguous intent -> displaying ask options without blocking stream:', 'color:#f59e0b;font-weight:bold', navRes.askOptions);
            pendingAskOptions = navRes.askOptions;
          }
        } catch (navErr) {
          console.warn('[Copilot Navigation] resolveAndNavigate error:', navErr);
        }
      }

      // S1 Lifecycle Order: If user intent is an action/entry, ensure fresh entry form is prepared/opened first
      // CRITICAL: Only prepare fresh form if we are genuinely on the target screen (already matching or navigated successfully)
      const isOnTargetScreen = skipNavCheck || !!(navRes && navRes.success);
      const isEntryIntent = resolvedIntent === 'action' || (!resolvedIntent && /سجل|اضف|أضف|انشئ|أنشئ|فاتورة|سداد|قيد/i.test(query));
      if (isEntryIntent && isOnTargetScreen && typeof document !== 'undefined') {
        try {
          const formOpened = await this.navigator.prepareFreshForm(2000);
          if (formOpened) {
            await this.formDriver.settle(undefined, { quietMs: 80, maxMs: 800 });
          }
        } catch (formErr) {
          console.warn('[Copilot Navigation] prepareFreshForm during schema preparation error:', formErr);
        }
      }

      // Detect ERP/Host context and gather schema from active page
      const schemas = this.formDriver.collectFormSchema(this.elRef?.nativeElement);
      const detectedFields = this.formDriver.buildVisibleFieldsSummary(schemas);
      visibleFields = detectedFields.length > 0 ? detectedFields : undefined;
      formSchema = schemas.length > 0 ? schemas : undefined;
      shouldOfferVisionEscalation = isEntryIntent && (!visibleFields || visibleFields.length === 0);
      console.info('%c[Copilot FormFill] Active Form Fields Detected:', 'color:#10b981;font-weight:bold', visibleFields);
    } else {
      // 💬 Pure Q&A Mode: Do NOT navigate, do NOT collect schemas, enforce question intent
      resolvedIntent = 'question';
      shouldOfferVisionEscalation = false;
      console.info('%c[Copilot Mode] Pure Educational Q&A Mode active — navigation and form inspection bypassed', 'color:#6366f1;font-weight:bold');
    }
    const assistantMsgIndex = this.messages.length;
    this.messages.push({
      sender: 'assistant',
      text: pendingAskOptions ? 'طلبك يحتمل أكثر من شاشة في النظام، يمكنك اختيار الشاشة المستهدفة أدناه أو متابعة قراءة الإجابة:\n\n' : '',
      sources: [],
      isStreaming: true,
      askOptions: pendingAskOptions,
      canEscalateToVisionAgent: shouldOfferVisionEscalation,
      escalationGoal: shouldOfferVisionEscalation ? query : undefined,
      relatedUserQuery: query,
      decisionId: resolvedDecisionId,
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
        this.telemetry?.logError('USER_QUERY', 'streamSearch error', err);
      },
      skipCache,
      this.activeFilter,
      undefined,
      visibleFields,
      this.erpKey,
      (fillData: CopilotFormFillData) => {
        if (fillData && this.isValidFormFill(fillData)) {
          this.messages[assistantMsgIndex].formFillData = fillData;
          this.telemetry?.log('AI_EXTRACT', `AI extracted form fill proposal for '${fillData.screenKey || this.erpKey}'`, {
            screenKey: fillData.screenKey || this.erpKey,
            fields: fillData.fields,
            rows: fillData.rows
          });
          this.cdr.markForCheck();
        }
      },
      formSchema,
      resolvedIntent
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

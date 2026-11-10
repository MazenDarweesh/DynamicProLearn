import { Component, inject, ElementRef, ViewChild, OnDestroy, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, ChangeDetectorRef, booleanAttribute, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { Subscription, timer } from 'rxjs';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { CopilotService, CopilotSource, CopilotFeedbackRequest, CopilotFilterState, CopilotFormFillData, AgentStepItem } from '../../../core/services/ai-copilot/copilot.service';
import {
  ErpFormDriverService,
  ErpBatchStepperService,
  ErpNavigatorService,
  ErpBridgeService,
  ErpTelemetryService,
  normalizeArabicText,
  detectMissingFieldsFromToastAndDom,
  ErpMissingFieldInfo,
  ErpFormMode,
  ErpFormDiffEntry
} from '../../../core/services/erp-automation';
import {
  buildFormDiffEntries,
  detectUnsupportedEditCommand,
  evaluateSaveGuard,
  extractDocRef,
  isEditExistingFormQuery,
  resolveEditCurrentIntent
} from './utils/erp-save-guard.helper';
import { FormFillExecutionReport, FormFieldSchema, ErpBatchItem, NavScored } from '../../../core/models/erp-form.models';
import { AuthService } from '../../../core/services/platform-core/auth.service';
import { CopilotTopFilterBarComponent } from '../copilot-top-filter-bar/copilot-top-filter-bar.component';
import { CopilotHeaderComponent } from '../copilot-header/copilot-header.component';
import {
  buildCopilotSourceUrl,
  deduplicateCopilotSources,
  formatCopilotSourceLabel,
  formatCopilotTimestamp,
  isValidCopilotFormFill,
  renderCopilotMessageText
} from './utils/copilot-citation.utils';
import {
  applyEmbeddedHostStyles,
  evaluateActiveScreenMatch,
  readHostElementAttributes
} from './utils/copilot-host-bridge.helper';

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
  /** Whether the form entry was already prepared/opened fresh during the intent stream phase */
  formPrepared?: boolean;
  /** Detected host form mode associated with this card */
  targetFormMode?: ErpFormMode;
  /** Open document identifier shown on SavedOpen edit cards */
  targetDocRef?: string;
  /** Forces manual confirmation on the edit card regardless of `autoSaveAfterFill` */
  requiresExplicitUpdateConfirm?: boolean;
  /** Set only when the user explicitly clicks Save on the edit card */
  userConfirmedSavedUpdate?: boolean;
  /** Field/row delta summary for edits against an already-saved document */
  formDiff?: ErpFormDiffEntry[];
  /** True when waiting for user confirmation before discarding an UnsavedDraft */
  requiresDraftResetConfirm?: boolean;
  /** User decision when an UnsavedDraft conflicts with a new-document command */
  draftResetDecision?: 'pending' | 'reset_and_new' | 'keep_draft';
  /** Visible error surfaced when deferred form preparation fails or times out */
  formPrepError?: string;
  /** Visible explanation when an `edit_current` command asks for an unsupported structural edit */
  unsupportedEditReason?: string;
}

@Component({
  selector: 'app-copilot-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownComponent, CdkDrag, CdkDragHandle, CopilotTopFilterBarComponent, CopilotHeaderComponent],
  templateUrl: './copilot-chat.component.html',
  styleUrls: ['./copilot-chat.component.css']
})
export class CopilotChatComponent implements OnInit, OnChanges, OnDestroy {
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
  isDragging = false;
  private dragEndTimeout?: any;
  inputQuery = '';
  isStreaming = false;
  isSavingInFlight = false;
  formPrepareTimeoutMs = 2500;
  isClearingCache = false;
  clearCacheStatus: 'idle' | 'success' | 'error' = 'idle';

  // ── Mode State (Unified Two-State Architecture: Q&A default 💬 | Unified Action & Vision ⚡👁️) ──
  isActionMode = false;
  isVisionAgentMode = false;
  cdpPort = 9222;
  cdpHost = typeof localStorage !== 'undefined' ? (localStorage.getItem('copilot_cdp_host') || '127.0.0.1') : '127.0.0.1';

  /**
   * Conversational Validation Recovery state:
   * Holds missing fields detected from `#toast-container.dp-toast-top-end` or `.ng-invalid` controls
   * after a Save attempt, so the user's next reply patches the active form without resetting it.
   */
  pendingMissingFieldsRecovery: {
    targetMessage: ChatMessage;
    missingFields: ErpMissingFieldInfo[];
    rawErrors: string[];
  } | null = null;

  get currentModeKey(): string {
    if (this.isActionMode || this.isVisionAgentMode) return 'mode-action';
    return 'mode-qa';
  }

  get inputPlaceholder(): string {
    if (this.isActionMode || this.isVisionAgentMode) {
      return 'اكتب أمر التنفيذ (مثال: سجل فاتورة مشتريات 10 سن من المورد حسين) — يعمل بالـ DOM والرؤية البصرية معاً...';
    }
    if (this.hasConnectionError && !this.isAiReady) {
      return 'تعذر الاتصال بالمحرك، انقر إعادة الاتصال أعلاه...';
    }
    if (this.isWarmingUp) {
      return 'جاري تهيئة المحرك، يُرجى الانتظار لحظات...';
    }
    return 'اسأل أي سؤال تعليمي عن النظام والمحاضرات (أو اضغط ⚡👁️ للتنفيذ الذكي)...';
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
    const snap = readHostElementAttributes(this.elRef?.nativeElement, {
      apiUrl: this.apiUrl,
      backendUrl: this.backendUrl,
      erpKey: this.erpKey,
      activeScreenKey: this.activeScreenKey,
      lmsPageId: this.lmsPageId,
      u: this.u,
      p: this.p,
      token: this.token,
      hideHeader: this.hideHeader,
      inline: this.inline
    });
    this.apiUrl = snap.apiUrl;
    this.backendUrl = snap.backendUrl;
    this.erpKey = snap.erpKey;
    this.lmsPageId = snap.lmsPageId;
    this.u = snap.u;
    this.p = snap.p;
    this.token = snap.token;
    if (snap.hideHeader != null) this.hideHeader = snap.hideHeader;
    if (snap.inline != null) this.inline = snap.inline;
  }

  private setupAttributeObserver() {
    const hostEl: HTMLElement = this.elRef?.nativeElement;
    if (!hostEl || typeof MutationObserver === 'undefined') return;

    this.attrObserver = new MutationObserver(() => {
      const prevApiUrl = this.apiUrl;
      const prevBackendUrl = this.backendUrl;
      const prevToken = this.token;
      const prevU = this.u;
      const prevP = this.p;

      this.readAttributesFromHost();

      const authOrUrlChanged =
        this.apiUrl !== prevApiUrl ||
        this.backendUrl !== prevBackendUrl ||
        this.token !== prevToken ||
        this.u !== prevU ||
        this.p !== prevP;

      if (authOrUrlChanged) {
        this.applyInputs();
      } else if (this.lmsPageId) {
        if (!this.erpKey) this.erpKey = this.lmsPageId;
        if (!this.activeLessonId) this.activeLessonId = this.lmsPageId;
      }

      if (this.apiUrl !== prevApiUrl) {
        this.checkAiReadiness();
      }
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
    const res = applyEmbeddedHostStyles(this.elRef?.nativeElement, this.inline, this.hideHeader);
    this.isEmbedded = res.isEmbedded;
    this.inline = res.inline;
    this.hideHeader = res.hideHeader;
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

  trackByMessage(index: number, _msg: ChatMessage): number {
    return index;
  }

  ngOnDestroy() {
    this.attrObserver?.disconnect();
    this.stopReadinessPolling();
    this.lessonSub?.unsubscribe();
    if (this.dragEndTimeout) {
      clearTimeout(this.dragEndTimeout);
      this.dragEndTimeout = undefined;
    }
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

  onDragStarted(): void {
    this.isDragging = true;
    if (this.dragEndTimeout) {
      clearTimeout(this.dragEndTimeout);
      this.dragEndTimeout = undefined;
    }
  }

  onDragEnded(): void {
    // Delay clearing isDragging so the trailing click event from mouseup does not trigger toggleMinimize
    this.dragEndTimeout = setTimeout(() => {
      this.isDragging = false;
    }, 150);
  }

  toggleMinimize() {
    if (this.isDragging) {
      return;
    }
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

  deduplicateSources(sources: CopilotSource[]): CopilotSource[] {
    return deduplicateCopilotSources(sources);
  }

  formatTimestamp(seconds?: number): string {
    return formatCopilotTimestamp(seconds);
  }

  buildSourceUrl(src: CopilotSource): string {
    return buildCopilotSourceUrl(src);
  }

  formatSourceLabel(src: CopilotSource, index: number): string {
    return formatCopilotSourceLabel(src, index);
  }

  renderMessageText(msg: ChatMessage): string {
    return renderCopilotMessageText(msg);
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

  /**
   * Single Unified Mode Toggle:
   * - OFF (false): Pure Educational Q&A Chat (answers questions only, never touches ERP screens).
   * - ON  (true) : Unified Hybrid Action & Vision Mode (DOM-first execution + automatic Vision/CDP fallback).
   */
  toggleActionMode(): void {
    this.isActionMode = !this.isActionMode;
    this.isVisionAgentMode = this.isActionMode;
    this.cdr.markForCheck();
  }

  toggleVisionAgentMode(): void {
    this.toggleActionMode();
  }

  async sendMessage(skipCache: boolean = false) {
    const query = this.inputQuery.trim();
    if (!query || this.isStreaming || !this.isAiReady) return;

    // Explicit slash command (/agent, /vision, /cdp) forces direct Vision Agent execution
    const isAgentSlash = /^\/(agent|vision|cdp)\s*/i.test(query);
    if (isAgentSlash) {
      this.inputQuery = '';
      this.isActionMode = true;
      this.isVisionAgentMode = true;
      await this.runVisionAgent(query, this.cdpPort, this.cdpHost);
      return;
    }

    this.syncErpKey();
    const currentMode = this.isActionMode ? 'unified_action_vision' : 'qa';
    const traceId = 'trc_' + Math.random().toString(36).substring(2, 8);
    this.telemetry?.setTraceId(traceId);
    this.telemetry?.log('USER_QUERY', `User: "${query}"`, {
      query,
      skipCache,
      screenKey: this.erpKey,
      mode: currentMode,
      traceId
    });

    // Add user message
    this.messages.push({
      sender: 'user',
      text: query
    });

    this.inputQuery = '';

    // 🔄 Conversational Validation Recovery: If waiting for user to supply missing field(s) after a Save toast error,
    // patch the currently open form in-place (without resetting/re-opening) and auto-save!
    const isExplicitNewNavOrFullDoc =
      /^(اذهب|انتقل|افتح|وديني|روح|سجل|انشئ|أنشئ|اضف|أضف|اعمل|إعمل|عمل|سوي|سوّي|دخل|أدخل|ادخل)\s/i.test(query) ||
      /(فاتور|سند|قيد|إذن|اذن|طلب)/i.test(query);
    if (this.pendingMissingFieldsRecovery && !isExplicitNewNavOrFullDoc) {
      await this.applyMissingFieldsRecoveryReply(query);
      return;
    }

    this.pendingMissingFieldsRecovery = null;
    await this.streamQuery(query, skipCache);
  }

  /**
   * Executes autonomous Vision Agent loop via CDP over SSE.
   * Directly interfaces with Google Gemini 2.0 Multimodal Grounding Engine.
   */
  async runVisionAgent(goal: string, cdpPort: number = 9222, cdpHost?: string, skipUserBubble: boolean = false) {
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

    if (!skipUserBubble) {
      this.messages.push({
        sender: 'user',
        text: `⚡👁️ [تنفيذ ذكي]: ${cleanGoal}`
      });
    }

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

    if (!this.telemetry?.getTraceId()) {
      this.telemetry?.setTraceId('trc_' + Math.random().toString(36).substring(2, 8));
    }

    const targetScreen = (msg.formFillData.pageId ? String(msg.formFillData.pageId) : undefined)
      || msg.formFillData.screenKey;
    this.telemetry?.log('FILL', `User clicked Apply Form Fill for '${targetScreen || this.erpKey}'`, {
      screenKey: targetScreen || this.erpKey,
      fields: msg.formFillData.fields,
      rows: msg.formFillData.rows
    });

    try {
      const activeScreen = this.bridge.getActiveScreen();
      const currentActive = activeScreen?.pageName || this.erpKey || '';
      const targetPageId = msg.formFillData.pageId;
      const currentPageId = activeScreen?.pageId;
      const { isAlreadyOnMatchingDomain } = evaluateActiveScreenMatch(
        msg.relatedUserQuery || '',
        activeScreen,
        true
      );

      // Deterministic check:
      let isSameScreen = false;
      if (targetPageId != null && currentPageId != null) {
        isSameScreen = String(currentPageId) === String(targetPageId);
      } else if (isAlreadyOnMatchingDomain) {
        isSameScreen = true;
      } else {
        isSameScreen = targetScreen ? this.navigator.isScreenActive(targetScreen) : true;
      }

      let effectiveTarget = targetScreen;
      if (targetScreen && !isSameScreen) {
        console.info('%c[Copilot FormFill] Screen mismatch detected! Switching to:', 'color:#3b82f6;font-weight:bold', targetScreen);
        await this.navigator.navigateToScreen(targetScreen);
        await this.formDriver.settle(undefined, { quietMs: 80, maxMs: 800 });
      } else if (isSameScreen) {
        console.info(
          `%c[Copilot FormFill] User is already on '${currentActive}' (pageId: ${currentPageId}). Retaining active screen.`,
          'color:#10b981;font-weight:bold'
        );
        effectiveTarget = currentActive;
      }
      this.syncErpKey(effectiveTarget || currentActive);

      // Ensure form entry is safely prepared AFTER structured action_intent is inspected
      const prepStatus = await this.prepareFormForMessage(msg, undefined, true);
      if (prepStatus !== 'ready') {
        return;
      }

      if (!isSameScreen) {
        const schemaWaitStart = Date.now();
        while (Date.now() - schemaWaitStart < 1500) {
          const schema = this.formDriver.collectFormSchema(this.elRef?.nativeElement);
          if (schema.length > 0) break;
          await new Promise((r) => setTimeout(r, 100));
        }
      }

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

      this.telemetry?.logSessionEnd({
        success: report.success,
        fieldsFilled: report.filledCount,
        fieldsProcessed: report.fieldsProcessed,
        rowsFilled: msg.formFillData.rows?.length || 0,
        unresolvedCount: report.results.filter(r => r.status === 'not_found' || r.status === 'ambiguous').length,
        screenKey: targetScreen || this.erpKey
      });

      // 🧠 Train Decision Memory: If navigation decision was attached and fill succeeded, confirm to backend
      if (report.success && msg.decisionId && this.copilotService) {
        this.copilotService.feedbackErpNavigation(msg.decisionId, 'applied');
      }

      // 💾 Optional auto-save: NEVER bypasses explicit Edit Card confirmation when editing a SavedOpen document
      const unresolvedFields = report.results.filter(r => r.status === 'not_found' || r.status === 'ambiguous');
      const hasUnresolved = unresolvedFields.length > 0;
      if (this.autoSaveAfterFill) {
        if (msg.targetFormMode === 'SavedOpen' || msg.requiresExplicitUpdateConfirm) {
          this.telemetry?.log('FILL', 'autoSaveAfterFill bypassed on SavedOpen: explicit Edit Card confirmation required', {
            docRef: msg.targetDocRef,
            diffCount: msg.formDiff?.length ?? 0
          }, 'WARN');
        } else if (report.success) {
          this.telemetry?.log('FILL', 'autoSaveAfterFill triggered: initiating confirmSave', {
            filledCount: report.filledCount,
            hasUnresolved,
            unresolvedCount: unresolvedFields.length
          });
          await this.confirmSave(msg, false);
        } else {
          this.telemetry?.log('FILL', 'autoSaveAfterFill skipped because form fill failed', {
            results: report.results
          }, 'WARN');
          this.messages.push({
            sender: 'assistant',
            text: `⚠️ لم يتم الحفظ التلقائي لأن تعبئة بعض البيانات لم تكتمل (${unresolvedFields.map(r => r.label || r.field).join('، ')}). يرجى مراجعة الحقول والضغط على زر الحفظ يدوياً.`,
            sources: [],
            isStreaming: false
          });
          this.scrollToBottom();
        }
      } else if (!report.success && report.filledCount === 0 && msg.relatedUserQuery) {
        // 👁️ Phase 3 True Hybrid Fallback: If DOM driver couldn't fill any field (e.g. Canvas/iFrame/unmounted),
        // automatically escalate to Vision Agent without manual user intervention!
        console.info('%c[Copilot Hybrid] DOM fill applied 0 fields — auto-escalating to Vision Agent...', 'color:#7c3aed;font-weight:bold');
        msg.isApplyingFormFill = false;
        this.cdr.detectChanges();
        await this.runVisionAgent(msg.relatedUserQuery, this.cdpPort, this.cdpHost);
        return;
      }
    } catch (err) {
      console.error('[Copilot FormFill] Execution error:', err);
      this.telemetry?.logError('FILL', 'applyFormFill threw exception', err);
    } finally {
      msg.isApplyingFormFill = false;
      this.cdr.detectChanges();
    }
  }


  isConfirmSaveDisabled(msg: ChatMessage): boolean {
    if (this.isSavingInFlight || msg.saveStatus === 'saving' || msg.saveStatus === 'saved') {
      return true;
    }
    if (msg.requiresExplicitUpdateConfirm && !msg.formFillApplied) {
      return true;
    }
    return false;
  }

  /** Confirms discarding the active UnsavedDraft, opens a fresh form, and proceeds to fill `msg`. */
  async confirmDraftResetAndApply(msg: ChatMessage): Promise<void> {
    msg.draftResetDecision = 'reset_and_new';
    msg.requiresDraftResetConfirm = false;
    msg.formPrepError = undefined;
    this.cdr.markForCheck();
    await this.applyFormFill(msg);
  }

  /** Keeps the active UnsavedDraft intact without calling `triggerAddNew` or applying new fields. */
  cancelDraftReset(msg: ChatMessage): void {
    msg.draftResetDecision = 'keep_draft';
    msg.requiresDraftResetConfirm = false;
    msg.formPrepError = undefined;
    this.pushUniqueAssistantNotice('✋ تم الإبقاء على المسودة الحالية كما هي دون فتح مستند جديد.');
    this.telemetry?.log('NAV', 'User chose to keep UnsavedDraft — reset cancelled without triggerAddNew');
    this.cdr.markForCheck();
  }

  /** Populates SavedOpen edit card metadata and before/after diff table from host context. */
  private populateSavedOpenEditState(
    msg: ChatMessage,
    fillData: CopilotFormFillData,
    schemas?: any[]
  ): void {
    const preCtx = this.bridge.getActiveFormContext(true);
    const preState = this.bridge.getFormState(true);
    const resolvedSchemas =
      schemas && schemas.length > 0
        ? schemas
        : this.formDriver.collectFormSchema(this.elRef?.nativeElement);
    msg.targetFormMode = 'SavedOpen';
    msg.requiresExplicitUpdateConfirm = true;
    msg.targetDocRef = msg.targetDocRef || extractDocRef(preState, preCtx);
    if (!msg.formDiff || msg.formDiff.length === 0) {
      msg.formDiff = buildFormDiffEntries(
        preCtx,
        fillData,
        resolvedSchemas,
        typeof document !== 'undefined' ? document : undefined,
        this.elRef?.nativeElement
      );
    }
  }

  /** Clears SavedOpen edit metadata when transitioning cleanly to a brand-new form. */
  private clearSavedEditMetadata(msg: ChatMessage): void {
    msg.targetFormMode = undefined;
    msg.targetDocRef = undefined;
    msg.requiresExplicitUpdateConfirm = false;
    msg.userConfirmedSavedUpdate = false;
    msg.formDiff = undefined;
  }

  /** Appends an assistant notice unless the exact text was already pushed as the latest message. */
  private pushUniqueAssistantNotice(text: string): void {
    const lastMsg = this.messages[this.messages.length - 1];
    if (lastMsg && lastMsg.sender === 'assistant' && lastMsg.text === text) {
      return;
    }
    this.messages.push({
      sender: 'assistant',
      text,
      sources: [],
      isStreaming: false
    });
    this.scrollToBottom();
  }

  /** Checks whether `msg` requests an unsupported header/grid transfer edit and blocks auto-fill cleanly. */
  private blockIfUnsupportedEdit(msg: ChatMessage, surfaceToChat = true): boolean {
    const check = detectUnsupportedEditCommand(msg.formFillData, msg.relatedUserQuery || '');
    if (!check.unsupported) {
      msg.unsupportedEditReason = undefined;
      return false;
    }
    const errText =
      check.userMessage ||
      '⚠️ هذا التعديل غير مدعوم حالياً؛ يرجى تنفيذه يدوياً داخل الشاشة.';
    msg.unsupportedEditReason = errText;
    msg.formPrepared = false;
    msg.requiresDraftResetConfirm = false;
    msg.draftResetDecision = undefined;
    this.clearSavedEditMetadata(msg);
    if (surfaceToChat) {
      this.pushUniqueAssistantNotice(errText);
    }
    this.telemetry?.log(
      'FILL',
      'Blocked unsupported edit_current command without applying form fill',
      { reason: check.reason, actionIntent: msg.formFillData?.action_intent },
      'WARN'
    );
    this.cdr.markForCheck();
    return true;
  }

  /**
   * Prepares the ERP form after `fillData` arrives (with explicit draft confirmation and bounded timeout).
   * Never performs a silent fill if opening a fresh document fails or times out.
   */
  private async prepareFormForMessage(
    msg: ChatMessage,
    schemas?: any[],
    surfaceErrorToChat = true
  ): Promise<'ready' | 'needs_draft_confirm' | 'kept_draft' | 'failed'> {
    if (!msg.formFillData) {
      return 'failed';
    }

    if (this.blockIfUnsupportedEdit(msg, surfaceErrorToChat)) {
      return 'failed';
    }

    const canInspectMode = typeof document !== 'undefined' || this.bridge.isAvailable;
    const currentMode: ErpFormMode = canInspectMode ? this.navigator.getFormMode(true) : 'EmptyNew';
    const isEditCurrent = resolveEditCurrentIntent(msg.formFillData, msg.relatedUserQuery || '');

    if (currentMode === 'UnsavedDraft' && !isEditCurrent) {
      if (msg.draftResetDecision === 'keep_draft') {
        msg.requiresDraftResetConfirm = false;
        this.cdr.markForCheck();
        return 'kept_draft';
      }
      if (msg.draftResetDecision !== 'reset_and_new') {
        msg.requiresDraftResetConfirm = true;
        msg.draftResetDecision = 'pending';
        msg.formPrepared = false;
        this.cdr.markForCheck();
        return 'needs_draft_confirm';
      }
    }

    if (isEditCurrent) {
      if (currentMode === 'SavedOpen') {
        this.populateSavedOpenEditState(msg, msg.formFillData, schemas);
        msg.formPrepared = true;
        msg.formPrepError = undefined;
        this.cdr.markForCheck();
        return 'ready';
      }
      if (currentMode === 'UnsavedDraft' || currentMode === 'EmptyNew') {
        msg.formPrepared = true;
        msg.formPrepError = undefined;
        this.cdr.markForCheck();
        return 'ready';
      }
    }

    if (currentMode === 'EmptyNew') {
      this.clearSavedEditMetadata(msg);
      msg.formPrepared = true;
      msg.formPrepError = undefined;
      this.cdr.markForCheck();
      return 'ready';
    }

    const prepOptions =
      currentMode === 'UnsavedDraft'
        ? { resetDraft: true }
        : currentMode === 'SavedOpen'
          ? { resetSaved: true }
          : undefined;

    let formOpened = false;
    const timeoutMs = Math.max(50, this.formPrepareTimeoutMs);
    let timerId: ReturnType<typeof setTimeout> | undefined;
    try {
      const prepPromise = this.navigator.prepareFreshForm(timeoutMs, prepOptions);
      const timeoutPromise = new Promise<boolean>((resolve) => {
        timerId = setTimeout(() => resolve(false), timeoutMs + 50);
      });
      formOpened = await Promise.race([prepPromise, timeoutPromise]);
    } catch (prepErr) {
      console.warn('[Copilot Navigation] prepareFormForMessage error:', prepErr);
      this.telemetry?.logError('NAV', 'prepareFormForMessage threw exception', prepErr);
      formOpened = false;
    } finally {
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
    }

    if (!formOpened) {
      const errMsg =
        currentMode === 'SavedOpen'
          ? `⚠️ تعذر فتح فاتورة جديدة بدلاً من المستند المحفوظ المفتوح خلال المهلة (${timeoutMs}ms). لم يتم تعبئة البيانات حفاظاً على المستند الحالي؛ يرجى الضغط على «إضافة جديد» يدوياً ثم إعادة المحاولة.`
          : currentMode === 'UnsavedDraft'
            ? `⚠️ تعذر فتح مستند جديد لتجاهل المسودة الحالية خلال المهلة (${timeoutMs}ms). لم يتم مسح المسودة أو تعبئة البيانات؛ يرجى فتح مستند جديد يدوياً ثم إعادة المحاولة.`
            : `⚠️ تعذر فتح نموذج إدخال جديد في شاشة الـ ERP خلال المهلة (${timeoutMs}ms). لم يتم تنفيذ التعبئة الصامتة؛ يرجى فتح النموذج يدوياً ثم إعادة المحاولة.`;
      msg.formPrepared = false;
      msg.formPrepError = errMsg;
      if (surfaceErrorToChat) {
        this.pushUniqueAssistantNotice(errMsg);
      }
      this.telemetry?.log('NAV', 'Deferred prepareFreshForm failed or timed out — aborted without silent fill', {
        currentMode,
        timeoutMs,
        actionIntent: msg.formFillData.action_intent
      }, 'WARN');
      this.cdr.markForCheck();
      return 'failed';
    }

    this.clearSavedEditMetadata(msg);
    msg.formPrepared = true;
    msg.formPrepError = undefined;
    msg.requiresDraftResetConfirm = false;
    await this.formDriver.settle(undefined, { quietMs: 80, maxMs: 800 });
    this.cdr.markForCheck();
    return 'ready';
  }

  /**
   * Saves the currently open ERP form through the official bridge or DOM Save + `span.dp-menu_text`.
   * Observes `#toast-container.dp-toast-top-end` in real time; if validation errors occur,
   * identifies the missing fields and enters Conversational Slot-Filling Recovery mode.
   */
  async confirmSave(msg: ChatMessage, userClickedSave = false): Promise<void> {
    if (msg.unsupportedEditReason) {
      this.cdr.markForCheck();
      return;
    }
    const formMode = this.navigator.getFormMode(true);
    const formState = this.bridge.getFormState(true);
    const guard = evaluateSaveGuard({
      isSavingInFlight: this.isSavingInFlight,
      msg,
      userClickedSave,
      formMode,
      formState
    });
    if (!guard.allow) {
      if (guard.reason === 'saved_not_dirty') {
        msg.saveStatus = 'saved';
        msg.saveMessage = guard.userMessage;
      } else if (guard.reason === 'requires_edit_card_confirm') {
        msg.requiresExplicitUpdateConfirm = true;
        msg.targetFormMode = 'SavedOpen';
        if (guard.userMessage && !msg.saveMessage) {
          msg.saveMessage = guard.userMessage;
        }
      }
      this.cdr.markForCheck();
      return;
    }

    if (userClickedSave && (msg.requiresExplicitUpdateConfirm || formMode === 'SavedOpen')) {
      msg.userConfirmedSavedUpdate = true;
    }

    this.isSavingInFlight = true;
    msg.saveStatus = 'saving';
    msg.saveMessage = undefined;
    this.cdr.markForCheck();

    try {
      if (!this.bridge.isAvailable && typeof document === 'undefined') {
        msg.saveStatus = 'failed';
        msg.saveMessage = 'جسر الـ ERP غير متاح هنا. اضغط زر الحفظ يدوياً داخل الشاشة.';
        return;
      }

      const res = await this.bridge.submitActiveForm();
      if (res.success) {
        this.pendingMissingFieldsRecovery = null;
        msg.saveStatus = 'saved';
        msg.saveMessage = res.docId
          ? `✅ تم الحفظ بنجاح في نظام الـ ERP! رقم المستند: #${res.docId}`
          : (res.message || '✅ تم إرسال أمر الحفظ بنجاح إلى الـ ERP.');
      } else {
        msg.saveStatus = 'failed';
        const rawErrors =
          res.errors && res.errors.length > 0
            ? res.errors
            : res.message
              ? [res.message]
              : ['تعذر إتمام الحفظ لوجود بيانات إلزامية ناقصة'];

        const schemas = this.formDriver.collectFormSchema(this.elRef?.nativeElement);
        const missingFields = detectMissingFieldsFromToastAndDom(
          rawErrors,
          schemas,
          this.elRef?.nativeElement
        );

        if (res.errors && res.errors.length > 0) {
          msg.saveMessage = `⚠️ لم يتم الحفظ: ${res.errors.join('، ')}`;
        } else {
          msg.saveMessage = res.message || '⚠️ تعذر إرسال أمر الحفظ. راجع الحقول الناقصة أدناه.';
        }

        this.pendingMissingFieldsRecovery = {
          targetMessage: msg,
          missingFields,
          rawErrors
        };

        const fieldsBulletList =
          missingFields.length > 0
            ? missingFields
                .map((mf) => {
                  const optsHint =
                    mf.options && mf.options.length > 0
                      ? ` *(الخيارات المتاحة: ${mf.options.slice(0, 8).join('، ')})*`
                      : '';
                  return `- **${mf.label}**${optsHint}`;
                })
                .join('\n')
            : `- يرجى كتابة اسم الحقل وقيمته المطلوبة بناءً على رسالة التنبيه أعلاه.`;

        const promptText =
          `⚠️ **تنبيه من النظام عند محاولة الحفظ:**\n` +
          `> «${rawErrors.join(' — ')}»\n\n` +
          `لاستكمال حفظ الفاتورة المفتوحة حالياً **دون مسح البيانات المدخلة**، يرجى تزويدي بالقيمة المطلوبة لـ:\n` +
          `${fieldsBulletList}\n\n` +
          `💬 *اكتب القيمة هنا مباشرةً وسأقوم بملئها والضغط على حفظ تلقائياً.*`;

        this.messages.push({
          sender: 'assistant',
          text: promptText,
          sources: [],
          isStreaming: false
        });
        this.scrollToBottom();
      }
      console.info('[Copilot Save] submitActiveForm result:', res);
    } finally {
      this.isSavingInFlight = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Handles the user's conversational reply supplying missing field value(s) after a Save validation toast.
   * Patches ONLY the missing field(s) in the currently open form (never calls triggerAddNew) and re-saves.
   */
  private async applyMissingFieldsRecoveryReply(userReply: string): Promise<void> {
    const recovery = this.pendingMissingFieldsRecovery;
    if (!recovery) return;

    this.isStreaming = true;
    this.cdr.markForCheck();

    try {
      const fieldsToPatch: Record<string, any> = {};
      const cleanReply = userReply.trim();

      // Direct parser for Exchange Rate replies (e.g. "1", "سعر الصرف 1", "سعر الصرف = 1")
      const exchangeMatch = cleanReply.match(/^(?:سعر\s*الصرف\s*[:=-]?\s*)?(\d+(?:\.\d+)?)$/i);
      const isExchangeInMissing = recovery.missingFields.some(
        (mf) => mf.key === 'ExchangePrice' || normalizeArabicText(mf.label).includes('سعر الصرف')
      );
      if (exchangeMatch && (isExchangeInMissing || recovery.rawErrors.some((e) => e.includes('سعر الصرف')))) {
        fieldsToPatch['ExchangePrice'] = exchangeMatch[1];
      } else if (recovery.missingFields.length === 1) {
        const mf = recovery.missingFields[0];
        let val = cleanReply;
        // Strip leading field label if user wrote e.g. "طريقة الشراء مشتريات مباشرة"
        const normLabel = normalizeArabicText(mf.label);
        if (normLabel && normalizeArabicText(val).startsWith(normLabel)) {
          val = val
            .slice(mf.label.length)
            .replace(/^[\s:=-]+/, '')
            .trim() || cleanReply;
        }
        fieldsToPatch[mf.key] = val;
      } else {
        const currentSchemas = this.formDriver.collectFormSchema(this.elRef?.nativeElement);
        const targetSchemas =
          recovery.missingFields.length > 0
            ? recovery.missingFields
            : currentSchemas.filter((s) => !s.disabled);

        // Try AI leftover extraction scoped to the missing fields
        try {
          const leftoverRes = await this.copilotService.resolveErpLeftover({
            user_message: cleanReply,
            extracted_data: recovery.targetMessage.formFillData?.fields || {},
            filled: {},
            new_fields: targetSchemas.map((s) => ({
              key: s.key,
              label: s.label,
              kind: s.kind,
              disabled: false,
              options: s.options
            }))
          });
          if (leftoverRes?.fields && Object.keys(leftoverRes.fields).length > 0) {
            Object.assign(fieldsToPatch, leftoverRes.fields);
          }
        } catch (err) {
          console.warn('[Copilot SaveRecovery] resolveErpLeftover fallback error:', err);
        }

        // Direct fallback if single token or AI didn't map
        if (Object.keys(fieldsToPatch).length === 0 && recovery.missingFields.length > 0) {
          fieldsToPatch[recovery.missingFields[0].key] = cleanReply;
        }
      }

      this.telemetry?.log('FILL', 'Applying conversational missing-field recovery patch (in-place)', {
        fieldsToPatch,
        userReply: cleanReply
      });

      const patchReport = await this.formDriver.applyProgressiveFill(
        fieldsToPatch,
        undefined,
        this.elRef?.nativeElement,
        this.copilotService,
        cleanReply
      );

      // Fix C: Direct DOM write for ExchangePrice after recovery fill.
      // applyProgressiveFill calls the bridge (memory), but Angular reactive forms only
      // fire server-side validation on native input/change DOM events — not on memory writes.
      if (fieldsToPatch['ExchangePrice'] != null) {
        const rate = Number(fieldsToPatch['ExchangePrice']) || 1;
        const exchEl = this.formDriver.writeExchangePriceDom(this.elRef?.nativeElement, rate);
        this.telemetry?.log(
          'FILL',
          exchEl
            ? `[Recovery] ExchangePrice DOM write succeeded (${rate})`
            : `[Recovery] ExchangePrice DOM element not found — rate=${rate}`,
          { rate, found: !!exchEl }
        );
      }

      // Merge patched results into targetMessage's formFillData & report
      if (recovery.targetMessage.formFillData) {
        recovery.targetMessage.formFillData.fields = {
          ...(recovery.targetMessage.formFillData.fields || {}),
          ...fieldsToPatch
        };
      }
      recovery.targetMessage.formFillReport = patchReport;
      this.pendingMissingFieldsRecovery = null;

      this.messages.push({
        sender: 'assistant',
        text: `✅ تم استكمال البيانات في الفاتورة الحالية (${Object.values(fieldsToPatch).join('، ')})، وجارٍ إعادة الحفظ تلقائياً...`,
        sources: [],
        isStreaming: false
      });
      this.cdr.markForCheck();
      this.scrollToBottom();

      // Reset saveStatus so confirmSave executes fresh and clicks Save + span.dp-menu_text
      recovery.targetMessage.saveStatus = undefined;
      await this.confirmSave(recovery.targetMessage, !!recovery.targetMessage.userConfirmedSavedUpdate);

      if (recovery.targetMessage.saveStatus === 'saved') {
        this.messages.push({
          sender: 'assistant',
          text: recovery.targetMessage.saveMessage || '✅ تم استكمال النواقص وحفظ المستند بنجاح!',
          sources: [],
          isStreaming: false
        });
        this.scrollToBottom();
      }
    } catch (err) {
      console.error('[Copilot SaveRecovery] Error during missing-field recovery:', err);
      this.telemetry?.logError('FILL', 'applyMissingFieldsRecoveryReply error', err);
    } finally {
      this.isStreaming = false;
      this.cdr.markForCheck();
    }
  }


  /**
   * Keeps erpKey aligned with the real active ERP screen (bridge) instead of temporary DOM ids.
   */
  private syncErpKey(fallback?: string): void {
    const active = this.bridge.getActiveScreen();
    const next = active?.pageName || active?.screenKey || fallback;
    if (next) this.erpKey = next.trim();
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
    return isValidCopilotFormFill(data);
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
    let formPreparedDuringStream = false;

    if (this.isActionMode) {
      this.syncErpKey();
      const activeScreen = this.bridge.getActiveScreen();
      const activeRaw = (activeScreen?.pageName || activeScreen?.screenKey || '').trim();
      const activeName = activeRaw.toLowerCase();
      const activePid = activeScreen?.pageId != null ? String(activeScreen.pageId) : '';
      const isDomActive = !!activeRaw && (this.navigator.isScreenActive(activePid || activeRaw) || this.navigator.isScreenActive(activeName));
      const { isAlreadyOnMatchingScreen, isExplicitNavRequest, isSetupOrConfigScreen } = evaluateActiveScreenMatch(
        query,
        activeScreen,
        isDomActive
      );
      const initialFormMode =
        typeof document !== 'undefined' || this.bridge.isAvailable
          ? this.navigator.getFormMode(true)
          : 'EmptyNew';
      const isEditingActiveSavedDoc =
        initialFormMode === 'SavedOpen' &&
        isEditExistingFormQuery(query) &&
        !isSetupOrConfigScreen &&
        !isExplicitNavRequest;

      if ((isAlreadyOnMatchingScreen && !isExplicitNavRequest) || isEditingActiveSavedDoc) {
        console.info(
          `%c[Copilot Navigation] Active screen '${activeName}' ${isEditingActiveSavedDoc ? 'holds SavedOpen document for edit' : 'already matches query domain and is active in DOM'}. Staying on current screen!`,
          'color:#10b981;font-weight:bold'
        );
        skipNavCheck = true;
        resolvedIntent = 'action';
      }

      let navRes: any = null;
      if (!skipNavCheck && typeof document !== 'undefined') {
        try {
          navRes = await this.navigator.resolveAndNavigate(query, { deferFormPrepOnOpenForm: true });
          resolvedIntent = navRes?.rawResolution?.intent;
          resolvedDecisionId = navRes?.rawResolution?.decision_id;

          if (navRes?.success && navRes.chosen) {
            console.info('%c[Copilot Navigation] Auto-navigated to target screen:', 'color:#10b981;font-weight:bold', navRes.chosen.id);
            this.syncErpKey(navRes.chosen.id);
            // Wait for DOM & Angular components to settle on the new screen
            await this.formDriver.settle(undefined, { quietMs: 250, maxMs: 2500, minMs: 120 });

            // If user intent is pure navigation ("اذهب إلى..."), finish cleanly without invoking Qdrant RAG or form fill!
            if (resolvedIntent === 'navigate') {
              const targetTitle = navRes.chosen.label || navRes.chosen.id;
              this.messages.push({
                sender: 'assistant',
                text: `✅ تم الانتقال إلى شاشة «${targetTitle}» بنجاح.`,
                sources: [],
                isStreaming: false,
                relatedUserQuery: query,
                decisionId: resolvedDecisionId,
                filters: { ...this.activeFilter },
                lessonId: this.activeFilter.lessonId,
                lessonIds: this.activeFilter.lessonIds ? [...this.activeFilter.lessonIds] : undefined
              });
              this.isStreaming = false;
              this.cdr.markForCheck();
              this.scrollToBottom();
              return;
            }
          } else if (navRes?.decision === 'ask' && navRes.askOptions && navRes.askOptions.length > 0) {
            console.info('%c[Copilot Navigation] Ambiguous intent -> displaying ask options:', 'color:#f59e0b;font-weight:bold', navRes.askOptions);
            pendingAskOptions = navRes.askOptions;
            if (resolvedIntent === 'navigate') {
              this.messages.push({
                sender: 'assistant',
                text: 'يرجى اختيار الشاشة أو الوحدة المطلوبة للانتقال إليها:',
                sources: [],
                isStreaming: false,
                askOptions: pendingAskOptions,
                relatedUserQuery: query,
                decisionId: resolvedDecisionId,
                filters: { ...this.activeFilter },
                lessonId: this.activeFilter.lessonId,
                lessonIds: this.activeFilter.lessonIds ? [...this.activeFilter.lessonIds] : undefined
              });
              this.isStreaming = false;
              this.cdr.markForCheck();
              this.scrollToBottom();
              return;
            }
          }
        } catch (navErr) {
          console.warn('[Copilot Navigation] resolveAndNavigate error:', navErr);
        }
      }

      // S1 Lifecycle Order: If user intent is an action/entry, open ClosedOrList form early for DOM schema.
      // CRITICAL: Defer prepareFreshForm() on SavedOpen / UnsavedDraft until `fillData.action_intent` arrives!
      const isOnTargetScreen = skipNavCheck || !!(navRes && navRes.success);
      const isEntryIntent = resolvedIntent === 'action' || (!resolvedIntent && /سجل|اضف|أضف|انشئ|أنشئ|فاتورة|سداد|قيد|عدل|تعديل|غير|امسح/i.test(query));
      const streamFormMode =
        typeof document !== 'undefined' || this.bridge.isAvailable
          ? this.navigator.getFormMode(true)
          : 'EmptyNew';
      const deferFormPrepUntilFillData =
        streamFormMode === 'SavedOpen' || streamFormMode === 'UnsavedDraft';
      if (isEntryIntent && isOnTargetScreen && !deferFormPrepUntilFillData && typeof document !== 'undefined') {
        try {
          const formOpened = await this.navigator.prepareFreshForm(this.formPrepareTimeoutMs);
          if (formOpened) {
            formPreparedDuringStream = true;
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
      shouldOfferVisionEscalation = isEntryIntent && (!visibleFields || visibleFields.length === 0) && !isOnTargetScreen && navRes?.decision !== 'go';
      console.info('%c[Copilot FormFill] Active Form Fields Detected:', 'color:#10b981;font-weight:bold', visibleFields);

      // 🚀 Phase 3 Unified Hybrid Orchestrator:
      // In Unified Action & Vision Mode, if the user wants to execute an action or navigate,
      // and the in-page DOM could neither navigate nor find visible form fields, automatically
      // hand off to the Vision Agent (CDP + Set-of-Mark VLM) seamlessly!
      const isNavUnresolved = resolvedIntent === 'navigate' && (!navRes || !navRes.success) && !pendingAskOptions;
      if (shouldOfferVisionEscalation || isNavUnresolved) {
        console.info('%c[Copilot Unified Hybrid] DOM path could not reach target screen/fields — seamlessly invoking Vision Agent...', 'color:#7c3aed;font-weight:bold');
        this.isStreaming = false;
        await this.runVisionAgent(query, this.cdpPort, this.cdpHost, true);
        return;
      }
    } else {
      // 💬 Pure Q&A Mode: Answer questions ONLY! Do NOT navigate, do NOT collect schemas, do NOT extract form_fill
      resolvedIntent = 'question';
      visibleFields = undefined;
      formSchema = undefined;
      shouldOfferVisionEscalation = false;
      console.info('%c[Copilot Mode] Pure Educational Q&A Mode active — answering questions only', 'color:#6366f1;font-weight:bold');
    }
    const assistantMsgIndex = this.messages.length;
    this.messages.push({
      sender: 'assistant',
      text: pendingAskOptions ? 'طلبك يحتمل أكثر من شاشة في النظام، يمكنك اختيار الشاشة المستهدفة أدناه أو متابعة قراءة الإجابة:\n\n' : '',
      sources: [],
      isStreaming: true,
      askOptions: pendingAskOptions,
      formPrepared: formPreparedDuringStream,
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
        this.scrollToBottom();
      },
      (token: string) => {
        this.messages[assistantMsgIndex].text += token;
        this.scrollToBottom();
      },
      (meta?: any) => {
        this.messages[assistantMsgIndex].isStreaming = false;
        this.messages[assistantMsgIndex].isRetrying = false;
        this.isStreaming = false;
        this.scrollToBottom();
        if (meta?.thread_id) {
          this.messages[assistantMsgIndex].threadId = meta.thread_id;
        }
        if (meta) {
          this.messages[assistantMsgIndex].cacheHit = meta.cache_hit ?? false;
          this.messages[assistantMsgIndex].provenance = meta.provenance;
          this.messages[assistantMsgIndex].latencyMs = meta.metrics?.total_latency_ms ?? meta.latency_ms;
          if (this.messages[assistantMsgIndex].formFillData) {
            this.messages[assistantMsgIndex].canEscalateToVisionAgent = false;
            this.messages[assistantMsgIndex].escalationGoal = undefined;
          }
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
        if (!fillData) return;
        const assistantMsg = this.messages[assistantMsgIndex];
        const unsupportedCheck = detectUnsupportedEditCommand(fillData, query);
        if (this.isValidFormFill(fillData) || unsupportedCheck.unsupported) {
          const active = this.bridge.getActiveScreen();
          if (!fillData.pageId && active?.pageId) {
            fillData.pageId = active.pageId;
          }
          if (!fillData.screenKey && active?.pageName) {
            fillData.screenKey = active.pageName.trim();
          } else if (active?.pageName && (!fillData.pageId || String(active.pageId) === String(fillData.pageId))) {
            fillData.screenKey = active.pageName.trim();
          }
          assistantMsg.formFillData = fillData;
          assistantMsg.canEscalateToVisionAgent = false;
          assistantMsg.escalationGoal = undefined;
          if (!this.blockIfUnsupportedEdit(assistantMsg, false)) {
            const modeOnExtract =
              typeof document !== 'undefined' || this.bridge.isAvailable
                ? this.navigator.getFormMode(true)
                : 'EmptyNew';
            const isEditCurrent = resolveEditCurrentIntent(fillData, query);
            if (modeOnExtract === 'SavedOpen' && isEditCurrent) {
              this.populateSavedOpenEditState(assistantMsg, fillData, formSchema);
              assistantMsg.formPrepared = true;
            } else if (modeOnExtract === 'UnsavedDraft' && !isEditCurrent) {
              assistantMsg.requiresDraftResetConfirm = true;
              assistantMsg.draftResetDecision = 'pending';
              assistantMsg.formPrepared = false;
            } else if ((modeOnExtract === 'SavedOpen' || modeOnExtract === 'ClosedOrList') && !isEditCurrent) {
              this.clearSavedEditMetadata(assistantMsg);
              assistantMsg.formPrepared = false;
            }
          }
          this.telemetry?.log('AI_EXTRACT', `AI extracted form fill proposal for '${fillData.screenKey || this.erpKey}'`, {
            screenKey: fillData.screenKey || this.erpKey,
            pageId: fillData.pageId,
            actionIntent: fillData.action_intent,
            fields: fillData.fields,
            rows: fillData.rows
          });
          this.cdr.markForCheck();
        }
      },
      formSchema,
      resolvedIntent
    );

    const completedMsg = this.messages[assistantMsgIndex];
    if (completedMsg?.formFillData && (this.isValidFormFill(completedMsg.formFillData) || completedMsg.unsupportedEditReason)) {
      await this.prepareFormForMessage(completedMsg, formSchema, true);
    } else if (completedMsg && this.isActionMode) {
      this.blockIfUnsupportedEdit(completedMsg, true);
    }
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

    const traceId = 'trc_' + Math.random().toString(36).substring(2, 8);
    this.telemetry?.setTraceId(traceId);
    console.info('%c[CoPilot] RETRY', 'color:#f59e0b;font-weight:bold', { userQuery, msgIndex, traceId });

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

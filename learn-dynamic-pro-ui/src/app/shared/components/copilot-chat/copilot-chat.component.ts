import { Component, inject, ElementRef, ViewChild, OnDestroy, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, ChangeDetectorRef, booleanAttribute, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownComponent } from 'ngx-markdown';
import { Subscription, timer } from 'rxjs';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { CopilotService, CopilotSource, CopilotFeedbackRequest, CopilotFilterState, ChatHistoryMessage, GeneralChatNavAction } from '../../../core/services/ai-copilot/copilot.service';
import { ErpNavigatorService } from '../../../core/services/erp-automation/erp-navigator.service';
import { ErpBridgeService } from '../../../core/services/erp-automation/erp-bridge.service';
import { ErpTelemetryService } from '../../../core/services/erp-automation/erp-telemetry.service';
import { NavCandidateIn, NavScored } from '../../../core/models/erp-form.models';
import { AuthService } from '../../../core/services/platform-core/auth.service';
import { CopilotTopFilterBarComponent } from '../copilot-top-filter-bar/copilot-top-filter-bar.component';
import { CopilotHeaderComponent } from '../copilot-header/copilot-header.component';
import {
  buildCopilotSourceUrl,
  deduplicateCopilotSources,
  formatCopilotSourceLabel,
  formatCopilotTimestamp,
  renderCopilotMessageText
} from './utils/copilot-citation.utils';
import {
  applyEmbeddedHostStyles,
  isPureNavigationQuery,
  readHostElementAttributes
} from './utils/copilot-host-bridge.helper';

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
  usedUnifiedChat?: boolean;
  cacheHit?: boolean;
  provenance?: string;
  latencyMs?: number;
  /** ID of AI routing decision for user confirmation feedback */
  decisionId?: string | null;
  /** Interactive navigation options suggested when intent is ambiguous (decision: 'ask') */
  askOptions?: NavScored[];
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
  private navigator = inject(ErpNavigatorService);
  private bridge = inject(ErpBridgeService);
  private telemetry = inject(ErpTelemetryService, { optional: true });
  private cdr = inject(ChangeDetectorRef);
  private elRef = inject(ElementRef);
  authService = inject(AuthService);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  @ViewChild(CopilotTopFilterBarComponent) private topFilterBar?: CopilotTopFilterBarComponent;

  @Input() erpKey?: string;
  @Input() activeScreenKey?: string;
  @Input() activeLessonId?: string;
  @Input() lmsPageId?: string;
  @Input() token?: string;
  @Input() ssoToken?: string;
  @Input() u?: string;
  @Input() p?: string;
  @Input() apiUrl?: string;
  @Input() backendUrl?: string;
  @Input({ transform: booleanAttribute }) hideHeader: boolean = false;
  @Input({ transform: booleanAttribute }) inline: boolean = false;
  @Input({ transform: booleanAttribute }) useUnifiedChat: boolean = true;
  @Input({ transform: booleanAttribute }) allowLegacyActionMode: boolean = false;

  mcpEnabled = false;
  activeThreadId?: string;
  activeToolStatus: string | null = null;
  isVoiceListening = false;
  private speechRecognition?: any;
  readonly unifiedStarterPrompts: ReadonlyArray<{ label: string; query: string }> = [
    { label: '💡 سؤال عام', query: 'اشرحلي الفرق بين الفاتورة النقدية والآجلة ببساطة' },
    { label: '📹 شرح من الدروس', query: 'إزاي أعمل فاتورة مشتريات؟' },
    { label: '🧭 فتح شاشة', query: 'افتحلي شاشة المشتريات' }
  ];

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
  isClearingCache = false;
  clearCacheStatus: 'idle' | 'success' | 'error' = 'idle';

  isActionMode = false;
  isVisionAgentMode = false;

  get currentModeKey(): string {
    if (this.isActionMode || this.isVisionAgentMode) return 'mode-action';
    return 'mode-qa';
  }

  get inputPlaceholder(): string {
    if (this.hasConnectionError && !this.isAiReady) {
      return 'تعذر الاتصال بالمحرك، انقر إعادة الاتصال أعلاه...';
    }
    if (this.isWarmingUp) {
      return 'جاري تهيئة المحرك، يُرجى الانتظار لحظات...';
    }
    if (this.useUnifiedChat) {
      return 'اسألني عن أي شيء، شروحات النظام، أو اطلب فتح شاشة...';
    }
    return 'اسأل أي سؤال تعليمي عن النظام والمحاضرات...';
  }

  // ── Smart Top Filter Bar State ───────────────────────────────────────────
  activeFilter: CopilotFilterState = { scope: 'all' };
  isFilterBarCollapsed = true;
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
    if (this.isEmbedded || this.inline) {
      return true;
    }
    const url = typeof window !== 'undefined' ? window.location.pathname : '';
    const isAuthRoute = url.includes('/login') || url.includes('/erp-redirect');
    return this.authService.isAuthenticated() && !isAuthRoute;
  }

  get shouldRenderComponent(): boolean {
    if (this.isEmbedded || this.inline) {
      return true;
    }
    return this.isLoggedIn;
  }

  messages: ChatMessage[] = [
    {
      sender: 'assistant',
      text: 'مرحباً بك! 👋 أنا مساعدك الذكي الموحد في DynamicPro. يمكنك سؤالي عن أي موضوع عام، شروحات وفيديوهات النظام، أو طلب فتح أي شاشة مصرح لك بها.'
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
    if (changes['token'] || changes['ssoToken'] || changes['apiUrl'] || changes['backendUrl'] || changes['erpKey'] || changes['activeScreenKey'] || changes['lmsPageId'] || changes['u'] || changes['p'] || changes['inline'] || changes['hideHeader'] || changes['useUnifiedChat']) {
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
      inline: this.inline,
      useUnifiedChat: this.useUnifiedChat
    });
    this.apiUrl = snap.apiUrl;
    this.backendUrl = snap.backendUrl;
    this.erpKey = snap.erpKey;
    if (snap.activeScreenKey) this.activeScreenKey = snap.activeScreenKey;
    this.lmsPageId = snap.lmsPageId;
    this.u = snap.u;
    this.p = snap.p;
    this.token = snap.token;
    const hostEl: HTMLElement | undefined = this.elRef?.nativeElement;
    const attrSsoToken = hostEl?.getAttribute('sso-token') ?? hostEl?.getAttribute('ssoToken');
    if (attrSsoToken) this.ssoToken = attrSsoToken;
    if (snap.hideHeader != null) this.hideHeader = snap.hideHeader;
    if (snap.inline != null) this.inline = snap.inline;
    if (snap.useUnifiedChat != null) this.useUnifiedChat = snap.useUnifiedChat;
  }

  private setupAttributeObserver() {
    const hostEl: HTMLElement = this.elRef?.nativeElement;
    if (!hostEl || typeof MutationObserver === 'undefined') return;

    this.attrObserver = new MutationObserver(() => {
      const prevApiUrl = this.apiUrl;
      const prevBackendUrl = this.backendUrl;
      const prevToken = this.token;
      const prevSsoToken = this.ssoToken;
      const prevU = this.u;
      const prevP = this.p;

      this.readAttributesFromHost();

      const authOrUrlChanged =
        this.apiUrl !== prevApiUrl ||
        this.backendUrl !== prevBackendUrl ||
        this.token !== prevToken ||
        this.ssoToken !== prevSsoToken ||
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
        'lms-page-id', 'lmsPageId', 'u', 'p', 'token', 'sso-token', 'ssoToken', 'hide-header', 'inline',
        'use-unified-chat', 'useUnifiedChat'
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
      this.topFilterBar?.loadFilters(true);
    } else if (this.ssoToken && !this.authService.isAuthenticated()) {
      this.performErpLogin(null, null, this.erpKey || null, this.ssoToken);
    } else if (this.u && this.p && !this.authService.isAuthenticated()) {
      this.performErpLogin(this.u, this.p, this.erpKey || null);
    }
  }

  performErpLogin(u: string | null, p: string | null, erpKey: string | null, ssoToken?: string | null) {
    this.isAuthenticating = true;
    this.authError = null;
    this.cdr.markForCheck();

    this.authService.erpLogin(u, p, erpKey, ssoToken).subscribe({
      next: (res: any) => {
        this.authService.login(res.token, res.refreshToken);
        if (res.erpRedirect?.lessonId) {
          this.activeLessonId = res.erpRedirect.lessonId;
        }
        this.isAuthenticating = false;
        this.authError = null;
        this.topFilterBar?.loadFilters(true);
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
    if (this.ssoToken) {
      this.performErpLogin(null, null, this.erpKey || null, this.ssoToken);
    } else if (this.u && this.p) {
      this.performErpLogin(this.u, this.p, this.erpKey || null);
    }
  }

  trackByMessage(index: number, _msg: ChatMessage): number {
    return index;
  }

  ngOnDestroy() {
    this.stopVoiceInput();
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
      const url = typeof window !== 'undefined' ? window.location.pathname : '';
      const queryParams = new URLSearchParams(window.location.search);

      const queryErpKey = queryParams.get('erpKey') || queryParams.get('key');
      if (queryErpKey && !this.erpKey) {
        this.erpKey = queryErpKey;
      }

      const ssoToken = queryParams.get('ssoToken');
      const u = queryParams.get('u');
      const p = queryParams.get('p');
      if (ssoToken && !this.authService.isAuthenticated()) {
        this.performErpLogin(null, null, queryErpKey || null, ssoToken);
      } else if (u && p && !this.authService.isAuthenticated()) {
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
    } catch {
      // Safe fallback
    }
  }

  checkAiReadiness() {
    this.stopReadinessPolling();
    this.currentAttempt = 0;
    this.hasConnectionError = false;
    this.executeReadinessCheck();
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
    this.activeThreadId = undefined;
    this.messages = [
      {
        sender: 'assistant',
        text: 'مرحباً بك! أنا مساعدك الذكي في منصة DynamicProLearn. اسألني أي سؤال عن دروس وموديولات النظام وسأجيبك مباشرة من واقع الفيديوهات والمحتوى التعليمي! ✨'
      }
    ];
  }

  scrollToBottom(): void {
    const doScroll = () => {
      try {
        if (this.scrollContainer?.nativeElement) {
          this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
        }
      } catch { }
    };
    doScroll();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => doScroll());
    }
    setTimeout(doScroll, 30);
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

  onBubbleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href && !anchor.href.endsWith('#')) {
      event.preventDefault();
      event.stopPropagation();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
    }
  }

  openSource(src: CopilotSource): void {
    const url = this.buildSourceUrl(src);
    if (url && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  toggleActionMode(): void {
    this.isActionMode = !this.isActionMode;
    this.isVisionAgentMode = this.isActionMode;
    this.cdr.markForCheck();
  }

  async sendMessage(skipCache: boolean = false) {
    const query = this.inputQuery.trim();
    if (!query || this.isStreaming || !this.isAiReady) return;

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

    this.messages.push({
      sender: 'user',
      text: query
    });

    this.inputQuery = '';
    this.cdr.markForCheck();
    this.scrollToBottom();
    await this.streamQuery(query, skipCache);
  }

  private syncErpKey(fallback?: string): void {
    const active = this.bridge.getActiveScreen();
    const next = active?.pageName || active?.screenKey || fallback;
    if (next) this.erpKey = next.trim();
  }

  async selectAskOption(option: NavScored, originalQuery?: string) {
    console.info('%c[Copilot Navigation] User clicked ambiguity chip:', 'color:#3b82f6;font-weight:bold', option);
    await this.navigator.navigateToScreen(option.id);
    this.syncErpKey(option.id);
    if (!originalQuery || this.isPureNavigationQuery(originalQuery)) {
      const targetTitle = this.getScreenDisplayName(option.id, option.label);
      this.messages.push({
        sender: 'assistant',
        text: `✅ تم الانتقال إلى شاشة «${targetTitle}» بنجاح.`,
        sources: [],
        isStreaming: false,
        relatedUserQuery: originalQuery,
        filters: { ...this.activeFilter },
        lessonId: this.activeFilter.lessonId,
        lessonIds: this.activeFilter.lessonIds ? [...this.activeFilter.lessonIds] : undefined
      });
      this.cdr.markForCheck();
      this.scrollToBottom();
      return;
    }
    await this.streamQuery(originalQuery, true);
  }

  getScreenDisplayName(key: string, label?: string): string {
    if (label && label.trim()) {
      return label.trim();
    }
    const map: Record<string, string> = {
      'PURCHASE_INVOICE': 'فاتورة المشتريات',
      'SALES_INVOICE': 'فاتورة المبيعات',
      'NEW_CUSTOMER': 'تسجيل عميل جديد',
      'JOURNAL_ENTRY': 'قيود اليومية العامة',
      'INVENTORY_AUDIT': 'الجرد والتسويات المخزنية'
    };
    if (map[key]) {
      return map[key];
    }
    const screens = this.bridge.listScreens?.() || [];
    const normKey = String(key || '').trim().toLowerCase();
    const matched = screens.find((s) =>
      String(s.pageId ?? '').trim() === String(key || '').trim() ||
      (s.pageName || '').trim().toLowerCase() === normKey ||
      (s.screenKey || '').trim().toLowerCase() === normKey
    );
    return (matched?.title || matched?.pageName || '').trim() || key;
  }

  private isPureNavigationQuery(query: string): boolean {
    return isPureNavigationQuery(query);
  }

  private shouldUseUnifiedChat(filters: CopilotFilterState = this.activeFilter): boolean {
    if (!this.useUnifiedChat || this.isActionMode || this.isVisionAgentMode) {
      return false;
    }
    const scope = filters?.scope || 'all';
    if (filters?.levelId || filters?.typeId || scope === 'module' || scope === 'unit') {
      return false;
    }
    if ((scope === 'lesson' || scope === 'lessons') && !this.topFilterBar?.isAutoDetectedLesson) {
      return false;
    }
    return true;
  }

  private buildChatHistory(upToExclusiveIndex?: number, currentQuery?: string): ChatHistoryMessage[] {
    const end = upToExclusiveIndex ?? this.messages.length;
    let slice = this.messages
      .slice(1, end)
      .filter((m) => !m.isStreaming && !!m.text?.trim());
    if (
      upToExclusiveIndex === undefined &&
      currentQuery &&
      slice.length > 0 &&
      slice[slice.length - 1].sender === 'user' &&
      slice[slice.length - 1].text.trim() === currentQuery.trim()
    ) {
      slice = slice.slice(0, -1);
    }
    return slice
      .slice(-6)
      .map((m) => ({ role: m.sender, content: m.text.trim() }));
  }

  private getBridgeNavCandidates(): NavCandidateIn[] {
    if (!this.bridge?.isAvailable) return [];
    if (typeof this.navigator?.scanVisibleCandidates === 'function') {
      return this.navigator.scanVisibleCandidates();
    }
    if (typeof this.bridge.listScreens === 'function') {
      return (this.bridge.listScreens() || [])
        .map((s: any) => ({
          id: String(s.pageId ?? s.page_id ?? s.screenKey ?? s.pageName ?? ''),
          label: String(s.title ?? s.name_ar ?? s.pageName ?? s.screenKey ?? ''),
          path: s.moduleName ? [String(s.moduleName)] : []
        }))
        .filter((c) => !!c.id && !!c.label);
    }
    return [];
  }

  private finalizeStreamMeta(msg: ChatMessage, meta?: any): void {
    msg.isStreaming = false;
    msg.isRetrying = false;
    this.isStreaming = false;
    this.scrollToBottom();
    if (meta?.thread_id) {
      msg.threadId = meta.thread_id;
      this.activeThreadId = meta.thread_id;
    }
    if (meta) {
      msg.cacheHit = meta.cache_hit ?? false;
      msg.provenance = meta.provenance ?? (meta.provider ? `GENERAL_CHAT:${meta.provider}` : msg.provenance);
      msg.latencyMs = meta.metrics?.total_latency_ms ?? meta.latency_ms ?? meta.metrics?.streamDurationMs;
      if (typeof meta.mcp_enabled === 'boolean') {
        this.mcpEnabled = meta.mcp_enabled;
      }
    }
    this.cdr.markForCheck();
  }

  private async handleGeneralChatNavAction(
    action: GeneralChatNavAction,
    msg: ChatMessage,
    query: string
  ): Promise<void> {
    if (!action) return;
    if (action.decision === 'ask' && Array.isArray(action.candidates) && action.candidates.length > 0) {
      msg.askOptions = action.candidates;
      msg.relatedUserQuery = query;
      this.cdr.markForCheck();
      this.scrollToBottom();
      return;
    }
    const target = action.pageId ?? action.page_id ?? action.screenKey ?? action.screen_key ?? action.screen;
    if (action.decision !== 'go' || target == null || String(target).trim() === '') {
      return;
    }
    const targetStr = String(target).trim();
    let navigated = false;
    if (typeof this.navigator?.navigateToScreen === 'function') {
      navigated = await this.navigator.navigateToScreen(targetStr);
    } else if (this.bridge?.isAvailable && typeof this.bridge.navigateToScreen === 'function') {
      navigated = await this.bridge.navigateToScreen(target);
    }
    if (navigated) {
      this.syncErpKey(action.screenKey || action.screen_key || action.screen || targetStr);
    }
    this.telemetry?.log('NAV', `Unified chat nav_action -> ${targetStr} (navigated=${navigated})`, {
      decision: action.decision,
      target: targetStr,
      reason: action.reason
    });
    this.cdr.markForCheck();
  }

  get isSpeechRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
  }

  toggleVoiceInput(): void {
    if (this.isStreaming) return;
    if (this.isVoiceListening) {
      this.stopVoiceInput();
      return;
    }
    if (typeof window === 'undefined') return;
    const w = window as any;
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    try {
      const recognition = new SpeechRecognitionCtor();
      this.speechRecognition = recognition;
      recognition.lang = 'ar-EG';
      recognition.interimResults = true;
      recognition.continuous = false;

      const baseText = this.inputQuery.trim() ? `${this.inputQuery.trim()} ` : '';
      let hadFinalTranscript = false;

      recognition.onresult = (event: any) => {
        let transcript = '';
        const results = event?.results || [];
        for (let i = 0; i < results.length; i++) {
          const res = results[i];
          if (res?.[0]?.transcript) {
            transcript += res[0].transcript;
          }
          if (res?.isFinal) {
            hadFinalTranscript = true;
          }
        }
        this.inputQuery = `${baseText}${transcript}`.trim();
        this.cdr.markForCheck();
      };

      recognition.onend = () => {
        this.isVoiceListening = false;
        this.speechRecognition = undefined;
        this.cdr.markForCheck();
        if (hadFinalTranscript && this.inputQuery.trim() && !this.isStreaming) {
          void this.sendMessage();
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('[CopilotChat] Voice input error:', err);
        this.isVoiceListening = false;
        this.speechRecognition = undefined;
        this.cdr.markForCheck();
      };

      this.isVoiceListening = true;
      recognition.start();
      this.cdr.markForCheck();
    } catch (err) {
      console.warn('[CopilotChat] Failed to start voice input:', err);
      this.isVoiceListening = false;
      this.speechRecognition = undefined;
      this.cdr.markForCheck();
    }
  }

  stopVoiceInput(): void {
    this.isVoiceListening = false;
    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch { }
      this.speechRecognition = undefined;
    }
    this.cdr.markForCheck();
  }

  applyStarterPrompt(query: string): void {
    if (this.isStreaming) return;
    this.inputQuery = query;
    void this.sendMessage();
  }

  private async executeGeneralChatForMessage(
    query: string,
    msg: ChatMessage,
    traceId?: string,
    historyUpToIndex?: number
  ): Promise<void> {
    const activeScreen = this.bridge?.isAvailable ? this.bridge.getActiveScreen() : null;
    const effectiveErpKey = (this.erpKey || activeScreen?.pageName || activeScreen?.screenKey || '').trim() || undefined;
    const effectiveScreenKey =
      (this.activeScreenKey || activeScreen?.screenKey || activeScreen?.pageName || effectiveErpKey || '').trim() ||
      undefined;
    const msgFilters = msg.filters || this.activeFilter;
    const effectiveTraceId =
      traceId || this.telemetry?.getTraceId() || `trc_${Math.random().toString(36).substring(2, 8)}`;

    await this.copilotService.streamGeneralChat({
      query,
      history: this.buildChatHistory(historyUpToIndex, query),
      threadId: msg.threadId || this.activeThreadId,
      erpKey: effectiveErpKey,
      activeScreenKey: effectiveScreenKey,
      lessonId: msg.lessonId || msgFilters?.lessonId || this.activeLessonId,
      lessonIds: msg.lessonIds || msgFilters?.lessonIds,
      candidates: this.getBridgeNavCandidates(),
      traceId: effectiveTraceId,
      onSources: (sources: CopilotSource[]) => {
        msg.sources = this.deduplicateSources(sources);
        this.cdr.markForCheck();
        this.scrollToBottom();
      },
      onToken: (token: string) => {
        this.activeToolStatus = null;
        msg.text += token;
        this.cdr.markForCheck();
        this.scrollToBottom();
      },
      onNavAction: (action: GeneralChatNavAction) => {
        void this.handleGeneralChatNavAction(action, msg, query);
      },
      onToolEvent: (ev) => {
        const toolName = ev.tool || ev.name || '';
        if (ev.type === 'tool_start') {
          this.activeToolStatus = toolName === 'search_lms_lessons'
            ? '🔍 جاري البحث في شروحات النظام...'
            : toolName === 'navigate_erp_screen'
              ? '🧭 جاري تجهيز التنقل للشاشة...'
              : '⚙️ جاري تنفيذ الأداة...';
        } else if (ev.type === 'tool_end') {
          this.activeToolStatus = null;
        }
        this.telemetry?.log('GENERAL', `Unified chat tool ${ev.type}: ${toolName}`, ev);
        this.cdr.markForCheck();
        this.scrollToBottom();
      },
      onDone: (meta) => {
        this.activeToolStatus = null;
        this.finalizeStreamMeta(msg, meta);
      },
      onError: (err) => {
        this.activeToolStatus = null;
        msg.text += msg.isRetrying
          ? '\n\n⚠️ تعذر إعادة المحاولة.'
          : '\n\n⚠️ تعذر إكمال الإجابة. يرجى التأكد من تشغيل محرك الذكاء الاصطناعي.';
        msg.isStreaming = false;
        msg.isRetrying = false;
        this.isStreaming = false;
        this.telemetry?.logError('USER_QUERY', 'streamGeneralChat error', err);
        this.cdr.markForCheck();
      }
    });
  }

  private async streamQuery(query: string, skipCache: boolean = false) {
    this.isStreaming = true;

    if (this.shouldUseUnifiedChat()) {
      const assistantMsg: ChatMessage = {
        sender: 'assistant',
        text: '',
        sources: [],
        isStreaming: true,
        usedUnifiedChat: true,
        threadId: this.activeThreadId,
        relatedUserQuery: query,
        filters: { ...this.activeFilter },
        lessonId: this.activeLessonId || this.activeFilter.lessonId,
        lessonIds: this.activeFilter.lessonIds ? [...this.activeFilter.lessonIds] : undefined
      };
      this.messages.push(assistantMsg);
      this.cdr.markForCheck();
      this.scrollToBottom();
      await this.executeGeneralChatForMessage(query, assistantMsg);
      return;
    }

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
    this.cdr.markForCheck();
    this.scrollToBottom();

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
        this.finalizeStreamMeta(this.messages[assistantMsgIndex], meta);
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
      undefined,
      this.erpKey,
      undefined,
      undefined,
      'question'
    );
  }

  async retryMessage(msgIndex: number) {
    const msg = this.messages[msgIndex];
    if (!msg || this.isStreaming || msg.isStreaming) return;

    const userQuery = msg.relatedUserQuery;
    if (!userQuery) return;

    const retryThreadId = msg.threadId || this.activeThreadId;
    const isLastMessage = msgIndex === this.messages.length - 1;
    const historyCutoff = msgIndex > 0 && this.messages[msgIndex - 1]?.sender === 'user' ? msgIndex - 1 : msgIndex;

    let targetMsg: ChatMessage;
    if (isLastMessage) {
      msg.text = '';
      msg.sources = [];
      msg.askOptions = undefined;
      msg.provenance = undefined;
      msg.latencyMs = undefined;
      msg.rating = null;
      msg.feedbackSubmitted = false;
      msg.feedbackComment = '';
      msg.showCommentBox = false;
      msg.selectedReasonTag = undefined;
      msg.isStreaming = true;
      msg.isRetrying = true;
      msg.threadId = retryThreadId;
      targetMsg = msg;
    } else {
      // Retrying an earlier turn appends a fresh question + answer pair at the bottom and focuses it
      this.messages.push({
        sender: 'user',
        text: userQuery
      });
      targetMsg = {
        sender: 'assistant',
        text: '',
        sources: [],
        isStreaming: true,
        isRetrying: true,
        usedUnifiedChat: msg.usedUnifiedChat,
        threadId: retryThreadId,
        relatedUserQuery: userQuery,
        filters: msg.filters ? { ...msg.filters } : { ...this.activeFilter },
        lessonId: msg.lessonId,
        lessonIds: msg.lessonIds ? [...msg.lessonIds] : undefined
      };
      this.messages.push(targetMsg);
    }

    const traceId = 'trc_' + Math.random().toString(36).substring(2, 8);
    this.telemetry?.setTraceId(traceId);
    this.isStreaming = true;
    this.cdr.markForCheck();
    this.scrollToBottom();

    const useUnifiedForRetry =
      this.useUnifiedChat &&
      !this.isActionMode &&
      !this.isVisionAgentMode &&
      (targetMsg.usedUnifiedChat === true ||
        (targetMsg.usedUnifiedChat !== false && this.shouldUseUnifiedChat(targetMsg.filters || this.activeFilter)));

    if (useUnifiedForRetry) {
      targetMsg.usedUnifiedChat = true;
      await this.executeGeneralChatForMessage(userQuery, targetMsg, traceId, historyCutoff);
      return;
    }

    await this.copilotService.streamSearch(
      userQuery,
      targetMsg.lessonId,
      (sources) => {
        targetMsg.sources = this.deduplicateSources(sources);
        this.cdr.markForCheck();
        this.scrollToBottom();
      },
      (token) => {
        targetMsg.text += token;
        this.cdr.markForCheck();
        this.scrollToBottom();
      },
      (meta?: any) => {
        this.finalizeStreamMeta(targetMsg, meta);
      },
      () => {
        targetMsg.text += '\n\n⚠️ تعذر إعادة المحاولة.';
        targetMsg.isStreaming = false;
        targetMsg.isRetrying = false;
        this.isStreaming = false;
        this.cdr.markForCheck();
        this.scrollToBottom();
      },
      true,
      targetMsg.filters || this.activeFilter
    );
  }

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

  readonly feedbackReasons: string[] = [
    'معلومات غير دقيقة',
    'شرح ناقص أو غير مكتمل',
    'مصادر غير مطابقة',
    'لم تجب على سؤالي'
  ];

  toggleRating(msgIndex: number, newRating: 'UP' | 'DOWN') {
    const msg = this.messages[msgIndex];
    if (msg.isSubmittingFeedback) return;

    if (newRating === 'UP') {
      msg.showCommentBox = false;
      msg.rating = 'UP';
      this.submitFeedback(msgIndex, 'UP', '');
    } else {
      msg.rating = 'DOWN';
      msg.showCommentBox = true;
      if (!msg.feedbackComment) {
        msg.feedbackComment = '';
      }
    }
  }

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

  submitDownvote(msgIndex: number, skipComment: boolean = false) {
    const msg = this.messages[msgIndex];
    const comment = skipComment ? '' : (msg.feedbackComment || '').trim();
    msg.showCommentBox = false;
    this.submitFeedback(msgIndex, 'DOWN', comment);
  }

  closeCommentBox(msgIndex: number) {
    const msg = this.messages[msgIndex];
    msg.showCommentBox = false;
  }

  private submitFeedback(msgIndex: number, rating: 'UP' | 'DOWN', comment: string) {
    const msg = this.messages[msgIndex];
    msg.isSubmittingFeedback = true;

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

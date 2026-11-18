import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { of } from 'rxjs';
import { CopilotChatComponent } from './copilot-chat.component';
import { CopilotService, GeneralChatStreamParams } from '../../../core/services/ai-copilot/copilot.service';
import { AuthService } from '../../../core/services/platform-core/auth.service';
import {
  ErpBridgeService,
  ErpFormDriverService,
  ErpNavigatorService
} from '../../../core/services/erp-automation';

describe('CopilotChatComponent - Unified General Chat Routing & Nav Action', () => {
  let fixture: ComponentFixture<CopilotChatComponent>;
  let component: CopilotChatComponent;
  let mockCopilotService: jasmine.SpyObj<CopilotService>;
  let mockBridge: jasmine.SpyObj<ErpBridgeService>;
  let mockNavigator: jasmine.SpyObj<ErpNavigatorService>;

  beforeEach(async () => {
    mockCopilotService = jasmine.createSpyObj('CopilotService', [
      'activeLessonId$',
      'checkReadiness',
      'getCopilotFilters',
      'setBaseUrls',
      'feedbackErpNavigation',
      'sendErpTelemetry',
      'streamSearch',
      'streamGeneralChat'
    ]);
    Object.defineProperty(mockCopilotService, 'activeLessonId$', { value: of(undefined) });
    mockCopilotService.checkReadiness.and.returnValue(of({ status: 'ok', ready: true }));
    mockCopilotService.getCopilotFilters.and.returnValue(of({ modules: [], levels: [], types: [] }));
    mockCopilotService.sendErpTelemetry.and.resolveTo({ status: 'ok' });
    mockCopilotService.streamSearch.and.resolveTo();
    mockCopilotService.streamGeneralChat.and.resolveTo();

    mockBridge = jasmine.createSpyObj('ErpBridgeService', ['getActiveScreen', 'listScreens'], { isAvailable: true });
    mockBridge.getActiveScreen.and.returnValue({ pageId: 289, pageName: 'Purchases', screenKey: 'PURCHASE_INVOICE' });
    mockBridge.listScreens.and.returnValue([
      { pageId: 244, pageName: 'Sales', screenKey: 'SALES_INVOICE', title: 'فواتير المبيعات' }
    ]);

    mockNavigator = jasmine.createSpyObj('ErpNavigatorService', [
      'isScreenActive',
      'getFormMode',
      'scanVisibleCandidates',
      'navigateToScreen'
    ]);
    mockNavigator.isScreenActive.and.returnValue(false);
    mockNavigator.getFormMode.and.returnValue('ClosedOrList');
    mockNavigator.scanVisibleCandidates.and.returnValue([
      { id: '244', label: 'فواتير المبيعات', path: ['العملاء والمبيعات'] }
    ]);
    mockNavigator.navigateToScreen.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [CopilotChatComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        provideMarkdown(),
        { provide: CopilotService, useValue: mockCopilotService },
        { provide: AuthService, useValue: { userRole: () => 'Student', isAuthenticated: () => true } },
        { provide: ErpBridgeService, useValue: mockBridge },
        { provide: ErpNavigatorService, useValue: mockNavigator },
        {
          provide: ErpFormDriverService,
          useValue: jasmine.createSpyObj('ErpFormDriverService', ['collectFormSchema', 'buildVisibleFieldsSummary'])
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CopilotChatComponent);
    component = fixture.componentInstance;
    component.inline = true;
    component.erpKey = 'Purchases';
    component.activeScreenKey = 'PURCHASE_INVOICE';
    fixture.detectChanges();
  });

  it('defaults useUnifiedChat to true and shows General Chat + LMS banner until mcpEnabled becomes true', async () => {
    expect(component.useUnifiedChat).toBeTrue();
    expect(component.mcpEnabled).toBeFalse();
    expect(fixture.nativeElement.querySelector('.ai-status-banner.info')?.textContent).toContain('وضع الدردشة العامة + LMS');

    mockCopilotService.streamGeneralChat.and.callFake(async (params: GeneralChatStreamParams) => {
      params.onToken?.('مرحباً!');
      params.onDone?.({ thread_id: 't-1', mcp_enabled: true, provider: 'google', model: 'gemini-3.5-flash-lite' });
    });

    component.inputQuery = 'أهلاً';
    await component.sendMessage();
    fixture.detectChanges();

    expect(component.mcpEnabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('.ai-status-banner.info')).toBeNull();
  });

  it('routes sendMessage and retryMessage via streamGeneralChat with bounded 6-message history, candidates, screen keys, and threadId', async () => {
    for (let i = 1; i <= 4; i++) {
      component.messages.push({ sender: 'user', text: `سؤال ${i}` });
      component.messages.push({ sender: 'assistant', text: `إجابة ${i}` });
    }
    component.activeThreadId = 'thr-42';

    let capturedSendParams: GeneralChatStreamParams | undefined;
    mockCopilotService.streamGeneralChat.and.callFake(async (params: GeneralChatStreamParams) => {
      capturedSendParams = params;
      params.onToken?.('إجابة موحدة');
      params.onNavAction?.({
        decision: 'go',
        screen: 'فواتير المبيعات',
        pageId: 244,
        screenKey: 'SALES_INVOICE',
        reason: 'requested'
      });
      params.onDone?.({ thread_id: 'thr-43', mcp_enabled: false, provider: 'google', model: 'gemini-3.5-flash-lite' });
    });

    component.inputQuery = 'افتح شاشة المبيعات';
    await component.sendMessage();

    expect(mockCopilotService.streamSearch).not.toHaveBeenCalled();
    expect(capturedSendParams).toBeDefined();
    expect(capturedSendParams?.query).toBe('افتح شاشة المبيعات');
    expect(capturedSendParams?.history?.length).toBe(6);
    expect(capturedSendParams?.history?.[0]).toEqual({ role: 'user', content: 'سؤال 2' });
    expect(capturedSendParams?.candidates).toEqual([{ id: '244', label: 'فواتير المبيعات', path: ['العملاء والمبيعات'] }]);
    expect(capturedSendParams?.erpKey).toBe('Purchases');
    expect(capturedSendParams?.activeScreenKey).toBe('PURCHASE_INVOICE');
    expect(capturedSendParams?.threadId).toBe('thr-42');
    expect(mockNavigator.navigateToScreen).toHaveBeenCalledWith('244');
    expect(component.activeThreadId).toBe('thr-43');

    // Retry re-uses streamGeneralChat with preserved threadId and history prior to the retried turn
    let capturedRetryParams: GeneralChatStreamParams | undefined;
    mockCopilotService.streamGeneralChat.and.callFake(async (params: GeneralChatStreamParams) => {
      capturedRetryParams = params;
      params.onToken?.('إجابة معادة');
      params.onDone?.({ thread_id: 'thr-43', mcp_enabled: false });
    });

    await component.retryMessage(component.messages.length - 1);
    expect(mockCopilotService.streamSearch).not.toHaveBeenCalled();
    expect(capturedRetryParams?.query).toBe('افتح شاشة المبيعات');
    expect(capturedRetryParams?.threadId).toBe('thr-43');
    expect(capturedRetryParams?.history?.length).toBe(6);
  });

  it('falls back to classic streamSearch when useUnifiedChat is false or manual lesson filter is set', async () => {
    mockCopilotService.streamSearch.and.callFake(async (_q, _l, _s, _t, onDone) => {
      onDone?.({ provenance: 'QDRANT_RAG' });
    });

    component.useUnifiedChat = false;
    component.inputQuery = 'سؤال كلاسيكي';
    await component.sendMessage();
    expect(mockCopilotService.streamSearch).toHaveBeenCalledTimes(1);
    expect(mockCopilotService.streamGeneralChat).not.toHaveBeenCalled();

    mockCopilotService.streamSearch.calls.reset();
    component.useUnifiedChat = true;
    component.activeFilter = { scope: 'lesson', lessonId: 'lesson-99' };
    component.inputQuery = 'سؤال مقيد بالدرس';
    await component.sendMessage();
    expect(mockCopilotService.streamSearch).toHaveBeenCalledTimes(1);
    expect(mockCopilotService.streamGeneralChat).not.toHaveBeenCalled();
  });

  it('defaults to clean unified UI state, updates activeToolStatus, and sends starter prompts', async () => {
    expect(component.allowLegacyActionMode).toBeFalse();
    expect(component.isFilterBarCollapsed).toBeTrue();
    expect(component.unifiedStarterPrompts.length).toBe(3);

    let observedToolStatusDuringStream: string | null = null;
    mockCopilotService.streamGeneralChat.and.callFake(async (params: GeneralChatStreamParams) => {
      params.onToolEvent?.({ type: 'tool_start', tool: 'search_lms_lessons' });
      observedToolStatusDuringStream = component.activeToolStatus;
      params.onToken?.('تم العثور على الشرح');
      expect(component.activeToolStatus).toBeNull();
      params.onDone?.({ thread_id: 'thr-starter', mcp_enabled: false });
    });

    component.applyStarterPrompt(component.unifiedStarterPrompts[1].query);
    await Promise.resolve();
    await Promise.resolve();

    expect(observedToolStatusDuringStream).toContain('شروحات النظام');
    expect(component.activeToolStatus).toBeNull();
    expect(mockCopilotService.streamGeneralChat).toHaveBeenCalled();
  });
});

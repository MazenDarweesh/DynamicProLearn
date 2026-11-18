import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { of } from 'rxjs';
import { ChatMessage, CopilotChatComponent } from './copilot-chat.component';
import { CopilotService } from '../../../core/services/ai-copilot/copilot.service';
import { AuthService } from '../../../core/services/platform-core/auth.service';
import {
  ErpBridgeService,
  ErpFormDriverService,
  ErpNavigatorService,
} from '../../../core/services/erp-automation';
import { ErpFormMode, ErpFormStateSnapshot } from '../../../core/models/erp-bridge.models';

describe('CopilotChatComponent - Save Guards & SavedOpen Edit Card', () => {
  let component: CopilotChatComponent;
  let fixture: ComponentFixture<CopilotChatComponent>;
  let mockCopilotService: jasmine.SpyObj<CopilotService>;
  let mockBridge: jasmine.SpyObj<ErpBridgeService>;
  let mockNavigator: jasmine.SpyObj<ErpNavigatorService>;
  let mockFormDriver: jasmine.SpyObj<ErpFormDriverService>;
  let mockHostState: ErpFormStateSnapshot;
  let mockMode: ErpFormMode;

  beforeEach(async () => {
    mockHostState = { isOpen: true, mode: 'saved', dirty: false, docId: 13757, docNumber: 231 };
    mockMode = 'SavedOpen';

    mockCopilotService = jasmine.createSpyObj('CopilotService', [
      'activeLessonId$',
      'checkReadiness',
      'getCopilotFilters',
      'setBaseUrls',
      'feedbackErpNavigation',
      'sendErpTelemetry',
      'streamSearch',
    ]);
    Object.defineProperty(mockCopilotService, 'activeLessonId$', { value: of(undefined) });
    mockCopilotService.checkReadiness.and.returnValue(of({ status: 'ok', ready: true }));
    mockCopilotService.getCopilotFilters.and.returnValue(of({ modules: [], levels: [], types: [] }));
    mockCopilotService.sendErpTelemetry.and.resolveTo({ status: 'ok' });
    mockCopilotService.streamSearch.and.resolveTo();

    const mockAuthService = {
      userRole: () => 'Student',
      isAuthenticated: () => true,
    };

    mockBridge = jasmine.createSpyObj('ErpBridgeService', [
      'getActiveScreen',
      'getFormState',
      'getActiveFormContext',
      'submitActiveForm',
    ], { isAvailable: true });
    mockBridge.getActiveScreen.and.returnValue({ pageId: 289, pageName: 'Purchases' });
    mockBridge.getFormState.and.callFake(() => mockHostState);
    mockBridge.getActiveFormContext.and.returnValue({
      isOpen: true,
      screenName: 'Purchases',
      dataObject: { POID: 13757, PONumber: 231, StoreID: 'مخزن قديم' },
      rows: [{ new: false, ProductID: 36962, Quntity: '10' }],
    });
    mockBridge.submitActiveForm.and.resolveTo({ success: true, outcome: 'saved', docId: '13757' });

    mockNavigator = jasmine.createSpyObj('ErpNavigatorService', [
      'isScreenActive',
      'navigateToScreen',
      'resolveAndNavigate',
      'prepareFreshForm',
      'getFormMode',
    ]);
    mockNavigator.isScreenActive.and.returnValue(true);
    mockNavigator.navigateToScreen.and.resolveTo(true);
    mockNavigator.resolveAndNavigate.and.resolveTo({
      success: true,
      decision: 'go',
      chosen: { id: 'Purchases', confidence: 0.99, reason: 'match' },
      rawResolution: {
        decision: 'go',
        intent: 'action',
        candidates: [{ id: 'Purchases', confidence: 0.99, reason: 'match' }],
      },
    });
    mockNavigator.prepareFreshForm.and.resolveTo(true);
    mockNavigator.getFormMode.and.callFake(() => mockMode);

    mockFormDriver = jasmine.createSpyObj('ErpFormDriverService', [
      'collectFormSchema',
      'buildVisibleFieldsSummary',
      'settle',
      'applyProgressiveFill',
    ]);
    mockFormDriver.collectFormSchema.and.returnValue([
      { key: 'StoreID', label: 'المخزن', kind: 'ng-select', group: 'header' },
    ]);
    mockFormDriver.buildVisibleFieldsSummary.and.returnValue(['StoreID']);
    mockFormDriver.settle.and.resolveTo();
    mockFormDriver.applyProgressiveFill.and.resolveTo({
      success: true,
      fieldsProcessed: 1,
      filledCount: 1,
      results: [{ field: 'StoreID', value: 'مخزن خامات', status: 'filled' }],
    });

    await TestBed.configureTestingModule({
      imports: [CopilotChatComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        provideMarkdown(),
        { provide: CopilotService, useValue: mockCopilotService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ErpBridgeService, useValue: mockBridge },
        { provide: ErpNavigatorService, useValue: mockNavigator },
        { provide: ErpFormDriverService, useValue: mockFormDriver },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CopilotChatComponent);
    component = fixture.componentInstance;
    component.inline = true;
    fixture.detectChanges();
  });

  it('refuses save when getFormState reports mode=saved and dirty=false', async () => {
    mockHostState = { isOpen: true, mode: 'saved', dirty: false, docId: 13757, docNumber: 231 };
    const msg: ChatMessage = {
      sender: 'assistant',
      text: 'تعديل',
      formFillApplied: true,
      targetFormMode: 'SavedOpen',
    };

    await component.confirmSave(msg, true);

    expect(mockBridge.submitActiveForm).not.toHaveBeenCalled();
    expect(msg.saveStatus).toBe('saved');
    expect(msg.saveMessage).toContain('محفوظ بالفعل');
  });

  it('prevents overlapping concurrent saves via isSavingInFlight', async () => {
    mockHostState = { isOpen: true, mode: 'new', dirty: true };
    mockMode = 'UnsavedDraft';
    let resolveSubmit!: (v: any) => void;
    mockBridge.submitActiveForm.and.returnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      })
    );

    const msg1: ChatMessage = { sender: 'assistant', text: '1', formFillApplied: true };
    const msg2: ChatMessage = { sender: 'assistant', text: '2', formFillApplied: true };

    const p1 = component.confirmSave(msg1, true);
    expect(component.isSavingInFlight).toBeTrue();
    await component.confirmSave(msg2, true);
    expect(mockBridge.submitActiveForm).toHaveBeenCalledTimes(1);

    resolveSubmit({ success: true, outcome: 'saved', docId: '999' });
    await p1;
    expect(component.isSavingInFlight).toBeFalse();
  });

  it('forces manual Edit Card confirmation with Diff table on SavedOpen even when autoSaveAfterFill=true', async () => {
    component.autoSaveAfterFill = true;
    mockMode = 'SavedOpen';
    mockHostState = { isOpen: true, mode: 'saved', dirty: true, docId: 13757, docNumber: 231 };

    const editMsg: ChatMessage = {
      sender: 'assistant',
      text: '',
      relatedUserQuery: 'عدل المخزن إلى مخزن خامات',
      formFillData: {
        intent: 'form_fill',
        screenKey: 'Purchases',
        pageId: 289,
        fields: { StoreID: 'مخزن خامات' },
        rows: [],
      },
    };
    component.messages.push(editMsg);

    await component.applyFormFill(editMsg);
    fixture.detectChanges();

    // Never wipes SavedOpen or calls auto-save!
    expect(mockNavigator.prepareFreshForm).not.toHaveBeenCalled();
    expect(mockBridge.submitActiveForm).not.toHaveBeenCalled();
    expect(editMsg.targetFormMode).toBe('SavedOpen');
    expect(editMsg.requiresExplicitUpdateConfirm).toBeTrue();
    expect(editMsg.formDiff?.length).toBe(1);

    // Renders Diff table & Edit Card confirm button in DOM
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.form-fill-card-edit')).not.toBeNull();
    expect(el.querySelector('.form-fill-diff-table')?.textContent).toContain('مخزن خامات');

    // Programmatic confirm without Edit Card click stays blocked
    await component.confirmSave(editMsg, false);
    expect(mockBridge.submitActiveForm).not.toHaveBeenCalled();

    // Clicking the Edit Card button executes save once and locks afterward
    const confirmBtn = el.querySelector<HTMLButtonElement>('.btn-confirm-save-edit')!;
    expect(confirmBtn).not.toBeNull();
    expect(confirmBtn.textContent).toContain('تأكيد حفظ التعديلات الآن');
    confirmBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockBridge.submitActiveForm).toHaveBeenCalledTimes(1);
    expect(editMsg.saveStatus).toBe('saved');
  });

  it('still allows autoSaveAfterFill on a brand new EmptyNew form', async () => {
    component.autoSaveAfterFill = true;
    mockMode = 'EmptyNew';
    mockHostState = { isOpen: true, mode: 'new', dirty: false };
    mockBridge.getActiveFormContext.and.returnValue({
      isOpen: true,
      screenName: 'Purchases',
      dataObject: { EmployeeId: 5269 },
      rows: [{ new: true }],
    });

    const newMsg: ChatMessage = {
      sender: 'assistant',
      text: '',
      relatedUserQuery: 'سجل فاتورة مشتريات جديدة',
      formPrepared: true,
      formFillData: {
        intent: 'form_fill',
        screenKey: 'Purchases',
        pageId: 289,
        fields: { StoreID: 'مخزن خامات' },
        rows: [],
      },
    };

    await component.applyFormFill(newMsg);

    expect(mockBridge.submitActiveForm).toHaveBeenCalledTimes(1);
    expect(newMsg.saveStatus).toBe('saved');
  });

  it('prompts 2-choice confirmation on UnsavedDraft + action_intent=new and resets via prepareFreshForm(resetDraft:true) when confirmed', async () => {
    mockMode = 'UnsavedDraft';
    mockHostState = { isOpen: true, mode: 'new', dirty: true };
    mockNavigator.prepareFreshForm.and.callFake(async (_ms, opts) => {
      if (opts?.resetDraft) {
        mockMode = 'EmptyNew';
        mockHostState = { isOpen: true, mode: 'new', dirty: false };
      }
      return true;
    });

    const draftConflictMsg: ChatMessage = {
      sender: 'assistant',
      text: '',
      relatedUserQuery: 'سجل فاتورة مشتريات جديدة',
      formFillData: {
        intent: 'form_fill',
        action_intent: 'new',
        screenKey: 'Purchases',
        pageId: 289,
        fields: { StoreID: 'مخزن خامات' },
        rows: [],
      },
    };
    component.messages.push(draftConflictMsg);

    // 1. Applying immediately pauses for explicit 2-choice user confirmation without calling triggerAddNew/prepareFreshForm
    await component.applyFormFill(draftConflictMsg);
    fixture.detectChanges();

    expect(mockNavigator.prepareFreshForm).not.toHaveBeenCalled();
    expect(mockFormDriver.applyProgressiveFill).not.toHaveBeenCalled();
    expect(draftConflictMsg.requiresDraftResetConfirm).toBeTrue();
    expect(draftConflictMsg.draftResetDecision).toBe('pending');

    const el: HTMLElement = fixture.nativeElement;
    const confirmBox = el.querySelector('.form-fill-draft-confirm');
    expect(confirmBox).not.toBeNull();
    expect(confirmBox?.querySelectorAll('button').length).toBe(2);

    const resetBtn = el.querySelector<HTMLButtonElement>('.btn-confirm-draft-reset')!;
    expect(resetBtn).not.toBeNull();
    resetBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockNavigator.prepareFreshForm).toHaveBeenCalledWith(component.formPrepareTimeoutMs, { resetDraft: true });
    expect(mockFormDriver.applyProgressiveFill).toHaveBeenCalledTimes(1);
    expect(draftConflictMsg.draftResetDecision).toBe('reset_and_new');
    expect(draftConflictMsg.formFillApplied).toBeTrue();
  });

  it('keeps UnsavedDraft intact when user selects keep-draft without calling prepareFreshForm or applying fields', async () => {
    mockMode = 'UnsavedDraft';
    mockHostState = { isOpen: true, mode: 'new', dirty: true };

    const draftConflictMsg: ChatMessage = {
      sender: 'assistant',
      text: '',
      relatedUserQuery: 'سجل فاتورة مشتريات جديدة',
      formFillData: {
        intent: 'form_fill',
        action_intent: 'new',
        screenKey: 'Purchases',
        pageId: 289,
        fields: { StoreID: 'مخزن خامات' },
        rows: [],
      },
    };
    component.messages.push(draftConflictMsg);

    await component.applyFormFill(draftConflictMsg);
    fixture.detectChanges();

    const keepBtn = fixture.nativeElement.querySelector('.btn-cancel-draft-reset') as HTMLButtonElement;
    expect(keepBtn).not.toBeNull();
    keepBtn.click();
    fixture.detectChanges();

    expect(draftConflictMsg.draftResetDecision).toBe('keep_draft');
    expect(draftConflictMsg.requiresDraftResetConfirm).toBeFalse();
    expect(mockNavigator.prepareFreshForm).not.toHaveBeenCalled();
    expect(mockFormDriver.applyProgressiveFill).not.toHaveBeenCalled();
    expect(component.messages.some((m) => m.text.includes('تم الإبقاء على المسودة الحالية'))).toBeTrue();
  });

  it('lets structured action_intent override conflicting query regex in both directions', async () => {
    mockMode = 'SavedOpen';
    mockHostState = { isOpen: true, mode: 'saved', dirty: true, docId: 13757, docNumber: 231 };
    mockNavigator.prepareFreshForm.and.callFake(async () => {
      mockMode = 'EmptyNew';
      mockHostState = { isOpen: true, mode: 'new', dirty: false };
      return true;
    });

    // Conflict A: query matches edit regex ("عدل ... وغير ...") BUT action_intent='new' -> must reset SavedOpen!
    const forceNewMsg: ChatMessage = {
      sender: 'assistant',
      text: '',
      relatedUserQuery: 'عدل المورد وغير المخزن لفاتورة مستقلة جديدة',
      formFillData: {
        intent: 'form_fill',
        action_intent: 'new',
        screenKey: 'Purchases',
        pageId: 289,
        fields: { StoreID: 'مخزن خامات' },
        rows: [],
      },
    };
    await component.applyFormFill(forceNewMsg);
    expect(mockNavigator.prepareFreshForm).toHaveBeenCalledWith(component.formPrepareTimeoutMs, { resetSaved: true });
    expect(forceNewMsg.targetFormMode).toBeUndefined();
    expect(forceNewMsg.requiresExplicitUpdateConfirm).toBeFalse();

    // Conflict B: query has ZERO edit regex keywords BUT action_intent='edit_current' -> must keep SavedOpen Edit Card!
    mockNavigator.prepareFreshForm.calls.reset();
    mockMode = 'SavedOpen';
    mockHostState = { isOpen: true, mode: 'saved', dirty: true, docId: 13757, docNumber: 231 };

    const forceEditMsg: ChatMessage = {
      sender: 'assistant',
      text: '',
      relatedUserQuery: 'خلي المخزن خامات',
      formFillData: {
        intent: 'form_fill',
        action_intent: 'edit_current',
        screenKey: 'Purchases',
        pageId: 289,
        fields: { StoreID: 'مخزن خامات' },
        rows: [],
      },
    };
    await component.applyFormFill(forceEditMsg);
    expect(mockNavigator.prepareFreshForm).not.toHaveBeenCalled();
    expect(forceEditMsg.targetFormMode).toBe('SavedOpen');
    expect(forceEditMsg.requiresExplicitUpdateConfirm).toBeTrue();
  });

  it('defers prepareFreshForm during streamQuery on SavedOpen/UnsavedDraft until fillData arrives', async () => {
    component.isActionMode = true;
    mockMode = 'SavedOpen';
    mockHostState = { isOpen: true, mode: 'saved', dirty: false, docId: 13757, docNumber: 231 };

    let prepareCallsBeforeFillData = -1;
    mockCopilotService.streamSearch.and.callFake(
      async (
        _q: string,
        _lessonId: any,
        _onSources: any,
        _onToken: any,
        onDone: any,
        _onErr: any,
        _skipCache: any,
        _filters: any,
        _threadId: any,
        _visibleFields: any,
        _erpKey: any,
        onFormFill: any
      ) => {
        prepareCallsBeforeFillData = mockNavigator.prepareFreshForm.calls.count();
        onFormFill({
          intent: 'form_fill',
          action_intent: 'new',
          screenKey: 'Purchases',
          pageId: 289,
          fields: { StoreID: 'مخزن خامات' },
          rows: [],
        });
        onDone({ thread_id: 't1' });
      }
    );

    mockNavigator.prepareFreshForm.and.callFake(async () => {
      mockMode = 'EmptyNew';
      return true;
    });

    component.inputQuery = 'سجل فاتورة مشتريات جديدة للمورد حسين';
    await component.sendMessage();

    // Must NOT wipe SavedOpen before fillData arrives; runs after fillData arrives with action_intent='new'
    expect(prepareCallsBeforeFillData).toBe(0);
    expect(mockNavigator.prepareFreshForm).toHaveBeenCalledTimes(1);
    expect(mockNavigator.prepareFreshForm).toHaveBeenCalledWith(component.formPrepareTimeoutMs, { resetSaved: true });

    // On UnsavedDraft + streamQuery -> defers prepareFreshForm and renders 2-choice prompt when action_intent='new' arrives
    mockNavigator.prepareFreshForm.calls.reset();
    mockMode = 'UnsavedDraft';
    mockHostState = { isOpen: true, mode: 'new', dirty: true };
    component.inputQuery = 'سجل فاتورة مشتريات جديدة للمورد حسين';
    await component.sendMessage();

    const latestAssistant = component.messages[component.messages.length - 1];
    expect(mockNavigator.prepareFreshForm).not.toHaveBeenCalled();
    expect(latestAssistant.requiresDraftResetConfirm).toBeTrue();
    expect(latestAssistant.draftResetDecision).toBe('pending');
  });

  it('aborts loudly with explicit user error and zero silent fill when deferred prepareFreshForm times out on SavedOpen', async () => {
    mockMode = 'SavedOpen';
    mockHostState = { isOpen: true, mode: 'saved', dirty: false, docId: 13757, docNumber: 231 };
    component.formPrepareTimeoutMs = 50;
    // Simulate a hung host triggerAddNew / prepareFreshForm promise that exceeds formPrepareTimeoutMs
    mockNavigator.prepareFreshForm.and.returnValue(new Promise<boolean>(() => {}));

    const newOnSavedMsg: ChatMessage = {
      sender: 'assistant',
      text: '',
      relatedUserQuery: 'سجل فاتورة مشتريات جديدة',
      formFillData: {
        intent: 'form_fill',
        action_intent: 'new',
        screenKey: 'Purchases',
        pageId: 289,
        fields: { StoreID: 'مخزن خامات' },
        rows: [],
      },
    };
    component.messages.push(newOnSavedMsg);

    await component.applyFormFill(newOnSavedMsg);
    fixture.detectChanges();

    expect(newOnSavedMsg.formPrepared).toBeFalse();
    expect(newOnSavedMsg.formPrepError).toContain('تعذر فتح فاتورة جديدة');
    expect(mockFormDriver.applyProgressiveFill).not.toHaveBeenCalled();
    expect(component.messages.some((m) => m.text.includes('تعذر فتح فاتورة جديدة'))).toBeTrue();
    expect(fixture.nativeElement.querySelector('.save-result-err')?.textContent).toContain('تعذر فتح فاتورة جديدة');
  });

  it('shows clear "غير مدعوم حالياً" message and skips wrong form fill on unexecutable edit_current header-grid transfer', async () => {
    component.isActionMode = true;
    mockMode = 'SavedOpen';
    mockHostState = { isOpen: true, mode: 'saved', dirty: false, docId: 13757, docNumber: 231 };

    mockCopilotService.streamSearch.and.callFake(
      async (
        _q: string,
        _lessonId: any,
        _onSources: any,
        _onToken: any,
        onDone: any,
        _onErr: any,
        _skipCache: any,
        _filters: any,
        _threadId: any,
        _visibleFields: any,
        _erpKey: any,
        onFormFill: any
      ) => {
        onFormFill({
          intent: 'form_fill',
          action_intent: 'edit_current',
          screenKey: 'Purchases',
          pageId: 289,
          fields: { ProjectID: null },
          rows: [],
        });
        onDone({ thread_id: 't-unsupported' });
      }
    );

    component.inputQuery = 'احذف  المشروع من فوق وخليه تحت مع المنتج فقط';
    await component.sendMessage();
    fixture.detectChanges();

    const streamedCard = component.messages.find((m) => m.sender === 'assistant' && m.formFillData);
    expect(streamedCard).toBeDefined();
    expect(streamedCard?.unsupportedEditReason).toContain('غير مدعوم حالياً');
    expect(mockFormDriver.applyProgressiveFill).not.toHaveBeenCalled();
    expect(mockNavigator.prepareFreshForm).not.toHaveBeenCalled();
    expect(mockBridge.submitActiveForm).not.toHaveBeenCalled();
    expect(component.messages.some((m) => m.text.includes('غير مدعوم حالياً'))).toBeTrue();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.form-fill-unsupported-edit')?.textContent).toContain('غير مدعوم حالياً');
    expect(el.querySelector('.btn-apply-form-fill')).toBeNull();

    // Even direct applyFormFill invocation refuses to apply wrong data
    await component.applyFormFill(streamedCard!);
    expect(mockFormDriver.applyProgressiveFill).not.toHaveBeenCalled();
  });
});


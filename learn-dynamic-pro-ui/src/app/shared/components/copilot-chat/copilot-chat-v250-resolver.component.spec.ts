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
  ErpLookupFieldSpec,
  ErpNavigatorService,
  StrictLookupFetchResult
} from '../../../core/services/erp-automation';
import { ErpFormMode, ErpFormStateSnapshot, FormFieldSchema } from '../../../core/services/erp-automation';
import {
  evaluateActiveScreenMatch,
  isPureNavigationQuery
} from './utils/copilot-host-bridge.helper';

describe('CopilotChatComponent - Wave 1 Purchases v2.5.0 Resolver & Save Flow (Step 3)', () => {
  let component: CopilotChatComponent;
  let fixture: ComponentFixture<CopilotChatComponent>;
  let mockCopilotService: jasmine.SpyObj<CopilotService>;
  let mockBridge: jasmine.SpyObj<ErpBridgeService>;
  let mockNavigator: jasmine.SpyObj<ErpNavigatorService>;
  let mockFormDriver: jasmine.SpyObj<ErpFormDriverService>;
  let supportsV250Flag: boolean;
  let activePageId: number;
  let activePageName: string;
  let mockMode: ErpFormMode;
  let mockState: ErpFormStateSnapshot;
  let mockSchemas: FormFieldSchema[];
  let hostDataObject: Record<string, unknown>;
  let hostRows: Array<Record<string, unknown>>;

  const lookupCatalog: Record<string, Array<{ id: number; label: string }>> = {
    PurchaseSetting: [{ id: 1, label: 'أمر شراء مباشر' }],
    Currancy: [
      { id: 1, label: 'جنيه مصري' },
      { id: 2, label: 'دولار أمريكي' }
    ],
    Supplier: [
      { id: 10, label: 'حسين للتوريدات' },
      { id: 11, label: 'حسين عبد الله' }
    ],
    Store: [
      { id: 5, label: 'المخزن الرئيسي' },
      { id: 6, label: 'مخزن الخامات' }
    ],
    Product: [
      { id: 101, label: 'حجر سن 1' },
      { id: 102, label: 'حجر سن 2' }
    ]
  };

  beforeEach(async () => {
    supportsV250Flag = true;
    activePageId = 289;
    activePageName = 'Purchases';
    mockMode = 'EmptyNew';
    mockState = { isOpen: true, mode: 'new', dirty: false };
    mockSchemas = [{ key: 'StoreID', label: 'المخزن', kind: 'ng-select', group: 'header' }];
    hostDataObject = {
      POSetting: 1,
      CurrancyID: 2,
      SupplierID: 10,
      StoreID: 5,
      ExchangePrice: 48.5,
      Total: 500
    };
    hostRows = [{ ProductID: 101, ProductName: 'حجر سن 1', Qty: 10, Price: 50, Total: 500 }];

    mockCopilotService = jasmine.createSpyObj('CopilotService', [
      'activeLessonId$',
      'checkReadiness',
      'getCopilotFilters',
      'setBaseUrls',
      'feedbackErpNavigation',
      'sendErpTelemetry',
      'streamSearch'
    ]);
    Object.defineProperty(mockCopilotService, 'activeLessonId$', { value: of(undefined) });
    mockCopilotService.checkReadiness.and.returnValue(of({ status: 'ok', ready: true }));
    mockCopilotService.getCopilotFilters.and.returnValue(of({ modules: [], levels: [], types: [] }));
    mockCopilotService.sendErpTelemetry.and.resolveTo({ status: 'ok' });
    mockCopilotService.streamSearch.and.resolveTo();

    mockBridge = jasmine.createSpyObj(
      'ErpBridgeService',
      [
        'supportsContractV250',
        'getActiveScreen',
        'listScreens',
        'getFormState',
        'getActiveFormContext',
        'fetchLookupRowsStrict',
        'clearTableRows',
        'selectLookup',
        'addTableRow',
        'getTableRows',
        'saveDocument',
        'submitActiveForm',
        'triggerAddNew'
      ],
      { isAvailable: true }
    );
    mockBridge.supportsContractV250.and.callFake(() => supportsV250Flag);
    mockBridge.getActiveScreen.and.callFake(() => ({ pageId: activePageId, pageName: activePageName }));
    mockBridge.listScreens.and.returnValue([
      { pageId: 289, pageName: 'Purchases', title: 'فاتورة المشتريات', screenKey: 'PURCHASE_INVOICE' }
    ]);
    mockBridge.getFormState.and.callFake(() => mockState);
    mockBridge.getActiveFormContext.and.callFake(() => ({
      isOpen: true,
      screenName: activePageName,
      dataObject: { ...hostDataObject },
      rows: [...hostRows]
    }));
    mockBridge.fetchLookupRowsStrict.and.callFake(
      async (spec: ErpLookupFieldSpec): Promise<StrictLookupFetchResult> => {
        const list = lookupCatalog[spec.droModel] || [];
        return {
          status: 'ok',
          options: list.map((o) => ({ id: o.id, label: o.label, raw: o })),
          totalCount: list.length,
          invalidRows: 0,
          attempts: 1
        };
      }
    );
    mockBridge.clearTableRows.and.resolveTo({ ok: true, count: 0 });
    mockBridge.selectLookup.and.resolveTo({ ok: true });
    mockBridge.addTableRow.and.resolveTo({ ok: true });
    mockBridge.getTableRows.and.callFake(async () => [...hostRows]);
    mockBridge.saveDocument.and.resolveTo({
      ok: true,
      POID: 14555,
      PONumber: 908,
      mode: 'new',
      errors: []
    });
    mockBridge.submitActiveForm.and.resolveTo({ success: true, outcome: 'saved', docId: 'legacy-1' });
    mockBridge.triggerAddNew.and.resolveTo(true);

    mockNavigator = jasmine.createSpyObj('ErpNavigatorService', [
      'isScreenActive',
      'navigateToScreen',
      'resolveAndNavigate',
      'prepareFreshForm',
      'getFormMode'
    ]);
    mockNavigator.isScreenActive.and.returnValue(true);
    mockNavigator.navigateToScreen.and.resolveTo(true);
    mockNavigator.resolveAndNavigate.and.resolveTo({
      success: true,
      decision: 'go',
      chosen: { id: '289', confidence: 0.95, reason: 'mock', label: 'فاتورة المشتريات' }
    });
    mockNavigator.prepareFreshForm.and.callFake(async () => {
      mockMode = 'EmptyNew';
      return true;
    });
    mockNavigator.getFormMode.and.callFake(() => mockMode);

    mockFormDriver = jasmine.createSpyObj('ErpFormDriverService', [
      'collectFormSchema',
      'buildVisibleFieldsSummary',
      'settle',
      'applyProgressiveFill'
    ]);
    mockFormDriver.collectFormSchema.and.callFake(() => mockSchemas);
    mockFormDriver.buildVisibleFieldsSummary.and.returnValue([]);
    mockFormDriver.settle.and.resolveTo();
    mockFormDriver.applyProgressiveFill.and.resolveTo({
      success: true,
      fieldsProcessed: 1,
      filledCount: 1,
      results: [{ field: 'SupplierID', value: 'حسين للتوريدات', status: 'filled' }]
    });

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
        { provide: ErpFormDriverService, useValue: mockFormDriver }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CopilotChatComponent);
    component = fixture.componentInstance;
    component.inline = true;
    fixture.detectChanges();
  });

  it('falls back cleanly to legacy applyProgressiveFill + submitActiveForm when contractVersion < 2.5.0', async () => {
    supportsV250Flag = false;
    const msg: ChatMessage = {
      sender: 'assistant',
      text: 'فاتورة مشتريات',
      formFillData: {
        screenKey: 'PURCHASE_INVOICE',
        pageId: 289,
        action_intent: 'new',
        fields: { SupplierID: 'حسين للتوريدات' },
        rows: []
      }
    };

    await component.applyFormFill(msg);

    expect(mockFormDriver.applyProgressiveFill).toHaveBeenCalledTimes(1);
    expect(mockBridge.selectLookup).not.toHaveBeenCalled();
    expect(msg.usedV250Pipeline).toBeFalsy();

    await component.confirmSave(msg, true);
    expect(mockBridge.submitActiveForm).toHaveBeenCalledTimes(1);
    expect(mockBridge.saveDocument).not.toHaveBeenCalled();
  });

  it('resolves duplicate schema labels (StoreID vs SystemStore) and ambiguous lookup chips locally without LLM re-call', async () => {
    mockSchemas = [
      { key: 'StoreID', label: 'المخزن', kind: 'ng-select', group: 'header' },
      { key: 'SystemStore', label: 'المخزن', kind: 'ng-select', group: 'header' }
    ];
    const msg: ChatMessage = {
      sender: 'assistant',
      text: 'فاتورة مشتريات',
      relatedUserQuery: 'سجل فاتورة مشتريات من حسين للمخزن الرئيسي 10 حجر سن 1',
      formFillData: {
        screenKey: 'PURCHASE_INVOICE',
        pageId: 289,
        action_intent: 'new',
        fields: {
          POSetting: 'أمر شراء مباشر',
          CurrancyID: 'دولار',
          SupplierID: 'حسين', // partial -> ambiguous (10 vs 11)
          StoreID: 'المخزن الرئيسي'
        },
        rows: [{ Product: 'حجر سن 1', Qty: 10, Price: 50 }]
      }
    };
    component.messages.push(msg);

    await component.applyFormFill(msg);

    expect(msg.formFillApplied).toBeFalse();
    expect(msg.v250ResolutionIssues?.length).toBe(2);
    expect(mockBridge.clearTableRows).not.toHaveBeenCalled();
    expect(mockBridge.selectLookup).not.toHaveBeenCalled();

    const schemaIssue = msg.v250ResolutionIssues!.find((i) => i.scope === 'schema')!;
    const supplierIssue = msg.v250ResolutionIssues!.find((i) => i.fieldKey === 'SupplierID')!;
    expect(schemaIssue.fieldCandidates?.map((c) => c.key)).toEqual(['StoreID', 'SystemStore']);

    const storeCandidate = schemaIssue.fieldCandidates!.find((c) => c.key === 'StoreID')!;
    const supplierCandidate = supplierIssue.candidates.find((c) => c.id === 10)!;
    expect(supplierIssue.candidates.map((c) => c.id).sort()).toEqual([10, 11]);

    // Selecting schema field only waits for SupplierID without clearing/calling LLM
    await component.selectV250SchemaFieldOption(msg, schemaIssue, storeCandidate);
    expect(msg.formFillApplied).toBeFalse();
    expect(mockCopilotService.streamSearch).not.toHaveBeenCalled();

    // Selecting SupplierID chip completes all blockers and executes v2.5.0 pipeline immediately
    await component.selectV250AmbiguityOption(msg, supplierIssue, supplierCandidate);
    expect(mockCopilotService.streamSearch).not.toHaveBeenCalled();
    expect(msg.formFillApplied).toBeTrue();
    expect(mockBridge.clearTableRows).toHaveBeenCalledTimes(1);
    expect(mockBridge.selectLookup).toHaveBeenCalledWith('SupplierID', 10);
    expect(mockBridge.selectLookup).toHaveBeenCalledWith('StoreID', 5);
  });

  it('resolves ambiguous row item chips locally without calling LLM', async () => {
    const msg: ChatMessage = {
      sender: 'assistant',
      text: 'فاتورة صنف غامض',
      formFillData: {
        screenKey: 'PURCHASE_INVOICE',
        pageId: 289,
        action_intent: 'new',
        fields: { POSetting: 'أمر شراء مباشر', StoreID: 'المخزن الرئيسي' },
        rows: [{ Product: 'حجر سن', Qty: 4, Price: 50 }] // partial -> ambiguous (101 vs 102)
      }
    };
    component.messages.push(msg);

    await component.applyFormFill(msg);
    expect(msg.formFillApplied).toBeFalse();
    const rowIssue = msg.v250ResolutionIssues!.find((i) => i.scope === 'row')!;
    expect(rowIssue.candidates.length).toBe(2);

    const chosenItem = rowIssue.candidates.find((c) => c.id === 102)!;
    await component.selectV250AmbiguityOption(msg, rowIssue, chosenItem);

    expect(mockCopilotService.streamSearch).not.toHaveBeenCalled();
    expect(msg.formFillApplied).toBeTrue();
    expect(mockBridge.addTableRow).toHaveBeenCalledWith({ ProductID: 102, Qty: 4, Price: 50 });
  });

  it('disables Save and offers "ابدأ من جديد" (clearTableRows + triggerAddNew) on mid-way failure', async () => {
    mockBridge.selectLookup.and.callFake(async (fieldKey: string) => {
      if (fieldKey === 'CurrancyID') {
        return { ok: false, reason: 'currency calc failed' };
      }
      return { ok: true };
    });

    const msg: ChatMessage = {
      sender: 'assistant',
      text: 'فاتورة مشتريات',
      formFillData: {
        screenKey: 'PURCHASE_INVOICE',
        pageId: 289,
        action_intent: 'new',
        fields: { POSetting: 'أمر شراء مباشر', CurrancyID: 'دولار' },
        rows: [{ Product: 'حجر سن 1', Qty: 10 }]
      }
    };
    component.messages.push(msg);

    await component.applyFormFill(msg);
    fixture.detectChanges();

    expect(msg.v250PartialFailure?.failedStep).toBe('CurrancyID');
    expect(msg.formFillApplied).toBeFalse();
    expect(component.isConfirmSaveDisabled(msg)).toBeTrue();

    // Even direct confirmSave invocation must refuse when v250PartialFailure is set
    await component.confirmSave(msg, true);
    expect(mockBridge.saveDocument).not.toHaveBeenCalled();

    const restartBtn = fixture.nativeElement.querySelector('.btn-v250-restart') as HTMLButtonElement | null;
    expect(restartBtn).not.toBeNull();
    restartBtn!.click();
    await fixture.whenStable();

    expect(mockBridge.clearTableRows).toHaveBeenCalled();
    expect(mockBridge.triggerAddNew).toHaveBeenCalled();
    expect(msg.v250PartialFailure).toBeUndefined();
  });

  it('requires warning acknowledgement before enabling Save when USD explicit rate differs from ERP computed rate, and never auto-saves', async () => {
    component.autoSaveAfterFill = true;
    const msg: ChatMessage = {
      sender: 'assistant',
      text: 'فاتورة دولار',
      formFillData: {
        screenKey: 'PURCHASE_INVOICE',
        pageId: 289,
        action_intent: 'new',
        fields: {
          POSetting: 'أمر شراء مباشر',
          CurrancyID: 'دولار',
          SupplierID: 'حسين للتوريدات',
          StoreID: 'المخزن الرئيسي',
          ExchangePrice: 50.0 // differs from hostDataObject.ExchangePrice (48.5)
        },
        rows: [{ Product: 'حجر سن 1', Qty: 10, Price: 50 }]
      }
    };
    component.messages.push(msg);

    await component.applyFormFill(msg);
    fixture.detectChanges();

    // Never auto-saves even though autoSaveAfterFill is true
    expect(mockBridge.saveDocument).not.toHaveBeenCalled();
    expect(msg.formFillApplied).toBeTrue();
    expect(msg.v250Preview?.warnings.length).toBeGreaterThan(0);
    expect(msg.v250WarningsAcknowledged).toBeFalse();
    expect(component.isConfirmSaveDisabled(msg)).toBeTrue();

    // Clicking confirmSave before acknowledgement refuses to save
    await component.confirmSave(msg, true);
    expect(mockBridge.saveDocument).not.toHaveBeenCalled();

    // Acknowledge warnings -> Save unlocks and calls saveDocument() WITHOUT options in new mode
    component.onV250WarningsChanged(msg, true);
    expect(component.isConfirmSaveDisabled(msg)).toBeFalse();

    await component.confirmSave(msg, true);
    fixture.detectChanges();

    expect(mockBridge.saveDocument).toHaveBeenCalledWith();
    expect(msg.saveStatus).toBe('saved');
    expect(msg.saveMessage).toContain('908');
    expect(msg.v250SavedDoc).toEqual({ POID: 14555, PONumber: 908, mode: 'new' });
    const detailsEl = fixture.nativeElement.querySelector('.v250-saved-details') as HTMLElement | null;
    expect(detailsEl?.textContent).toContain('908');
    expect(detailsEl?.textContent).toContain('14555');
  });

  it('passes expectedPOID and expectedPONumber to saveDocument ONLY when editing a SavedOpen document', async () => {
    mockMode = 'SavedOpen';
    mockState = { isOpen: true, mode: 'saved', dirty: true, docId: 14001, docNumber: 550 };
    hostDataObject = {
      POID: 14001,
      PONumber: 550,
      POSetting: 1,
      CurrancyID: 2,
      SupplierID: 10,
      StoreID: 6
    };

    const msg: ChatMessage = {
      sender: 'assistant',
      text: 'تعديل المخزن',
      relatedUserQuery: 'عدل المخزن الى مخزن الخامات',
      formFillData: {
        screenKey: 'PURCHASE_INVOICE',
        pageId: 289,
        action_intent: 'edit_current',
        fields: { StoreID: 'مخزن الخامات' },
        rows: []
      }
    };
    component.messages.push(msg);

    await component.applyFormFill(msg);
    expect(msg.formFillApplied).toBeTrue();
    expect(mockBridge.clearTableRows).not.toHaveBeenCalled();

    await component.confirmSave(msg, true);
    expect(mockBridge.saveDocument).toHaveBeenCalledWith({
      expectedPOID: 14001,
      expectedPONumber: 550
    });
  });

  it('retains conversational pendingV250Resolution on not_found, maps short reply cleanly without LLM/nav switch, and requires confirm to cancel on long/new command', async () => {
    component.isActionMode = true;
    const msg: ChatMessage = {
      sender: 'assistant',
      text: 'فاتورة مشتريات',
      relatedUserQuery: 'سجل فاتورة مشتريات من حسين للتوريدات مخزن خامات تام',
      formFillData: {
        screenKey: 'PURCHASE_INVOICE',
        pageId: 289,
        action_intent: 'new',
        fields: {
          POSetting: 'أمر شراء مباشر',
          CurrancyID: 'دولار',
          SupplierID: 'حسين للتوريدات',
          المخزن: 'خامات تام' // not_found in Store (size 2 <= 10)
        },
        rows: [{ Product: 'حجر سن 1', Qty: 10, Price: 50 }]
      }
    };
    component.messages.push(msg);

    await component.applyFormFill(msg);
    fixture.detectChanges();

    // Item 2: not_found on small Store catalog exposes selectable candidates in UI
    expect(msg.formFillApplied).toBeFalse();
    expect(component.pendingV250Resolution?.targetMessage).toBe(msg);
    const storeIssue = msg.v250ResolutionIssues!.find((i) => i.fieldKey === 'StoreID')!;
    expect(storeIssue.status).toBe('not_found');
    expect(storeIssue.candidates.map((c) => c.id)).toEqual([5, 6]);
    const chipButtons = fixture.nativeElement.querySelectorAll('.v250-resolution-card .v250-option-chip');
    expect(chipButtons.length).toBe(2);

    // Item 3: clicking askOption / attempting screen switch while pending task active is blocked
    await component.selectAskOption({ id: '12', confidence: 0.9, reason: 'test' }, 'سؤال');
    expect(mockNavigator.navigateToScreen).not.toHaveBeenCalled();

    // Item 1 (long/new command): asks confirmation before cancelling and keeps pendingV250Resolution alive
    component.inputQuery = 'سجل فاتورة مشتريات جديدة بالكامل لصنف رمل بكمية 20 من شركة النور للتوريدات';
    await component.sendMessage();
    expect(component.pendingV250Resolution).not.toBeNull();
    expect(mockCopilotService.streamSearch).not.toHaveBeenCalled();
    expect(mockNavigator.resolveAndNavigate).not.toHaveBeenCalled();
    const cancelPrompt = component.messages[component.messages.length - 1];
    expect(cancelPrompt.pendingV250CancelConfirm).toBeDefined();

    // Reject cancellation -> keeps pending invoice intact
    component.rejectPendingV250Cancellation(cancelPrompt);
    expect(component.pendingV250Resolution?.pendingCancelQuery).toBeUndefined();

    // Item 1 (short reply): patches StoreID in-place, preserves SupplierID/POSetting/CurrancyID/rows, zero LLM/nav calls
    component.inputQuery = 'مخزن الخامات';
    await component.sendMessage();

    expect(mockCopilotService.streamSearch).not.toHaveBeenCalled();
    expect(mockNavigator.resolveAndNavigate).not.toHaveBeenCalled();
    expect(component.pendingV250Resolution).toBeNull();
    expect(msg.formFillApplied).toBeTrue();
    expect(msg.formFillData!.fields!['SupplierID']).toBe('حسين للتوريدات');
    expect(msg.formFillData!.rows!.length).toBe(1);
    expect(mockBridge.selectLookup).toHaveBeenCalledWith('SupplierID', 10);
    expect(mockBridge.selectLookup).toHaveBeenCalledWith('StoreID', 6);

    // Long/new command when confirmed finally cancels and triggers streamSearch
    msg.v250ResolutionIssues = [storeIssue];
    msg.formFillApplied = false;
    component.pendingV250Resolution = { targetMessage: msg, issues: [storeIssue] };
    component.inputQuery = 'افتح شاشة قيود اليومية العامة وسجل قيد يومي جديد بمبلغ ألف جنيه';
    await component.sendMessage();
    const confirmMsg = component.messages[component.messages.length - 1];
    await component.confirmPendingV250Cancellation(confirmMsg);
    expect(component.pendingV250Resolution).toBeNull();
    expect(mockCopilotService.streamSearch).toHaveBeenCalledTimes(1);
  });

  it('resolves Arabic screen labels via bridge.listScreens for askOptions without falling back to numeric pageId', () => {
    const labelMsg: ChatMessage = {
      sender: 'assistant',
      text: 'اختر الشاشة',
      askOptions: [{ id: '289', confidence: 0.72, reason: 'match' }]
    };
    component.messages.push(labelMsg);
    fixture.detectChanges();

    expect(component.getScreenDisplayName('289')).toBe('فاتورة المشتريات');
    const chipLabel = fixture.nativeElement.querySelector('.nav-ask-chip-btn .chip-label') as HTMLElement | null;
    expect(chipLabel?.textContent?.trim()).toBe('فاتورة المشتريات');
  });

  it('caches shouldUsePurchasesV250 result so Angular change detection never re-invokes bridge.supportsContractV250() / getCapabilities()', () => {
    const cachedMsg: ChatMessage = {
      sender: 'assistant',
      text: 'معاينة قبل التعبئة',
      isPurchasesV250Target: true,
      formFillData: {
        screenKey: 'PURCHASE_INVOICE',
        pageId: 289,
        action_intent: 'new',
        fields: { StoreID: 'المخزن الرئيسي' },
        rows: []
      }
    };
    component.messages.push(cachedMsg);
    const shouldUseSpy = spyOn(component, 'shouldUsePurchasesV250').and.callThrough();
    mockBridge.supportsContractV250.calls.reset();

    fixture.detectChanges();
    fixture.detectChanges();
    fixture.detectChanges();

    expect(shouldUseSpy).not.toHaveBeenCalled();
    expect(mockBridge.supportsContractV250).not.toHaveBeenCalled();
  });

  it('renders ignored fields section in preview and blocks Save until v250IgnoredAcknowledged is checked', async () => {
    hostDataObject = {
      POSetting: 1,
      CurrancyID: 1,
      SupplierID: 10,
      StoreID: 5,
      Total: 500
    };
    const msg: ChatMessage = {
      sender: 'assistant',
      text: 'فاتورة مع حقول متجاهلة',
      relatedUserQuery: 'سجل فاتورة مشتريات من حسين للمخزن الرئيسي لمشروع السحاب وسدد الإجمالي بالكامل نقداً',
      formFillData: {
        screenKey: 'PURCHASE_INVOICE',
        pageId: 289,
        action_intent: 'new',
        fields: {
          POSetting: 'أمر شراء مباشر',
          CurrancyID: 'مصري',
          SupplierID: 'حسين للتوريدات',
          StoreID: 'المخزن الرئيسي',
          المشروعات: 'السحاب'
        },
        rows: [{ Product: 'حجر سن 1', Qty: 10, Price: 50 }]
      }
    };
    component.messages.push(msg);

    await component.applyFormFill(msg);
    fixture.detectChanges();

    expect(msg.formFillApplied).toBeTrue();
    expect(msg.v250Preview?.warnings).toEqual([]);
    expect(msg.v250Preview?.ignoredItems?.length).toBe(2);
    expect(msg.v250IgnoredAcknowledged).toBeFalse();
    expect(component.isConfirmSaveDisabled(msg)).toBeTrue();

    const ignoredSection = fixture.nativeElement.querySelector('.v250-preview-ignored') as HTMLElement | null;
    expect(ignoredSection).not.toBeNull();
    expect(ignoredSection?.textContent).toContain('المشروع');
    expect(ignoredSection?.textContent).toContain('السحاب');
    expect(ignoredSection?.textContent).toContain('نقد');

    // Programmatic confirmSave refuses before acknowledgement
    await component.confirmSave(msg, true);
    expect(mockBridge.saveDocument).not.toHaveBeenCalled();

    // After ticking acknowledgement checkbox -> Save unlocks and calls saveDocument
    component.onV250IgnoredChanged(msg, true);
    fixture.detectChanges();
    expect(component.isConfirmSaveDisabled(msg)).toBeFalse();

    await component.confirmSave(msg, true);
    expect(mockBridge.saveDocument).toHaveBeenCalledTimes(1);
  });

  it('re-evaluates immediately after picking a Store chip when remaining blockers have no chips (> 10 products)', async () => {
    const bigProductList = Array.from({ length: 12 }, (_, idx) => ({
      id: 200 + idx,
      label: `صنف خاص ${idx + 1}`,
      raw: {}
    }));
    mockBridge.fetchLookupRowsStrict.and.callFake(async (spec: ErpLookupFieldSpec): Promise<StrictLookupFetchResult> => {
      if (spec.droModel === 'Product') {
        return {
          status: 'ok',
          totalCount: bigProductList.length,
          options: bigProductList,
          invalidRows: 0,
          attempts: 1
        };
      }
      const list = (lookupCatalog[spec.droModel] || []).map((o) => ({ ...o, raw: {} }));
      return {
        status: 'ok',
        totalCount: list.length,
        options: list,
        invalidRows: 0,
        attempts: 1
      };
    });

    const msg: ChatMessage = {
      sender: 'assistant',
      text: 'فاتورة مختلطة',
      relatedUserQuery: 'سجل فاتورة مشتريات',
      formFillData: {
        screenKey: 'PURCHASE_INVOICE',
        pageId: 289,
        action_intent: 'new',
        fields: {
          POSetting: 'أمر شراء مباشر',
          CurrancyID: 'جنيه مصري',
          SupplierID: 'حسين للتوريدات',
          StoreID: 'مخزن عبيط'
        },
        rows: [{ 'اسم المنتج': 'منتج مجهول', Qty: 5 }]
      }
    };
    component.messages.push(msg);

    await component.applyFormFill(msg);
    expect(msg.v250ResolutionIssues?.length).toBe(2);
    const storeIssue = msg.v250ResolutionIssues!.find((i) => i.fieldKey === 'StoreID')!;
    expect(storeIssue.candidates.length).toBe(2);

    // Click Store chip even though row item still lacks chips -> immediately shrinks blockers to row item only
    await component.selectV250AmbiguityOption(msg, storeIssue, { id: 6, label: 'مخزن الخامات', raw: {} });

    expect(msg.formFillData?.fields?.['StoreID']).toBe('مخزن الخامات');
    expect(msg.v250ResolutionIssues?.length).toBe(1);
    expect(msg.v250ResolutionIssues?.[0].scope).toBe('row');
    expect(component.pendingV250Resolution?.issues.length).toBe(1);
    expect(component.messages.some((m) => m.sender === 'assistant' && m.text.includes('تم تحديد «المخزن»'))).toBeTrue();
  });

  it('retryMessage delegates ERP_EXTRACTION_FAILED retries through streamQuery with skipCache=true', async () => {
    const streamSpy = spyOn<any>(component, 'streamQuery').and.resolveTo();
    component.isActionMode = true;
    component.messages.push({
      sender: 'assistant',
      text: '⚠️ تعذر استخراج بيانات النموذج حالياً...',
      provenance: 'ERP_EXTRACTION_FAILED',
      relatedUserQuery: 'سجل فاتورة مشتريات جديدة من حسين'
    });

    await component.retryMessage(component.messages.length - 1);

    expect(streamSpy).toHaveBeenCalledWith('سجل فاتورة مشتريات جديدة من حسين', true);
    expect(mockCopilotService.streamSearch).not.toHaveBeenCalled();
  });

  it('never calls runVisionAgent when bridge is available and nav resolves clarify on ambiguous navigate', async () => {
    activePageId = 0;
    activePageName = 'Dashboard';
    mockNavigator.isScreenActive.and.returnValue(false);
    component.isActionMode = true;
    const visionSpy = spyOn<any>(component, 'runVisionAgent').and.resolveTo();
    mockNavigator.resolveAndNavigate.and.resolveTo({
      success: false,
      decision: 'clarify',
      askOptions: [
        { id: '244', label: 'فواتير المبيعات', confidence: 0.78, reason: 'ترشيح محلي' },
        { id: '289', label: 'فواتير المشتريات', confidence: 0.76, reason: 'ترشيح محلي' }
      ],
      rawResolution: { decision: 'clarify', intent: 'navigate', source: 'ai', candidates: [] }
    } as any);

    await (component as any).streamQuery('عايز افتح شاشة الفواتير');

    expect(visionSpy).not.toHaveBeenCalled();
    expect(mockCopilotService.streamSearch).not.toHaveBeenCalled();
    const lastMsg = component.messages[component.messages.length - 1];
    expect(lastMsg.askOptions?.length).toBe(2);
  });

  it('displays explicit Arabic message instead of silence or Vision when bridge listScreens returns empty', async () => {
    activePageId = 0;
    activePageName = 'Dashboard';
    mockNavigator.isScreenActive.and.returnValue(false);
    mockBridge.listScreens.and.returnValue([]);
    component.isActionMode = true;
    const visionSpy = spyOn<any>(component, 'runVisionAgent').and.resolveTo();
    mockNavigator.resolveAndNavigate.and.resolveTo({
      success: false,
      decision: 'clarify',
      message: 'لم يتم العثور على أي شاشات متاحة في واجهة النظام حالياً.'
    } as any);

    await (component as any).streamQuery('عايز افتح شاشة الفواتير');

    expect(visionSpy).not.toHaveBeenCalled();
    expect(mockCopilotService.streamSearch).not.toHaveBeenCalled();
    const lastMsg = component.messages[component.messages.length - 1];
    expect(lastMsg.text).toContain('لم يتم العثور على أي شاشات متاحة');
  });

  it('anti-regression: clear navigate go (افتح فواتير المبيعات) navigates directly without extra questions', async () => {
    activePageId = 0;
    activePageName = 'Dashboard';
    mockNavigator.isScreenActive.and.returnValue(false);
    component.isActionMode = true;
    const visionSpy = spyOn<any>(component, 'runVisionAgent').and.resolveTo();
    mockNavigator.resolveAndNavigate.and.resolveTo({
      success: true,
      decision: 'go',
      chosen: { id: '244', label: 'فواتير المبيعات', confidence: 0.96, reason: 'فواتير المبيعات' },
      rawResolution: {
        decision: 'go',
        intent: 'navigate',
        source: 'ai',
        candidates: [{ id: '244', confidence: 0.96, reason: 'فواتير المبيعات' }]
      }
    } as any);

    await (component as any).streamQuery('افتح فواتير المبيعات');

    expect(visionSpy).not.toHaveBeenCalled();
    const lastMsg = component.messages[component.messages.length - 1];
    expect(lastMsg.askOptions).toBeUndefined();
    expect(lastMsg.text).toContain('تم الانتقال إلى شاشة');
    expect(lastMsg.text).toContain('فواتير المبيعات');
  });

  it('Module 2: evaluateActiveScreenMatch detects active Purchases screen by pageId=289 even when pageName/screenKey are empty after save', () => {
    const match = evaluateActiveScreenMatch(
      'سجل فاتورة مشتريات جديدة',
      { pageId: 289, screenKey: '', pageName: '' },
      true
    );
    expect(match.isExplicitNavRequest).toBeFalse();
    expect(match.isAlreadyOnMatchingDomain).toBeTrue();
    expect(match.isAlreadyOnMatchingScreen).toBeTrue();
  });

  it('Module 4: isPureNavigationQuery distinguishes pure navigation from compound action queries, and selectAskOption short-circuits on pure navigation', async () => {
    expect(isPureNavigationQuery('هاتلي صفحة الفواتير')).toBeTrue();
    expect(isPureNavigationQuery('افتح شاشة المشتريات')).toBeTrue();
    expect(isPureNavigationQuery('افتح شاشة المشتريات وسجل فاتورة للمورد حسين')).toBeFalse();
    expect(isPureNavigationQuery('هاتلي صفحة الفواتير وسجل فاتورة')).toBeFalse();

    await component.selectAskOption(
      { id: '289', label: 'فواتير المشتريات', confidence: 0.78, reason: 'ask' },
      'هاتلي صفحة الفواتير'
    );

    expect(mockNavigator.navigateToScreen).toHaveBeenCalledWith('289');
    expect(mockCopilotService.streamSearch).not.toHaveBeenCalled();
    const lastMsg = component.messages[component.messages.length - 1];
    expect(lastMsg.text).toContain('✅ تم الانتقال إلى شاشة «فواتير المشتريات» بنجاح.');

    // Compound query (navigate + action) MUST continue to streamQuery / streamSearch
    await component.selectAskOption(
      { id: '289', label: 'فواتير المشتريات', confidence: 0.78, reason: 'ask' },
      'افتح شاشة المشتريات وسجل فاتورة للمورد حسين'
    );
    expect(mockCopilotService.streamSearch).toHaveBeenCalledTimes(1);
  });

  it('Module 3-c: when resolveAndNavigate returns early (formPrepared undefined, e.g. downgrade prevented), streamQuery prepares form once', async () => {
    activePageId = 999;
    activePageName = 'OtherScreen';
    mockNavigator.isScreenActive.and.returnValue(false);
    component.isActionMode = true;
    mockNavigator.resolveAndNavigate.and.resolveTo({
      success: true,
      decision: 'go',
      chosen: { id: 'Purchases', confidence: 1.0, reason: 'Retained primary transactional screen' },
      rawResolution: {
        decision: 'go',
        intent: 'action',
        source: 'ai',
        candidates: [{ id: 'PurchasesDetail', confidence: 0.9, reason: 'detail' }]
      }
      // formPrepared is undefined on early return (lines 315 & 342)
    } as any);

    await (component as any).streamQuery('سجل فاتورة مشتريات جديدة للمورد حسين');

    expect(mockNavigator.prepareFreshForm).toHaveBeenCalledTimes(1);
  });
});


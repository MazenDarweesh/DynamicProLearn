import { TestBed } from '@angular/core/testing';
import {
  ErpBridgeService,
  ErpLookupFieldSpec,
  ErpNavigatorService,
  ErpTelemetryService,
  PurchasesEntityResolverService,
  PurchasesV250ExecutorService,
  StrictLookupFetchResult,
  isPurchasesTargetScreen
} from '../index';
import { ErpFormMode } from '../../../models/erp-bridge.models';

describe('PurchasesV250ExecutorService (Step 3 Execution, Guards & Actual Preview)', () => {
  let service: PurchasesV250ExecutorService;
  let mockBridge: jasmine.SpyObj<ErpBridgeService>;
  let mockNavigator: jasmine.SpyObj<ErpNavigatorService>;
  let mockTelemetry: jasmine.SpyObj<ErpTelemetryService>;
  let currentMode: ErpFormMode;
  let callLog: string[];

  const lookupMap: Record<string, Array<{ id: number; label: string }>> = {
    PurchaseSetting: [
      { id: 1, label: 'أمر شراء مباشر' },
      { id: 2, label: 'استيراد خارجي' }
    ],
    Currancy: [
      { id: 1, label: 'جنيه مصري' },
      { id: 2, label: 'دولار أمريكي' }
    ],
    Supplier: [
      { id: 15, label: 'مؤسسة النصر' },
      { id: 16, label: 'الشركة العربية' }
    ],
    Store: [
      { id: 5, label: 'المخزن الرئيسي' },
      { id: 6, label: 'مخزن الخامات' }
    ],
    Product: [
      { id: 101, label: 'حجر سن 1' },
      { id: 202, label: 'حديد تسليح 16مم' }
    ]
  };

  beforeEach(() => {
    currentMode = 'EmptyNew';
    callLog = [];

    mockBridge = jasmine.createSpyObj<ErpBridgeService>(
      'ErpBridgeService',
      [
        'supportsContractV250',
        'fetchLookupRowsStrict',
        'clearTableRows',
        'selectLookup',
        'addTableRow',
        'getTableRows',
        'getActiveFormContext',
        'getFormState',
        'triggerAddNew',
        'fillFormData',
        'saveDocument',
        'submitActiveForm'
      ],
      { isAvailable: true }
    );

    mockBridge.supportsContractV250.and.returnValue(true);
    mockBridge.fetchLookupRowsStrict.and.callFake(
      async (spec: ErpLookupFieldSpec): Promise<StrictLookupFetchResult> => {
        callLog.push(`fetchLookup:${spec.droModel}`);
        const rows = lookupMap[spec.droModel] || [];
        return {
          status: 'ok',
          options: rows.map((r) => ({ id: r.id, label: r.label, raw: r })),
          totalCount: rows.length,
          invalidRows: 0,
          attempts: 1
        };
      }
    );
    mockBridge.clearTableRows.and.callFake(async () => {
      callLog.push('clearTableRows');
      return { ok: true, count: 0 };
    });
    mockBridge.selectLookup.and.callFake(async (fieldKey: string, id: string | number) => {
      callLog.push(`selectLookup:${fieldKey}:${id}`);
      return { ok: true };
    });
    mockBridge.addTableRow.and.callFake(async (row) => {
      callLog.push(`addTableRow:${row.ProductID}:${row.Qty}`);
      return { ok: true };
    });
    mockBridge.getActiveFormContext.and.callFake(() => {
      callLog.push('getActiveFormContext');
      return {
        isOpen: true,
        screenName: 'Purchases',
        dataObject: {
          POSetting: 1,
          CurrancyID: 2,
          SupplierID: 15,
          StoreID: 5,
          ExchangePrice: 48.5,
          Total: 4000
        },
        rows: [
          { ProductID: 101, ProductName: 'حجر سن 1', Qty: 10, Price: 100, Total: 1000 },
          { ProductID: 202, ProductName: 'حديد تسليح 16مم', Qty: 5, Price: 600, Total: 3000 }
        ]
      };
    });
    mockBridge.getTableRows.and.callFake(async () => {
      callLog.push('getTableRows');
      return [
        { ProductID: 101, ProductName: 'حجر سن 1', Qty: 10, Price: 100, Total: 1000 },
        { ProductID: 202, ProductName: 'حديد تسليح 16مم', Qty: 5, Price: 600, Total: 3000 }
      ];
    });
    mockBridge.getFormState.and.returnValue({ isOpen: true, mode: 'new', dirty: false });
    mockBridge.triggerAddNew.and.resolveTo(true);

    mockNavigator = jasmine.createSpyObj<ErpNavigatorService>('ErpNavigatorService', ['getFormMode', 'prepareFreshForm']);
    mockNavigator.getFormMode.and.callFake(() => currentMode);

    mockTelemetry = jasmine.createSpyObj<ErpTelemetryService>('ErpTelemetryService', ['log', 'logError', 'logBridge']);

    TestBed.configureTestingModule({
      providers: [
        PurchasesV250ExecutorService,
        PurchasesEntityResolverService,
        { provide: ErpBridgeService, useValue: mockBridge },
        { provide: ErpNavigatorService, useValue: mockNavigator },
        { provide: ErpTelemetryService, useValue: mockTelemetry }
      ]
    });

    service = TestBed.inject(PurchasesV250ExecutorService);
  });

  it('detects Purchases Page 289 targets and excludes Sales/other screens', () => {
    expect(isPurchasesTargetScreen('PURCHASE_INVOICE', undefined, { pageId: 289, pageName: 'Purchases' })).toBeTrue();
    expect(isPurchasesTargetScreen(undefined, 289, null)).toBeTrue();
    expect(isPurchasesTargetScreen('فواتير الشراء', undefined, null)).toBeTrue();
    expect(isPurchasesTargetScreen('SALES_INVOICE', 101, { pageId: 289, pageName: 'Purchases' })).toBeFalse();
    expect(isPurchasesTargetScreen('SALES_INVOICE', undefined, { pageId: 101, pageName: 'Sales' })).toBeFalse();
  });

  it('enforces exact execution order: Resolver -> prepareFreshForm -> clearTableRows -> POSetting -> CurrancyID -> SupplierID -> StoreID -> addTableRow -> Actual Preview, without injecting ExchangePrice', async () => {
    currentMode = 'SavedOpen';

    const result = await service.execute({
      fields: {
        POSetting: 'أمر شراء مباشر',
        CurrancyID: 'دولار',
        SupplierID: 'مؤسسة النصر',
        StoreID: 'المخزن الرئيسي'
      },
      rows: [
        { Product: 'حجر سن 1', Qty: 10, Price: 100 },
        { Product: 'حديد تسليح 16مم', Qty: 5, Price: 600 }
      ],
      isEditCurrent: false,
      prepareFormFn: async () => {
        callLog.push('prepareFormFn');
        currentMode = 'EmptyNew';
        return { status: 'ready' };
      }
    });

    expect(result.status).toBe('ready_for_preview');
    expect(result.mutated).toBeTrue();
    expect(result.preview?.warnings).toEqual([]);
    expect(result.preview?.actualTotal).toBe(4000);
    expect(mockBridge.fillFormData).not.toHaveBeenCalled();

    const prepIdx = callLog.indexOf('prepareFormFn');
    const clearIdx = callLog.indexOf('clearTableRows');
    const poIdx = callLog.indexOf('selectLookup:POSetting:1');
    const currIdx = callLog.indexOf('selectLookup:CurrancyID:2');
    const supIdx = callLog.indexOf('selectLookup:SupplierID:15');
    const storeIdx = callLog.indexOf('selectLookup:StoreID:5');
    const row1Idx = callLog.indexOf('addTableRow:101:10');
    const row2Idx = callLog.indexOf('addTableRow:202:5');
    const previewRowsIdx = callLog.indexOf('getTableRows');

    expect(prepIdx).toBeGreaterThan(-1);
    expect(callLog.indexOf('fetchLookup:PurchaseSetting')).toBeLessThan(prepIdx);
    expect(clearIdx).toBeGreaterThan(prepIdx);
    expect(clearIdx).toBeLessThan(poIdx);
    expect(poIdx).toBeLessThan(currIdx);
    expect(currIdx).toBeLessThan(supIdx);
    expect(supIdx).toBeLessThan(storeIdx);
    expect(storeIdx).toBeLessThan(row1Idx);
    expect(row1Idx).toBeLessThan(row2Idx);
    expect(row2Idx).toBeLessThan(previewRowsIdx);
  });

  it('halts immediately on clearTableRows failure before touching any header or row', async () => {
    mockBridge.clearTableRows.and.resolveTo({ ok: false, count: 0, reason: 'grid locked' });

    const res = await service.execute({
      fields: { POSetting: 'أمر شراء مباشر', CurrancyID: 'دولار' },
      rows: [{ Product: 'حجر سن 1', Qty: 10 }],
      isEditCurrent: false,
      prepareFormFn: async () => ({ status: 'ready' })
    });

    expect(res.status).toBe('partial_failure');
    expect(res.mutated).toBeTrue();
    expect(res.failure?.failedStep).toBe('clearTableRows');
    expect(mockBridge.selectLookup).not.toHaveBeenCalled();
    expect(mockBridge.addTableRow).not.toHaveBeenCalled();
  });

  for (const failedHeader of ['POSetting', 'CurrancyID', 'SupplierID', 'StoreID'] as const) {
    it(`halts immediately when selectLookup('${failedHeader}') returns ok: false`, async () => {
      mockBridge.selectLookup.and.callFake(async (fieldKey: string, id: string | number) => {
        callLog.push(`selectLookup:${fieldKey}:${id}`);
        if (fieldKey === failedHeader) {
          return { ok: false, reason: `${failedHeader} rejected` };
        }
        return { ok: true };
      });

      const res = await service.execute({
        fields: {
          POSetting: 'أمر شراء مباشر',
          CurrancyID: 'دولار',
          SupplierID: 'مؤسسة النصر',
          StoreID: 'المخزن الرئيسي'
        },
        rows: [{ Product: 'حجر سن 1', Qty: 10 }],
        isEditCurrent: false,
        prepareFormFn: async () => ({ status: 'ready' })
      });

      expect(res.status).toBe('partial_failure');
      expect(res.mutated).toBeTrue();
      expect(res.failure?.failedStep).toBe(failedHeader);
      expect(res.failure?.reason).toBe(`${failedHeader} rejected`);
      expect(mockBridge.addTableRow).not.toHaveBeenCalled();

      const headerOrder = ['POSetting', 'CurrancyID', 'SupplierID', 'StoreID'];
      const failIdx = headerOrder.indexOf(failedHeader);
      for (const laterHeader of headerOrder.slice(failIdx + 1)) {
        expect(callLog.some((c) => c.startsWith(`selectLookup:${laterHeader}`))).toBeFalse();
      }
    });
  }

  it('halts immediately on failing addTableRow row without inserting subsequent rows', async () => {
    mockBridge.addTableRow.and.callFake(async (row) => {
      if (Number(row.ProductID) === 202) {
        return { ok: false, reason: 'negative stock check' };
      }
      return { ok: true };
    });

    const res = await service.execute({
      fields: { POSetting: 'أمر شراء مباشر', StoreID: 'المخزن الرئيسي' },
      rows: [
        { Product: 'حجر سن 1', Qty: 10 },
        { Product: 'حديد تسليح 16مم', Qty: 5 }
      ],
      isEditCurrent: false,
      prepareFormFn: async () => ({ status: 'ready' })
    });

    expect(res.status).toBe('partial_failure');
    expect(res.mutated).toBeTrue();
    expect(res.failure?.failedStep).toBe('addTableRow#2');
    expect(mockBridge.addTableRow).toHaveBeenCalledTimes(2);
    expect(res.failure?.completedSteps).toContain('addTableRow#1');
  });

  it('blocks clearTableRows in creation mode if host mode remains SavedOpen or UnsavedDraft', async () => {
    for (const stickyMode of ['SavedOpen', 'UnsavedDraft'] as ErpFormMode[]) {
      currentMode = stickyMode;
      mockBridge.clearTableRows.calls.reset();

      const res = await service.execute({
        fields: { SupplierID: 'مؤسسة النصر' },
        rows: [{ Product: 'حجر سن 1', Qty: 5 }],
        isEditCurrent: false,
        draftResetDecision: stickyMode === 'UnsavedDraft' ? 'reset_and_new' : undefined,
        prepareFormFn: async () => ({ status: 'ready' }) // host falsely reports ready without transitioning to EmptyNew
      });

      expect(res.status).toBe('prep_failed');
      expect(res.mutated).toBeFalse();
      expect(mockBridge.clearTableRows).not.toHaveBeenCalled();
    }
  });

  it('enforces UnsavedDraft confirm before resolving lookups, and preserves SavedOpen when ambiguity occurs', async () => {
    currentMode = 'UnsavedDraft';
    const draftRes = await service.execute({
      fields: { SupplierID: 'مؤسسة' },
      isEditCurrent: false,
      draftResetDecision: 'pending',
      prepareFormFn: async () => ({ status: 'ready' })
    });
    expect(draftRes.status).toBe('needs_draft_confirm');
    expect(mockBridge.fetchLookupRowsStrict).not.toHaveBeenCalled();

    currentMode = 'SavedOpen';
    const prepSpy = jasmine.createSpy('prepareFormFn').and.resolveTo({ status: 'ready' });
    const ambRes = await service.execute({
      fields: { SupplierID: 'مؤسسة' }, // partial -> ambiguous!
      isEditCurrent: false,
      prepareFormFn: prepSpy
    });
    expect(ambRes.status).toBe('needs_resolution');
    expect(ambRes.mutated).toBeFalse();
    expect(prepSpy).not.toHaveBeenCalled();
    expect(mockBridge.clearTableRows).not.toHaveBeenCalled();
  });

  it('mounts ClosedOrList form before running Resolver, and skips clearTableRows on header-only SavedOpen edit_current', async () => {
    currentMode = 'ClosedOrList';
    const closedRes = await service.execute({
      fields: { SupplierID: 'مؤسسة النصر' },
      isEditCurrent: false,
      prepareFormFn: async () => {
        callLog.push('mountFromClosed');
        currentMode = 'EmptyNew';
        return { status: 'ready' };
      }
    });
    expect(closedRes.status).toBe('ready_for_preview');
    expect(callLog.indexOf('mountFromClosed')).toBeLessThan(callLog.indexOf('fetchLookup:Supplier'));

    // Header-only edit_current on SavedOpen: skips clearTableRows & captures expectedPOID/expectedPONumber
    callLog = [];
    currentMode = 'SavedOpen';
    mockBridge.clearTableRows.calls.reset();
    mockBridge.getFormState.and.returnValue({
      isOpen: true,
      mode: 'saved',
      dirty: true,
      docId: 14001,
      docNumber: 777
    });
    mockBridge.getActiveFormContext.and.returnValue({
      isOpen: true,
      dataObject: { POID: 14001, PONumber: 777, StoreID: 6 },
      rows: [{ ProductID: 101, Qty: 10 }]
    });
    mockBridge.getTableRows.and.resolveTo([{ ProductID: 101, Qty: 10 }]);

    const editPrepSpy = jasmine.createSpy('prepareFormFn');
    const editRes = await service.execute({
      fields: { StoreID: 'مخزن الخامات' },
      rows: [],
      isEditCurrent: true,
      prepareFormFn: editPrepSpy
    });

    expect(editPrepSpy).not.toHaveBeenCalled();
    expect(mockBridge.clearTableRows).not.toHaveBeenCalled();
    expect(editRes.status).toBe('ready_for_preview');
    expect(editRes.preview?.isSavedOpenEdit).toBeTrue();
    expect(editRes.preview?.expectedPOID).toBe(14001);
    expect(editRes.preview?.expectedPONumber).toBe(777);
  });

  it('builds preview strictly from actual host state and warns on USD explicit exchange-rate mismatch or total discrepancy without overriding host rate', async () => {
    mockBridge.getActiveFormContext.and.returnValue({
      isOpen: true,
      dataObject: {
        CurrancyID: 2,
        SupplierID: 15,
        ExchangePrice: 48.2,
        Total: 999 // mismatched total vs planned 1000
      },
      rows: [{ ProductID: 101, Qty: 9, Price: 100, Total: 900 }] // qty 9 instead of 10
    });
    mockBridge.getTableRows.and.resolveTo([
      { ProductID: 101, Qty: 9, Price: 100, Total: 900 }
    ]);

    const res = await service.execute({
      fields: {
        CurrancyID: 'دولار',
        SupplierID: 'مؤسسة النصر',
        ExchangePrice: 49.5
      },
      rows: [{ Product: 'حجر سن 1', Qty: 10, Price: 100 }],
      isEditCurrent: false,
      prepareFormFn: async () => ({ status: 'ready' })
    });

    expect(res.status).toBe('ready_for_preview');
    expect(mockBridge.fillFormData).not.toHaveBeenCalled();
    expect(res.preview?.exchangeRateInfo?.hostComputedRate).toBe(48.2);
    expect(res.preview?.exchangeRateInfo?.userSpecifiedRate).toBe(49.5);
    expect(res.preview?.exchangeRateInfo?.hasMismatch).toBeTrue();
    expect(res.preview?.warnings.some((w) => w.includes('49.5') && w.includes('48.2'))).toBeTrue();
    expect(res.preview?.warnings.some((w) => w.includes('كمية الصف #1'))).toBeTrue();
    expect(res.preview?.warnings.some((w) => w.includes('الإجمالي الفعلي'))).toBeTrue();
  });

  it('resets half-filled form via clearTableRows + triggerAddNew', async () => {
    const resetOk = await service.resetHalfFilledForm();
    expect(resetOk).toEqual({ ok: true, errorMessage: undefined });
    expect(mockBridge.clearTableRows).toHaveBeenCalledTimes(1);
    expect(mockBridge.triggerAddNew).toHaveBeenCalledTimes(1);
  });
});


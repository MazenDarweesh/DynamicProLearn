import { TestBed } from '@angular/core/testing';
import {
  ErpBridgeService,
  isContractVersionAtLeast,
  validateAndMapLookupRows
} from './erp-bridge.service';
import { ErpTelemetryService } from './erp-telemetry.service';
import {
  DynamicErpBridge,
  ErpLookupFieldSpec,
  ErpRawLookupResponse
} from '../../models/erp-bridge.models';

describe('ErpBridgeService v2.5.0 Contract & Strict Lookup Transport (Step 1)', () => {
  let service: ErpBridgeService;
  let telemetrySpy: jasmine.SpyObj<ErpTelemetryService>;

  const productSpec: ErpLookupFieldSpec = {
    field: 'اسم المنتج',
    labelAr: 'الأصناف',
    scope: 'row',
    droModel: 'Product',
    valueKey: 'ProID',
    textKey: 'ProName'
  };

  function buildFullV250Bridge(overrides: Partial<DynamicErpBridge> = {}): DynamicErpBridge {
    return {
      getActiveScreen: () => ({ pageId: 289, pageName: 'Purchases' }),
      navigateToScreen: async () => true,
      triggerAddNew: async () => true,
      submitActiveForm: async () => ({ success: true }),
      getCapabilities: () => ({ version: '2.4.0', contractVersion: '2.5.0' }),
      fetchLookupData: async () => ({ status: 'ok', data: [], count: 0 }),
      clearTableRows: async () => ({ ok: true, count: 0 }),
      selectLookup: async () => ({ ok: true }),
      addTableRow: async () => ({ ok: true }),
      saveDocument: async () => ({ ok: true, POID: 9001, PONumber: 55, mode: 'new', errors: [] }),
      ...overrides
    };
  }

  beforeEach(() => {
    telemetrySpy = jasmine.createSpyObj<ErpTelemetryService>('ErpTelemetryService', ['log', 'logBridge', 'setScreenKey']);
    TestBed.configureTestingModule({
      providers: [
        ErpBridgeService,
        { provide: ErpTelemetryService, useValue: telemetrySpy }
      ]
    });
    service = TestBed.inject(ErpBridgeService);
  });

  afterEach(() => {
    delete (window as any).DynamicERP;
  });

  describe('Semver feature detection (contractVersion ONLY, ignoring version)', () => {
    it('evaluates isContractVersionAtLeast accurately across numeric semver boundaries', () => {
      expect(isContractVersionAtLeast('2.5.0')).toBeTrue();
      expect(isContractVersionAtLeast('v2.5.0')).toBeTrue();
      expect(isContractVersionAtLeast('2.5.1')).toBeTrue();
      expect(isContractVersionAtLeast('2.6.0')).toBeTrue();
      expect(isContractVersionAtLeast('2.10.0')).toBeTrue();
      expect(isContractVersionAtLeast('3.0.0')).toBeTrue();

      expect(isContractVersionAtLeast('2.4.9')).toBeFalse();
      expect(isContractVersionAtLeast('2.4.0')).toBeFalse();
      expect(isContractVersionAtLeast('1.9.9')).toBeFalse();
      expect(isContractVersionAtLeast('2.5.0-rc1')).toBeFalse();
      expect(isContractVersionAtLeast('')).toBeFalse();
      expect(isContractVersionAtLeast(null)).toBeFalse();
      expect(isContractVersionAtLeast(undefined)).toBeFalse();
      expect(isContractVersionAtLeast('not-semver')).toBeFalse();
    });

    it('reads strictly contractVersion=2.5.0 and ignores version=2.4.0 on getCapabilities()', () => {
      (window as any).DynamicERP = buildFullV250Bridge({
        getCapabilities: () => ({ version: '2.4.0', contractVersion: '2.5.0' })
      });
      expect(service.supportsContractV250()).toBeTrue();

      (window as any).DynamicERP = buildFullV250Bridge({
        getCapabilities: () => ({ version: '2.5.0' }) // missing contractVersion
      });
      expect(service.supportsContractV250()).toBeFalse();

      (window as any).DynamicERP = buildFullV250Bridge({
        getCapabilities: () => ({ version: '3.0.0', contractVersion: '2.4.0' })
      });
      expect(service.supportsContractV250()).toBeFalse();
    });

    it('returns false with WARN telemetry when contractVersion >= 2.5.0 but required bridge methods are missing', () => {
      const partialBridge = buildFullV250Bridge();
      delete partialBridge.saveDocument;
      (window as any).DynamicERP = partialBridge;

      expect(service.supportsContractV250()).toBeFalse();
      expect(telemetrySpy.log).toHaveBeenCalledWith(
        'BRIDGE',
        jasmine.stringMatching(/missing/i),
        jasmine.objectContaining({ missingMethods: ['saveDocument'] }),
        'WARN'
      );
    });
  });

  describe('fetchLookupRowsStrict() strict schema & empty-loading retry', () => {
    it('retries up to 3 times on status="empty" and succeeds if a later attempt returns valid rows', async () => {
      let calls = 0;
      (window as any).DynamicERP = buildFullV250Bridge({
        fetchLookupData: async (): Promise<ErpRawLookupResponse> => {
          calls++;
          if (calls < 3) {
            return { status: 'empty', data: [], count: 0 };
          }
          return {
            status: 'ok',
            data: [
              { ProID: 101, ProName: 'سن' },
              { ProID: 102, ProName: 'رمل' }
            ],
            count: 2
          };
        }
      });

      const res = await service.fetchLookupRowsStrict(productSpec, { maxEmptyRetries: 3, retryDelayMs: 5 });
      expect(calls).toBe(3);
      expect(res.status).toBe('ok');
      expect(res.attempts).toBe(3);
      expect(res.options.map((o) => ({ id: o.id, label: o.label }))).toEqual([
        { id: 101, label: 'سن' },
        { id: 102, label: 'رمل' }
      ]);
    });

    it('retries 3 times (~500ms default) on persistent status="empty" and treats it as not_loaded rather than not_found/empty', async () => {
      let calls = 0;
      const observedDelays: number[] = [];
      const realSetTimeout = window.setTimeout.bind(window);
      spyOn(window, 'setTimeout').and.callFake(((fn: TimerHandler, delay?: number) => {
        if (typeof delay === 'number' && delay >= 400) {
          observedDelays.push(delay);
          return realSetTimeout(fn, 2);
        }
        return realSetTimeout(fn, delay);
      }) as unknown as typeof window.setTimeout);

      (window as any).DynamicERP = buildFullV250Bridge({
        fetchLookupData: async (): Promise<ErpRawLookupResponse> => {
          calls++;
          return { status: 'empty', data: [], count: 0 };
        }
      });

      const res = await service.fetchLookupRowsStrict(productSpec); // default 3 retries @ 500ms

      expect(calls).toBe(4); // initial call + 3 retries
      expect(observedDelays).toEqual([500, 500, 500]);
      expect(res.status).toBe('not_loaded');
      expect(res.attempts).toBe(4);
      expect(res.options).toEqual([]);
      expect(telemetrySpy.log).toHaveBeenCalledWith(
        'BRIDGE',
        jasmine.stringMatching(/LOOKUP_STILL_EMPTY_TREATED_AS_NOT_LOADED/),
        jasmine.objectContaining({ droModel: 'Product', attempts: 4 }),
        'WARN'
      );
    });

    it('returns not_loaded immediately when host returns status="not_loaded"', async () => {
      let calls = 0;
      (window as any).DynamicERP = buildFullV250Bridge({
        fetchLookupData: async () => {
          calls++;
          return { status: 'not_loaded', data: [], count: 0 };
        }
      });

      const res = await service.fetchLookupRowsStrict(productSpec, { retryDelayMs: 5 });
      expect(calls).toBe(1);
      expect(res.status).toBe('not_loaded');
    });

    it('strictly validates exact valueKey/textKey, rejects valueKey=0/empty without flexible fallback normalizer, and returns invalid_row_schema if all rows fail', async () => {
      const mapped = validateAndMapLookupRows(
        [
          { ProID: 0, ProName: 'صنف صفر' },
          { ProID: '0', ProName: 'صنف نص صفر' },
          { ProID: 1, ProName: 'سن' },
          { id: 2, name: 'بديل مرفوض' },
          { ProID: 3, ProName: '   ' },
          { ProID: '', ProName: 'بدون كود' },
          { ProID: 4, ProName: 'رمل' }
        ],
        'ProID',
        'ProName'
      );
      expect(mapped.invalidRows).toBe(5);
      expect(mapped.options.map((o) => ({ id: o.id, label: o.label }))).toEqual([
        { id: 1, label: 'سن' },
        { id: 4, label: 'رمل' }
      ]);

      (window as any).DynamicERP = buildFullV250Bridge({
        fetchLookupData: async () => ({
          status: 'ok',
          data: [{ id: 1, name: 'اسم بمفتاح خطأ' }],
          count: 1
        })
      });

      const res = await service.fetchLookupRowsStrict(productSpec, { retryDelayMs: 5 });
      expect(res.status).toBe('invalid_row_schema');
      expect(res.invalidRows).toBe(1);
      expect(res.options).toEqual([]);
    });
  });

  describe('v2.5.0 action wrappers (clearTableRows, selectLookup, addTableRow, saveDocument)', () => {
    it('forwards clearTableRows, selectLookup, addTableRow, and saveDocument contracts faithfully', async () => {
      const clearSpy = jasmine.createSpy('clearTableRows').and.resolveTo({ ok: true, count: 3 });
      const selectSpy = jasmine.createSpy('selectLookup').and.resolveTo({ ok: true });
      const addSpy = jasmine.createSpy('addTableRow').and.resolveTo({ ok: true });
      const saveSpy = jasmine.createSpy('saveDocument').and.resolveTo({
        ok: true,
        POID: 14001,
        PONumber: 312,
        mode: 'new',
        errors: []
      });

      (window as any).DynamicERP = buildFullV250Bridge({
        clearTableRows: clearSpy,
        selectLookup: selectSpy,
        addTableRow: addSpy,
        saveDocument: saveSpy
      });

      const clearRes = await service.clearTableRows();
      expect(clearRes).toEqual({ ok: true, count: 3, reason: undefined });

      const selRes = await service.selectLookup('CurrancyID', 2);
      expect(selectSpy).toHaveBeenCalledWith('CurrancyID', 2);
      expect(selRes).toEqual({ ok: true, reason: undefined });

      const rowRes = await service.addTableRow({ ProductID: 36962, Qty: 10, Price: 500 });
      expect(addSpy).toHaveBeenCalledWith({ ProductID: 36962, Qty: 10, Price: 500 });
      expect(rowRes.ok).toBeTrue();

      const saveRes = await service.saveDocument({ expectedPOID: 14001, expectedPONumber: 312 });
      expect(saveSpy).toHaveBeenCalledWith({ expectedPOID: 14001, expectedPONumber: 312 });
      expect(saveRes).toEqual({ ok: true, POID: 14001, PONumber: 312, mode: 'new', errors: [] });
    });

    it('requires explicit ok === true in addTableRow() and rejects truthy/missing-ok host returns', async () => {
      let mockReturn: unknown = true;
      (window as any).DynamicERP = buildFullV250Bridge({
        addTableRow: async () => mockReturn as any
      });

      expect((await service.addTableRow({ ProductID: 1, Qty: 2 })).ok).toBeFalse();

      mockReturn = { count: 1 };
      expect((await service.addTableRow({ ProductID: 1, Qty: 2 })).ok).toBeFalse();

      mockReturn = { ok: 1 };
      expect((await service.addTableRow({ ProductID: 1, Qty: 2 })).ok).toBeFalse();

      mockReturn = { ok: false, reason: 'duplicate row' };
      const failedRes = await service.addTableRow({ ProductID: 1, Qty: 2 });
      expect(failedRes.ok).toBeFalse();
      expect(failedRes.reason).toBe('duplicate row');

      mockReturn = { ok: true };
      expect((await service.addTableRow({ ProductID: 1, Qty: 2 })).ok).toBeTrue();
    });

    it('handles failed/thrown host saveDocument safely without swallowing errors', async () => {
      (window as any).DynamicERP = buildFullV250Bridge({
        saveDocument: async () => {
          throw new Error('HTTP 500 PO Save');
        }
      });

      const res = await service.saveDocument();
      expect(res.ok).toBeFalse();
      expect(res.errors).toEqual(['HTTP 500 PO Save']);
    });
  });
});


import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ErpNavigatorService } from './erp-navigator.service';
import { ErpBridgeService } from './erp-bridge.service';
import {
  checkIsFormAlreadyOpen,
  getFormModeFromBridgeAndDom,
  resolveHostFormMode,
} from './navigator/form-opener';
import { ErpActiveFormContext, ErpFormStateSnapshot } from '../../models/erp-bridge.models';

describe('ErpNavigatorService & getFormMode()', () => {
  let navigator: ErpNavigatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ErpNavigatorService, ErpBridgeService],
    });
    navigator = TestBed.inject(ErpNavigatorService);
  });

  afterEach(() => {
    delete (window as any).DynamicERP;
    document.querySelectorAll('.test-erp-form-node').forEach((el) => el.remove());
  });

  function mountDomFormMarker(): void {
    const el = document.createElement('app-add-or-edit');
    el.className = 'test-erp-form-node';
    el.textContent = 'نموذج فاتورة';
    document.body.appendChild(el);
  }

  it('maps host getFormState() into all 4 ErpFormMode states', () => {
    expect(resolveHostFormMode({ isOpen: false, mode: 'closed' })).toBe('ClosedOrList');
    expect(resolveHostFormMode({ isOpen: false })).toBe('ClosedOrList');
    expect(resolveHostFormMode({ isOpen: true, mode: 'new', dirty: false })).toBe('EmptyNew');
    expect(resolveHostFormMode({ isOpen: true, mode: 'new', dirty: true })).toBe('UnsavedDraft');
    expect(resolveHostFormMode({ isOpen: true, mode: 'draft' })).toBe('UnsavedDraft');
    expect(resolveHostFormMode({ isOpen: true, mode: 'saved', dirty: false, docId: 13757 })).toBe('SavedOpen');
    expect(resolveHostFormMode({ isOpen: true, mode: 'saved', dirty: true, docId: 13757 })).toBe('SavedOpen');
  });

  it('uses getFormState() when available on window.DynamicERP', () => {
    let snapshot: ErpFormStateSnapshot = { isOpen: true, mode: 'saved', dirty: false, docId: 13757, docNumber: 231 };
    (window as any).DynamicERP = {
      getActiveScreen: () => ({ pageId: 289, pageName: 'Purchases' }),
      navigateToScreen: async () => true,
      triggerAddNew: async () => true,
      submitActiveForm: async () => true,
      getFormState: () => snapshot,
    };

    expect(navigator.getFormMode(true)).toBe('SavedOpen');

    snapshot = { isOpen: true, mode: 'new', dirty: true };
    expect(navigator.getFormMode(true)).toBe('UnsavedDraft');

    snapshot = { isOpen: true, mode: 'new', dirty: false };
    expect(navigator.getFormMode(true)).toBe('EmptyNew');

    snapshot = { isOpen: false, mode: 'list' };
    expect(navigator.getFormMode(true)).toBe('ClosedOrList');
  });

  it('falls back to getActiveFormContext() + DOM when getFormState() is unsupported', () => {
    let ctx: ErpActiveFormContext | null = null;
    (window as any).DynamicERP = {
      getActiveScreen: () => ({ pageId: 289, pageName: 'Purchases' }),
      navigateToScreen: async () => true,
      triggerAddNew: async () => true,
      submitActiveForm: async () => true,
      getActiveFormContext: () => ctx,
    };

    // 1. No form open -> ClosedOrList
    expect(navigator.getFormMode(true)).toBe('ClosedOrList');

    // 2. Open empty form with only boilerplate EmployeeId / dates -> EmptyNew
    ctx = {
      isOpen: true,
      screenName: 'Purchases',
      formType: 'excelObject',
      dataObject: { EmployeeId: 5269, PODate: '2026-11-10T10:00:00Z' },
      rows: [{ new: true }, { new: true }],
    };
    expect(getFormModeFromBridgeAndDom(TestBed.inject(ErpBridgeService), true)).toBe('EmptyNew');

    // 3. Unsaved form with bound product row (no POID yet) -> UnsavedDraft
    ctx = {
      isOpen: true,
      screenName: 'Purchases',
      formType: 'excelObject',
      dataObject: { EmployeeId: 5269, PODate: '2026-11-10T10:00:00Z', SupplierID: 3218 },
      rows: [{ new: true, ProductID: 36962, Quntity: '10' }],
    };
    expect(navigator.getFormMode(true)).toBe('UnsavedDraft');

    // 4. Saved form with POID & PONumber populated -> SavedOpen
    ctx = {
      isOpen: true,
      screenName: 'Purchases',
      formType: 'excelObject',
      dataObject: { POID: 13757, PONumber: 231, SupplierID: 3218 },
      rows: [{ new: false, ProductID: 36962, Quntity: '10' }],
    };
    expect(navigator.getFormMode(true)).toBe('SavedOpen');
  });

  it('prepareFreshForm skips triggerAddNew on EmptyNew/UnsavedDraft and calls triggerAddNew on SavedOpen and ClosedOrList', async () => {
    mountDomFormMarker();
    let formState: ErpFormStateSnapshot = { isOpen: true, mode: 'new', dirty: false };
    const triggerAddNewSpy = jasmine.createSpy('triggerAddNew').and.callFake(async () => {
      formState = { isOpen: true, mode: 'new', dirty: false };
      return true;
    });

    (window as any).DynamicERP = {
      getActiveScreen: () => ({ pageId: 289, pageName: 'Purchases' }),
      navigateToScreen: async () => true,
      triggerAddNew: triggerAddNewSpy,
      submitActiveForm: async () => true,
      getFormState: () => formState,
    };

    // EmptyNew -> already fresh
    expect(await navigator.prepareFreshForm(300)).toBeTrue();
    expect(triggerAddNewSpy).not.toHaveBeenCalled();

    // UnsavedDraft -> preserve draft without wiping via triggerAddNew
    formState = { isOpen: true, mode: 'new', dirty: true };
    expect(await navigator.prepareFreshForm(300)).toBeTrue();
    expect(triggerAddNewSpy).not.toHaveBeenCalled();

    // SavedOpen -> MUST call triggerAddNew to open a clean new form
    formState = { isOpen: true, mode: 'saved', dirty: false, docId: 13757 };
    expect(await navigator.prepareFreshForm(400)).toBeTrue();
    expect(triggerAddNewSpy).toHaveBeenCalledTimes(1);
    expect(navigator.getFormMode(true)).toBe('EmptyNew');

    // ClosedOrList -> calls triggerAddNew
    formState = { isOpen: false, mode: 'closed' };
    expect(await navigator.prepareFreshForm(400)).toBeTrue();
    expect(triggerAddNewSpy).toHaveBeenCalledTimes(2);
    expect(navigator.getFormMode(true)).toBe('EmptyNew');
  });

  it('resolveAndNavigate keeps SavedOpen form open when query is an edit request', async () => {
    mountDomFormMarker();
    const triggerAddNewSpy = jasmine.createSpy('triggerAddNew').and.resolveTo(true);
    const formState: ErpFormStateSnapshot = { isOpen: true, mode: 'saved', dirty: false, docId: 13757 };
    (window as any).DynamicERP = {
      getActiveScreen: () => ({ pageId: 289, pageName: 'Purchases' }),
      navigateToScreen: async () => true,
      triggerAddNew: triggerAddNewSpy,
      submitActiveForm: async () => true,
      listScreens: () => [{ pageId: 289, pageName: 'Purchases', title: 'فواتير المشتريات' }],
      getFormState: () => formState,
    };

    const navSpy = jasmine.createSpyObj('CopilotService', [
      'resolveErpNavigation',
      'sendErpTelemetry',
    ]);
    navSpy.sendErpTelemetry.and.resolveTo({ status: 'ok' });
    navSpy.resolveErpNavigation.and.resolveTo({
      decision: 'go',
      intent: 'action',
      candidates: [{ id: 'Purchases', confidence: 0.99, reason: 'match' }],
    });
    const injector = TestBed.inject(Injector);
    spyOn(injector, 'get').and.returnValue(navSpy);

    const res = await navigator.resolveAndNavigate('عدل الفاتورة السابقة وغير المخزن');
    expect(res.success).toBeTrue();
    expect(triggerAddNewSpy).not.toHaveBeenCalled();
  });

  it('prepareFreshForm with resetDraft=true resets UnsavedDraft to EmptyNew and fails on timeout if host stays UnsavedDraft', async () => {
    mountDomFormMarker();
    let formState: ErpFormStateSnapshot = { isOpen: true, mode: 'new', dirty: true };
    const triggerAddNewSpy = jasmine.createSpy('triggerAddNew').and.callFake(async () => {
      formState = { isOpen: true, mode: 'new', dirty: false };
      return true;
    });

    (window as any).DynamicERP = {
      getActiveScreen: () => ({ pageId: 289, pageName: 'Purchases' }),
      navigateToScreen: async () => true,
      triggerAddNew: triggerAddNewSpy,
      submitActiveForm: async () => true,
      getFormState: () => formState,
    };

    // With resetDraft=true -> calls triggerAddNew and verifies transition to EmptyNew
    expect(await navigator.prepareFreshForm(300, { resetDraft: true })).toBeTrue();
    expect(triggerAddNewSpy).toHaveBeenCalledTimes(1);
    expect(navigator.getFormMode(true)).toBe('EmptyNew');

    // If host fails to leave UnsavedDraft -> times out and returns false loudly
    formState = { isOpen: true, mode: 'new', dirty: true };
    triggerAddNewSpy.and.resolveTo(false);
    expect(await navigator.prepareFreshForm(120, { resetDraft: true })).toBeFalse();
  });

  it('resolveAndNavigate with deferFormPrepOnOpenForm=true preserves SavedOpen and UnsavedDraft for new queries', async () => {
    mountDomFormMarker();
    const triggerAddNewSpy = jasmine.createSpy('triggerAddNew').and.resolveTo(true);
    let formState: ErpFormStateSnapshot = { isOpen: true, mode: 'saved', dirty: false, docId: 13757 };
    (window as any).DynamicERP = {
      getActiveScreen: () => ({ pageId: 289, pageName: 'Purchases' }),
      navigateToScreen: async () => true,
      triggerAddNew: triggerAddNewSpy,
      submitActiveForm: async () => true,
      listScreens: () => [{ pageId: 289, pageName: 'Purchases', title: 'فواتير المشتريات' }],
      getFormState: () => formState,
    };

    const navSpy = jasmine.createSpyObj('CopilotService', [
      'resolveErpNavigation',
      'sendErpTelemetry',
    ]);
    navSpy.sendErpTelemetry.and.resolveTo({ status: 'ok' });
    navSpy.resolveErpNavigation.and.resolveTo({
      decision: 'go',
      intent: 'action',
      candidates: [{ id: 'Purchases', confidence: 0.99, reason: 'match' }],
    });
    const injector = TestBed.inject(Injector);
    spyOn(injector, 'get').and.returnValue(navSpy);

    const savedRes = await navigator.resolveAndNavigate('سجل فاتورة مشتريات جديدة', {
      deferFormPrepOnOpenForm: true,
    });
    expect(savedRes.success).toBeTrue();
    expect(triggerAddNewSpy).not.toHaveBeenCalled();

    formState = { isOpen: true, mode: 'new', dirty: true };
    const draftRes = await navigator.resolveAndNavigate('سجل فاتورة مشتريات جديدة', {
      deferFormPrepOnOpenForm: true,
    });
    expect(draftRes.success).toBeTrue();
    expect(triggerAddNewSpy).not.toHaveBeenCalled();
  });

  it('surfaces local primary-module askOptions (no id < 1000 heuristic) when backend clarify returns on navigate intent', async () => {
    (window as any).DynamicERP = {
      listScreens: () => [
        { pageId: 101, pageName: 'الفواتير المرحلة', moduleName: 'الفاتورة الالكترونية' },
        { pageId: 7001, pageName: 'فواتير المشتريات', moduleName: 'الموردين و المشتريات' },
        { pageId: 7002, pageName: 'فواتير المبيعات', moduleName: 'العملاء  و المبيعات' },
      ],
    };
    const fakeCopilot = {
      resolveErpNavigation: jasmine.createSpy('resolveErpNavigation').and.resolveTo({
        decision: 'clarify',
        intent: 'navigate',
        source: 'ai',
        candidates: [],
      }),
    };
    spyOn((navigator as any).injector, 'get').and.returnValue(fakeCopilot);

    const res = await navigator.resolveAndNavigate('عايز افتح شاشة الفواتير');
    expect(res.success).toBeFalse();
    expect(res.decision).toBe('clarify');
    expect(res.askOptions?.length).toBeGreaterThanOrEqual(2);
    const ids = (res.askOptions || []).map((o) => o.id);
    expect(ids[0]).toMatch(/^700[12]$/);
    expect(ids.slice(0, 2)).toContain('7001');
    expect(ids.slice(0, 2)).toContain('7002');
  });

  it('returns explicit non-empty message when bridge is available but listScreens returns empty', async () => {
    (window as any).DynamicERP = {
      listScreens: () => [],
    };
    const res = await navigator.resolveAndNavigate('عايز افتح شاشة الفواتير');
    expect(res.success).toBeFalse();
    expect(res.decision).toBe('clarify');
    expect(res.message).toContain('لم يتم العثور على أي شاشات متاحة');
  });

  it('Module 3-a: concurrent prepareFreshForm calls share the same in-flight promise and call triggerAddNew once', async () => {
    mountDomFormMarker();
    let formState: ErpFormStateSnapshot = { isOpen: false, mode: 'closed' };
    const triggerAddNewSpy = jasmine.createSpy('triggerAddNew').and.callFake(async () => {
      await new Promise((r) => setTimeout(r, 30));
      formState = { isOpen: true, mode: 'new', dirty: false };
      return true;
    });

    (window as any).DynamicERP = {
      getActiveScreen: () => ({ pageId: 289, pageName: 'Purchases' }),
      navigateToScreen: async () => true,
      triggerAddNew: triggerAddNewSpy,
      submitActiveForm: async () => true,
      getFormState: () => formState,
    };

    const p1 = navigator.prepareFreshForm(500);
    const p2 = navigator.prepareFreshForm(500);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBeTrue();
    expect(r2).toBeTrue();
    expect(triggerAddNewSpy).toHaveBeenCalledTimes(1);
  });

  it('Module 3-b: checkIsFormAlreadyOpen ignores Master List filter dropdowns (CreatedBy_gd) when form is closed', () => {
    const bridge = TestBed.inject(ErpBridgeService);
    (window as any).DynamicERP = {
      getActiveScreen: () => ({ pageId: 289, pageName: 'Purchases' }),
      getActiveFormContext: () => null,
    };

    const filterDropdown = document.createElement('ng-select');
    filterDropdown.className = 'test-erp-form-node';
    filterDropdown.setAttribute('formcontrolname', 'CreatedBy_gd');
    filterDropdown.textContent = 'المستخدم';
    document.body.appendChild(filterDropdown);

    expect(checkIsFormAlreadyOpen(bridge, true)).toBeFalse();

    // Once app-add-or-edit is mounted, checkIsFormAlreadyOpen returns true
    mountDomFormMarker();
    expect(checkIsFormAlreadyOpen(bridge, true)).toBeTrue();
  });

  it('Module 3-b fallback: when bridge.triggerAddNew returns false, prepareFreshForm falls back to clicking DOM Add New button', async () => {
    let formState: ErpFormStateSnapshot = { isOpen: false, mode: 'closed' };
    const triggerAddNewSpy = jasmine.createSpy('triggerAddNew').and.resolveTo(false);

    (window as any).DynamicERP = {
      getActiveScreen: () => ({ pageId: 289, pageName: 'Purchases' }),
      navigateToScreen: async () => true,
      triggerAddNew: triggerAddNewSpy,
      submitActiveForm: async () => true,
      getFormState: () => formState,
    };

    const addBtn = document.createElement('button');
    addBtn.className = 'dp-btn--primary dp-list__act test-erp-form-node';
    addBtn.textContent = 'اضافة جديد';
    addBtn.addEventListener('click', () => {
      formState = { isOpen: true, mode: 'new', dirty: false };
      mountDomFormMarker();
    });
    document.body.appendChild(addBtn);

    const ok = await navigator.prepareFreshForm(500);
    expect(triggerAddNewSpy).toHaveBeenCalledTimes(1);
    expect(ok).toBeTrue();
    expect(navigator.getFormMode(true)).toBe('EmptyNew');
  });
});


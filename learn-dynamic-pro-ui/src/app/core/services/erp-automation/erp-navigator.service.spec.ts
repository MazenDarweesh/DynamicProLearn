import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ErpNavigatorService } from './erp-navigator.service';
import { ErpBridgeService } from './erp-bridge.service';
import {
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
});


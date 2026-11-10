import {
  buildFormDiffEntries,
  detectUnsupportedEditCommand,
  evaluateSaveGuard,
  extractDocRef,
  isEditExistingFormQuery,
  resolveEditCurrentIntent,
} from './erp-save-guard.helper';
import { ErpActiveFormContext, FormFieldSchema } from '../../../../core/services/erp-automation';

describe('erp-save-guard.helper', () => {
  it('blocks second save when host getFormState reports mode=saved and dirty=false', () => {
    const res = evaluateSaveGuard({
      isSavingInFlight: false,
      msg: { saveStatus: undefined },
      userClickedSave: true,
      formMode: 'SavedOpen',
      formState: { isOpen: true, mode: 'saved', dirty: false, docId: 13757 },
    });

    expect(res.allow).toBeFalse();
    expect(res.reason).toBe('saved_not_dirty');
  });

  it('allows saving a SavedOpen edit only when dirty=true AND user clicked save', () => {
    const blockedAuto = evaluateSaveGuard({
      isSavingInFlight: false,
      msg: { targetFormMode: 'SavedOpen', requiresExplicitUpdateConfirm: true },
      userClickedSave: false,
      formMode: 'SavedOpen',
      formState: { isOpen: true, mode: 'saved', dirty: true, docId: 13757 },
    });
    expect(blockedAuto.allow).toBeFalse();
    expect(blockedAuto.reason).toBe('requires_edit_card_confirm');

    const allowedEdit = evaluateSaveGuard({
      isSavingInFlight: false,
      msg: { targetFormMode: 'SavedOpen', requiresExplicitUpdateConfirm: true },
      userClickedSave: true,
      formMode: 'SavedOpen',
      formState: { isOpen: true, mode: 'saved', dirty: true, docId: 13757 },
    });
    expect(allowedEdit.allow).toBeTrue();
  });

  it('blocks concurrent saves while isSavingInFlight is true', () => {
    const res = evaluateSaveGuard({
      isSavingInFlight: true,
      msg: { saveStatus: undefined },
      userClickedSave: true,
      formMode: 'EmptyNew',
      formState: { isOpen: true, mode: 'new', dirty: true },
    });

    expect(res.allow).toBeFalse();
    expect(res.reason).toBe('in_flight');
  });

  it('builds readable before/after diff entries for SavedOpen header and row changes', () => {
    const preCtx: ErpActiveFormContext = {
      isOpen: true,
      screenName: 'Purchases',
      dataObject: {
        POID: 13757,
        PONumber: 231,
        SupplierID: 3218,
        SName: 'حسين',
        StoreID: 'مخزن قديم',
        ProjectID: 'السحاب',
      },
      rows: [{ new: false, ProductID: 36962, Quntity: '10' }],
    };

    const schemas: FormFieldSchema[] = [
      { key: 'SupplierID', label: 'المورد', kind: 'ng-select', group: 'header' },
      { key: 'StoreID', label: 'المخزن', kind: 'ng-select', group: 'header' },
      { key: 'ProjectID', label: 'المشروع', kind: 'ng-select', group: 'header' },
    ];

    const diffs = buildFormDiffEntries(preCtx, {
      fields: {
        StoreID: 'مخزن خامات',
        ProjectID: '$CLEAR',
      },
      rows: [{ 'اسم المنتج': 'سن', 'الكمية': 15 }],
    }, schemas);

    expect(diffs.length).toBe(3);
    expect(diffs[0]).toEqual(jasmine.objectContaining({ key: 'StoreID', label: 'المخزن', before: 'مخزن قديم', after: 'مخزن خامات', kind: 'changed' }));
    expect(diffs[1]).toEqual(jasmine.objectContaining({ key: 'ProjectID', label: 'المشروع', before: 'السحاب', after: '∅ (مسح)', kind: 'cleared' }));
    expect(diffs[2]).toEqual(jasmine.objectContaining({ scope: 'row', label: 'سطر #1', kind: 'changed' }));
  });

  it('distinguishes edit queries on saved invoices from new-invoice commands', () => {
    expect(isEditExistingFormQuery('عدل الفاتورة السابقة وسجل المشروع تحت')).toBeTrue();
    expect(isEditExistingFormQuery('غير المخزن إلى مخزن خامات')).toBeTrue();
    expect(isEditExistingFormQuery('سجل فاتورة مشتريات جديدة من المورد حسين')).toBeFalse();
    expect(extractDocRef({ docNumber: 231, docId: 13757 }, null)).toBe('231');
  });

  it('resolveEditCurrentIntent prefers structured action_intent over conflicting regex and falls back only when absent', () => {
    // 1. action_intent='edit_current' wins even when query has zero edit regex keywords
    expect(
      resolveEditCurrentIntent({ action_intent: 'edit_current' }, 'خلي المخزن مخزن خامات')
    ).toBeTrue();

    // 2. action_intent='new' wins even when query matches edit regex strongly
    expect(
      resolveEditCurrentIntent({ action_intent: 'new' }, 'عدل المورد وغير المخزن في الفاتورة')
    ).toBeFalse();

    // 3. Absent action_intent falls back to regex
    expect(
      resolveEditCurrentIntent({ action_intent: undefined }, 'غير المخزن إلى مخزن خامات')
    ).toBeTrue();
    expect(
      resolveEditCurrentIntent(undefined, 'سجل فاتورة مشتريات جديدة')
    ).toBeFalse();
  });

  it('detectUnsupportedEditCommand flags unexecutable header-grid transfer edits as unsupported while allowing normal edits', () => {
    const moveRes = detectUnsupportedEditCommand(
      { action_intent: 'edit_current', fields: { ProjectID: 'بجوار المنتج' }, rows: [] },
      'عدل الفاتورة السابقة وسجل المشروع تحت بجوار المنتج'
    );
    expect(moveRes.unsupported).toBeTrue();
    expect(moveRes.userMessage).toContain('غير مدعوم حالياً');

    const clearMoveRes = detectUnsupportedEditCommand(
      { action_intent: 'edit_current', fields: { ProjectID: null }, rows: [] },
      'احذف  المشروع من فوق وخليه تحت مع المنتج فقط'
    );
    expect(clearMoveRes.unsupported).toBeTrue();
    expect(clearMoveRes.userMessage).toContain('غير مدعوم حالياً');

    const validEditRes = detectUnsupportedEditCommand(
      { action_intent: 'edit_current', fields: { StoreID: 'مخزن خامات' }, rows: [] },
      'خلي المخزن مخزن خامات'
    );
    expect(validEditRes.unsupported).toBeFalse();
  });
});


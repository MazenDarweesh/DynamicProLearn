import { TestBed } from '@angular/core/testing';
import {
  PurchasesEntityResolverService,
  detectDuplicateArabicFieldLabels,
  isPureNumericItemTerm,
  matchLookupOptionsStrict,
  normalizeEntityForExact
} from './purchases-entity-resolver.service';
import {
  PURCHASES_WAVE1_LOOKUP_TABLE,
  extractRowItemQuery,
  extractWave1HeaderTerm
} from './purchases-wave1-registry';
import { ErpBridgeService } from '../erp-bridge.service';
import { ErpTelemetryService } from '../erp-telemetry.service';
import { DynamicErpBridge, ErpLookupOption } from '../../../models/erp-bridge.models';
import { FormFieldSchema } from '../../../models/erp-form.models';

describe('PurchasesEntityResolverService & Wave 1 Matching (Step 2)', () => {
  let resolver: PurchasesEntityResolverService;
  let telemetrySpy: jasmine.SpyObj<ErpTelemetryService>;

  let mockCatalogs: Record<string, { status: string; data: Record<string, unknown>[]; count: number }>;

  function buildBridge(overrides: Partial<DynamicErpBridge> = {}): DynamicErpBridge {
    return {
      getActiveScreen: () => ({ pageId: 289, pageName: 'Purchases' }),
      navigateToScreen: async () => true,
      triggerAddNew: async () => true,
      submitActiveForm: async () => ({ success: true }),
      getCapabilities: () => ({ version: '2.4.0', contractVersion: '2.5.0' }),
      fetchLookupData: async (droModel: string) =>
        mockCatalogs[droModel] || { status: 'not_loaded', data: [], count: 0 },
      clearTableRows: async () => ({ ok: true, count: 0 }),
      selectLookup: async () => ({ ok: true }),
      addTableRow: async () => ({ ok: true }),
      saveDocument: async () => ({ ok: true, POID: 1, PONumber: 1 }),
      ...overrides
    };
  }

  beforeEach(() => {
    mockCatalogs = {
      Supplier: {
        status: 'ok',
        count: 3,
        data: [
          { SID: 3218, SName: 'حسين' },
          { SID: 4102, SName: 'حسين أحمد' },
          { SID: 5100, SName: 'شركة النور للتوريدات' }
        ]
      },
      Store: {
        status: 'ok',
        count: 2,
        data: [
          { SID: 1047, SName: 'مخزن خامات' },
          { SID: 1048, SName: 'مخزن منتج تام' }
        ]
      },
      Currancy: {
        status: 'ok',
        count: 2,
        data: [
          { CID: 1, CName: 'EGP' },
          { CID: 2, CName: 'دولار أمريكي' }
        ]
      },
      PurchaseSetting: {
        status: 'ok',
        count: 2,
        data: [
          { PSID: 15, PSName: 'مشتريات مباشرة' },
          { PSID: 16, PSName: 'مشتريات غير مباشرة' }
        ]
      },
      Product: {
        status: 'ok',
        count: 6,
        data: [
          { ProID: 36962, ProName: 'سن' },
          { ProID: 36963, ProName: 'رمل' },
          { ProID: 36964, ProName: 'سن كبير' },
          { ProID: 36965, ProName: 'زلط سن 10' },
          { ProID: 10, ProName: 'حديد 10 مم' },
          { ProID: 20, ProName: 'اسمنت 20' }
        ]
      }
    };

    telemetrySpy = jasmine.createSpyObj<ErpTelemetryService>('ErpTelemetryService', ['log', 'logBridge', 'setScreenKey']);
    TestBed.configureTestingModule({
      providers: [
        PurchasesEntityResolverService,
        ErpBridgeService,
        { provide: ErpTelemetryService, useValue: telemetrySpy }
      ]
    });
    resolver = TestBed.inject(PurchasesEntityResolverService);
    (window as any).DynamicERP = buildBridge();
  });

  afterEach(() => {
    delete (window as any).DynamicERP;
  });

  it('defines the fixed Wave 1 static registry including Product/ProID/ProName and excludes Wave 2 fields', () => {
    expect(PURCHASES_WAVE1_LOOKUP_TABLE.SupplierID).toEqual({
      field: 'SupplierID',
      labelAr: 'المورد',
      scope: 'header',
      droModel: 'Supplier',
      valueKey: 'SID',
      textKey: 'SName'
    });
    expect(PURCHASES_WAVE1_LOOKUP_TABLE.StoreID).toEqual({
      field: 'StoreID',
      labelAr: 'المخزن',
      scope: 'header',
      droModel: 'Store',
      valueKey: 'SID',
      textKey: 'SName'
    });
    expect(PURCHASES_WAVE1_LOOKUP_TABLE.CurrancyID).toEqual({
      field: 'CurrancyID',
      labelAr: 'العملة',
      scope: 'header',
      droModel: 'Currancy',
      valueKey: 'CID',
      textKey: 'CName'
    });
    expect(PURCHASES_WAVE1_LOOKUP_TABLE.POSetting).toEqual({
      field: 'POSetting',
      labelAr: 'طريقة الشراء',
      scope: 'header',
      droModel: 'PurchaseSetting',
      valueKey: 'PSID',
      textKey: 'PSName'
    });
    expect(PURCHASES_WAVE1_LOOKUP_TABLE.ProductID).toEqual({
      field: 'ProductID',
      labelAr: 'الأصناف',
      scope: 'row',
      droModel: 'Product',
      valueKey: 'ProID',
      textKey: 'ProName'
    });
    expect((PURCHASES_WAVE1_LOOKUP_TABLE as Record<string, unknown>)['ProjectID']).toBeUndefined();
    expect((PURCHASES_WAVE1_LOOKUP_TABLE as Record<string, unknown>)['SafeAccounId']).toBeUndefined();
  });

  it('resolves unique exact/near-exact normalized matches automatically even alongside partial siblings', async () => {
    const res = await resolver.resolveWave1({
      fields: {
        SupplierID: 'حسين', // exact despite 'حسين أحمد' existing
        'المورد': 'حسين', // duplicate alias should not trigger extra fetch
        StoreID: '  مخزن\u200F خامات  ', // near-exact with bidi char & whitespace
        CurrancyID: 'egp', // near-exact case-insensitive
        POSetting: 'مشتريات مباشره', // near-exact ة -> ه
        ProjectID: 'السحاب', // Wave 2 -> ignored by Wave 1 resolver
        SafeAccounId: 'الخزينة الرئيسية' // Wave 2 -> ignored
      },
      rows: [
        { 'اسم المنتج': 'سن', 'الكمية': 10 },
        { ProductID: 'رمل', Qty: 20 }
      ]
    });

    expect(res.readyToApply).toBeTrue();
    expect(res.blockingIssues).toEqual([]);
    expect(res.ignoredNonWave1Fields).toEqual(['ProjectID', 'SafeAccounId']);
    expect(res.headerResolutions.SupplierID?.resolvedId).toBe(3218);
    expect(res.headerResolutions.StoreID?.resolvedId).toBe(1047);
    expect(res.headerResolutions.CurrancyID?.resolvedId).toBe(1);
    expect(res.headerResolutions.POSetting?.resolvedId).toBe(15);
    expect(res.rowResolutions[0].resolvedId).toBe(36962);
    expect(res.rowResolutions[1].resolvedId).toBe(36963);
    expect(res.metricsSummary.resolved).toBe(6);
    expect(res.metricsSummary.itemAmbiguityRate).toBe(0);
  });

  it('treats single non-exact partial candidate AND multiple partial candidates strictly as ambiguous (never auto-resolves)', () => {
    const currencyOpts: ErpLookupOption[] = [
      { id: 1, label: 'EGP', raw: {} },
      { id: 2, label: 'دولار أمريكي', raw: {} }
    ];

    // Single partial match 'دولار' -> 'دولار أمريكي' MUST be ambiguous, NOT auto-resolved
    const singlePartial = matchLookupOptionsStrict('دولار', currencyOpts, { scope: 'header' });
    expect(singlePartial.status).toBe('ambiguous');
    expect(singlePartial.matchTier).toBe('starts_with');
    expect(singlePartial.candidates.map((c) => c.id)).toEqual([2]);

    // Near-exact normalized 'دولار امريكى' -> exact normalized -> resolved
    const nearExact = matchLookupOptionsStrict('دولار امريكى', currencyOpts, { scope: 'header' });
    expect(nearExact.status).toBe('resolved');
    expect(nearExact.matchTier).toBe('exact');
    expect(nearExact.resolvedOption?.id).toBe(2);
    expect(normalizeEntityForExact('شركة-الحمد\u200F')).toBe('شركه الحمد');
  });

  it('ranks item candidates strictly in order: exact -> startsWith -> contains, measuring itemAmbiguityRate', async () => {
    mockCatalogs['Product'] = {
      status: 'ok',
      count: 4,
      data: [
        { ProID: 201, ProName: 'رمل سن ناعم' }, // contains 'سن'
        { ProID: 202, ProName: 'سن بازلت' }, // startsWith 'سن'
        { ProID: 203, ProName: 'سن مقاس وسط' }, // startsWith 'سن'
        { ProID: 204, ProName: 'زلط سن' } // contains 'سن'
      ]
    };

    const res = await resolver.resolveWave1({
      rows: [
        { 'اسم المنتج': 'سن', 'الكمية': 10 }
      ]
    });

    expect(res.readyToApply).toBeFalse();
    expect(res.rowResolutions[0].status).toBe('ambiguous');
    expect(res.rowResolutions[0].matchTier).toBe('starts_with');
    expect(res.rowResolutions[0].candidates.map((c) => c.label)).toEqual([
      'سن بازلت',
      'سن مقاس وسط',
      'زلط سن',
      'رمل سن ناعم'
    ]);
    expect(res.metricsSummary.itemAmbiguous).toBe(1);
    expect(res.metricsSummary.itemAmbiguityRate).toBe(1);
  });

  it('rejects purely numeric item queries (quantities like 10, ٢٠, 5.5) BEFORE matching product names or ProIDs, while allowing text+digit items', async () => {
    expect(isPureNumericItemTerm(10)).toBeTrue();
    expect(isPureNumericItemTerm('10')).toBeTrue();
    expect(isPureNumericItemTerm('٢٠')).toBeTrue();
    expect(isPureNumericItemTerm('5.5')).toBeTrue();
    expect(isPureNumericItemTerm('حديد 10 مم')).toBeFalse();
    expect(isPureNumericItemTerm('زلط سن 10')).toBeFalse();

    const res = await resolver.resolveWave1({
      rows: [
        { 'اسم المنتج': '10', 'الكمية': 10 },
        { 'اسم المنتج': '٢٠', 'الكمية': 20 },
        { 'اسم المنتج': 'حديد 10 مم', 'الكمية': 5 }
      ]
    });

    expect(res.readyToApply).toBeFalse();
    expect(res.rowResolutions[0].status).toBe('not_found');
    expect(res.rowResolutions[0].reason).toBe('numeric_item_rejected');
    expect(res.rowResolutions[0].candidates).toEqual([]);

    expect(res.rowResolutions[1].status).toBe('not_found');
    expect(res.rowResolutions[1].reason).toBe('numeric_item_rejected');

    // Text + number item resolves uniquely!
    expect(res.rowResolutions[2].status).toBe('resolved');
    expect(res.rowResolutions[2].resolvedId).toBe(10);
  });

  it('respects bidirectional negation guard on partial candidates (مباشرة <-> غير مباشرة)', () => {
    const poOpts: ErpLookupOption[] = [
      { id: 16, label: 'مشتريات غير مباشرة', raw: {} }
    ];
    expect(matchLookupOptionsStrict('مباشرة', poOpts, { scope: 'header' }).status).toBe('not_found');

    const affirmativeAndNegative: ErpLookupOption[] = [
      { id: 15, label: 'مشتريات مباشرة', raw: {} },
      { id: 16, label: 'مشتريات غير مباشرة', raw: {} }
    ];
    const negativeQuery = matchLookupOptionsStrict('غير مباشرة', affirmativeAndNegative, { scope: 'header' });
    expect(negativeQuery.status).toBe('ambiguous');
    expect(negativeQuery.candidates.map((c) => c.id)).toEqual([16]);
  });

  it('resolves closed-set currency synonyms ("مصري", "جنيه", "دولار") in registry while keeping multi-dollar catalogs ambiguous', async () => {
    // 1. Catalog: [{ CID: 1, CName: 'EGP' }, { CID: 2, CName: 'دولار أمريكي' }]
    for (const egyptTerm of ['مصري', 'جنيه', 'EGP']) {
      const r = await resolver.resolveWave1({ fields: { CurrancyID: egyptTerm } });
      expect(r.readyToApply).toBeTrue();
      expect(r.headerResolutions.CurrancyID?.resolvedId).toBe(1);
    }

    const usdFromArabic = await resolver.resolveWave1({ fields: { CurrancyID: 'دولار' } });
    expect(usdFromArabic.readyToApply).toBeTrue();
    expect(usdFromArabic.headerResolutions.CurrancyID?.matchTier).toBe('synonym');
    expect(usdFromArabic.headerResolutions.CurrancyID?.resolvedId).toBe(2);

    // 2. Host catalog using Arabic label for EGP and ISO code for USD
    mockCatalogs['Currancy'] = {
      status: 'ok',
      count: 2,
      data: [
        { CID: 1, CName: 'جنيه مصرى' },
        { CID: 2, CName: 'USD' }
      ]
    };
    expect((await resolver.resolveWave1({ fields: { CurrancyID: 'مصري' } })).headerResolutions.CurrancyID?.resolvedId).toBe(1);
    expect((await resolver.resolveWave1({ fields: { CurrancyID: 'دولار' } })).headerResolutions.CurrancyID?.resolvedId).toBe(2);

    // 3. Conflicting multiple dollar currencies -> MUST trigger ambiguous instead of auto-picking USD
    mockCatalogs['Currancy'] = {
      status: 'ok',
      count: 3,
      data: [
        { CID: 1, CName: 'EGP' },
        { CID: 2, CName: 'دولار أمريكي' },
        { CID: 3, CName: 'دولار كندي' }
      ]
    };
    const multiDollar = await resolver.resolveWave1({ fields: { CurrancyID: 'دولار' } });
    expect(multiDollar.readyToApply).toBeFalse();
    expect(multiDollar.headerResolutions.CurrancyID?.status).toBe('ambiguous');
    expect(multiDollar.headerResolutions.CurrancyID?.candidates.map((c) => c.id)).toEqual([2, 3]);
  });

  it('treats duplicate Arabic schema labels (StoreID vs SystemStore) as schema ambiguity without relying on StoreID aliases', async () => {
    const syn03LikeSchema: FormFieldSchema[] = [
      { key: 'SupplierID', label: 'المورد', kind: 'ng-select', group: 'header' },
      { key: 'StoreID', label: 'المخزن', kind: 'ng-select', group: 'header' },
      { key: 'SystemStore', label: 'المخزن', kind: 'ng-select', group: 'grid' }
    ];

    // Pseudo-label echo in single-control runtime schema must NOT trigger false ambiguity
    const normalPurchasesSchema: FormFieldSchema[] = [
      { key: 'المخزن', label: 'المخزن', kind: 'ng-select', group: 'header' },
      { key: 'StoreID', label: 'المخزن', kind: 'ng-select', group: 'header' }
    ];
    expect(detectDuplicateArabicFieldLabels(normalPurchasesSchema)).toEqual([]);
    expect(detectDuplicateArabicFieldLabels(syn03LikeSchema).length).toBe(1);

    // Without duplicate schema, SystemStore is NOT aliased to StoreID
    const noSchema = await resolver.resolveWave1({
      fields: { SystemStore: 'مخزن خامات' }
    });
    expect(noSchema.ignoredNonWave1Fields).toEqual(['SystemStore']);
    expect(noSchema.headerResolutions.StoreID).toBeUndefined();

    // With duplicate schema, SystemStore triggers field_schema ambiguity strictly from schema duplication
    const blocked = await resolver.resolveWave1({
      fields: { SystemStore: 'مخزن خامات' },
      schema: syn03LikeSchema
    });

    expect(blocked.readyToApply).toBeFalse();
    expect(blocked.ignoredNonWave1Fields).toEqual([]);
    expect(blocked.headerResolutions.StoreID?.status).toBe('ambiguous');
    expect(blocked.headerResolutions.StoreID?.ambiguityKind).toBe('field_schema');
    expect(blocked.headerResolutions.StoreID?.fieldCandidates?.map((c) => c.key)).toEqual([
      'StoreID',
      'SystemStore'
    ]);
    expect(blocked.metricsSummary.fieldAmbiguous).toBe(1);

    // Once user chooses the exact schema field key ('StoreID'), lookup proceeds normally
    const unblocked = await resolver.resolveWave1({
      fields: { SystemStore: 'مخزن خامات' },
      schema: syn03LikeSchema,
      resolvedSchemaFields: { 'المخزن': 'StoreID' }
    });
    expect(unblocked.readyToApply).toBeTrue();
    expect(unblocked.headerResolutions.StoreID?.resolvedId).toBe(1047);
  });

  it('resolves preselected user chip IDs cleanly and maps persistent empty retries to not_loaded', async () => {
    mockCatalogs['Store'] = { status: 'empty', data: [], count: 0 };

    const res = await resolver.resolveWave1({
      fields: {
        StoreID: 'مخزن خامات',
        CurrancyID: 'دولار' // ambiguous until preselected
      },
      preselectedLookupIds: {
        CurrancyID: 2
      },
      fetchOptions: { maxEmptyRetries: 3, retryDelayMs: 2 }
    });

    expect(res.readyToApply).toBeFalse();
    expect(res.headerResolutions.CurrancyID?.status).toBe('resolved');
    expect(res.headerResolutions.CurrancyID?.matchTier).toBe('user_selected');
    expect(res.headerResolutions.CurrancyID?.resolvedId).toBe(2);
    expect(res.headerResolutions.StoreID?.status).toBe('not_loaded');
    expect(res.metricsSummary.notLoadedOrError).toBe(1);
  });

  it('extracts Wave 1 header terms and row items cleanly via registry helpers', () => {
    expect(extractWave1HeaderTerm({ 'المورد': 'حسين' }, 'SupplierID')).toEqual({
      sourceKey: 'المورد',
      rawValue: 'حسين'
    });
    expect(extractRowItemQuery({ 'اسم المنتج': 'سن', 'الكمية': '١٠', 'السعر': '٥٠٠' })).toEqual({
      itemKey: 'اسم المنتج',
      rawTerm: 'سن',
      qty: 10,
      price: 500
    });
  });
});


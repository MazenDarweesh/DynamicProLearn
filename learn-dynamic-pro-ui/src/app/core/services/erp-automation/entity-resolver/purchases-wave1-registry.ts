import { ErpLookupFieldSpec } from '../../../models/erp-bridge.models';
import {
  convertEasternToWesternNumerals,
  normalizeArabicText
} from '../form-driver/arabic-normalizer';

export type PurchasesWave1HeaderField =
  | 'SupplierID'
  | 'StoreID'
  | 'CurrancyID'
  | 'POSetting';

export type PurchasesWave1FieldKey = PurchasesWave1HeaderField | 'ProductID';

/** Confirmed safe header execution sequence observed in Step 0 (`POSetting -> CurrancyID -> rest`). */
export const PURCHASES_SAFE_HEADER_ORDER: readonly PurchasesWave1HeaderField[] = [
  'POSetting',
  'CurrancyID',
  'SupplierID',
  'StoreID'
] as const;

/** Fixed static Wave 1 lookup table for Purchases (Page 289). Wave 2 fields are intentionally omitted. */
export const PURCHASES_WAVE1_LOOKUP_TABLE: Readonly<Record<PurchasesWave1FieldKey, ErpLookupFieldSpec>> = {
  SupplierID: {
    field: 'SupplierID',
    labelAr: 'المورد',
    scope: 'header',
    droModel: 'Supplier',
    valueKey: 'SID',
    textKey: 'SName'
  },
  StoreID: {
    field: 'StoreID',
    labelAr: 'المخزن',
    scope: 'header',
    droModel: 'Store',
    valueKey: 'SID',
    textKey: 'SName'
  },
  CurrancyID: {
    field: 'CurrancyID',
    labelAr: 'العملة',
    scope: 'header',
    droModel: 'Currancy',
    valueKey: 'CID',
    textKey: 'CName'
  },
  POSetting: {
    field: 'POSetting',
    labelAr: 'طريقة الشراء',
    scope: 'header',
    droModel: 'PurchaseSetting',
    valueKey: 'PSID',
    textKey: 'PSName'
  },
  ProductID: {
    field: 'ProductID',
    labelAr: 'الأصناف',
    scope: 'row',
    droModel: 'Product',
    valueKey: 'ProID',
    textKey: 'ProName'
  }
} as const;

const HEADER_FIELD_ALIASES: Readonly<Record<PurchasesWave1HeaderField, readonly string[]>> = {
  SupplierID: ['supplierid', 'المورد', 'مورد', 'vendorid'],
  StoreID: ['storeid', 'المخزن', 'مخزن'],
  CurrancyID: ['currancyid', 'currencyid', 'العمله', 'العملة', 'عمله الشراء', 'عملة الشراء'],
  POSetting: ['posetting', 'طريقه الشراء', 'طريقة الشراء', 'نوع الشراء', 'اعدادات الشراء']
};

/**
 * Small closed-set currency synonyms owned by the Wave 1 registry rather than the LLM Extractor:
 * the Extractor has no visibility into host `fetchLookupData('Currancy')` formatting (which may store
 * either ISO codes `'EGP'`/`'USD'` or Arabic labels `'جنيه مصري'`/`'دولار أمريكي'`).
 */
export const PURCHASES_CURRENCY_SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['egp', 'جنيه', 'جنيه مصري', 'مصري', 'جنية', 'جنية مصري', 'ج م'],
  ['usd', 'دولار', 'دولار امريكي', 'دولار أمريكي', 'us dollar']
] as const;

const ROW_ITEM_KEYS = [
  'اسم المنتج',
  'الصنف',
  'المنتج',
  'ProductID',
  'product',
  'Product',
  'ProductName',
  'ItemName',
  'Item'
] as const;

const ROW_QTY_KEYS = ['الكمية', 'الكميه', 'كمية', 'كميه', 'العدد', 'Qty', 'qty', 'Quntity', 'productQty', 'Quantity'] as const;
const ROW_PRICE_KEYS = ['السعر', 'سعر الوحدة', 'التكلفة', 'Price', 'UnitPrice', 'Cost', 'PriceCurrancy'] as const;

function stripForAliasLookup(key: string): string {
  return normalizeArabicText(key).replace(/[\s_-]+/g, ' ').trim();
}

/**
 * Resolves the extracted string/value for one Wave 1 header field from a payload `fields` object,
 * deduplicating Arabic label keys (e.g. `المورد`) with their canonical key (`SupplierID`).
 */
export function extractWave1HeaderTerm(
  fields: Record<string, unknown> | undefined,
  canonicalField: PurchasesWave1HeaderField
): { sourceKey: string; rawValue: string } | null {
  if (!fields || typeof fields !== 'object') return null;

  const direct = fields[canonicalField];
  if (direct != null && String(direct).trim() !== '') {
    return { sourceKey: canonicalField, rawValue: String(direct).trim() };
  }

  const aliases = HEADER_FIELD_ALIASES[canonicalField].map(stripForAliasLookup);
  for (const [k, v] of Object.entries(fields)) {
    if (v == null || String(v).trim() === '') continue;
    const cleanKey = stripForAliasLookup(k);
    if (aliases.includes(cleanKey)) {
      return { sourceKey: k, rawValue: String(v).trim() };
    }
  }

  return null;
}

/**
 * Checks whether an extracted field key corresponds to one of the Wave 1 header fields.
 */
export function mapKeyToWave1HeaderField(key: string): PurchasesWave1HeaderField | null {
  const cleanKey = stripForAliasLookup(key);
  for (const field of PURCHASES_SAFE_HEADER_ORDER) {
    if (HEADER_FIELD_ALIASES[field].map(stripForAliasLookup).includes(cleanKey)) {
      return field;
    }
  }
  return null;
}

/** Extracts raw item lookup query + optional numeric Qty and Price from an extracted row object. */
export function extractRowItemQuery(row: Record<string, unknown> | undefined): {
  itemKey: string | null;
  rawTerm: string;
  qty?: number;
  price?: number;
} {
  if (!row || typeof row !== 'object') {
    return { itemKey: null, rawTerm: '' };
  }

  let matchedKey: string | null = null;
  let rawTerm = '';

  for (const candidateKey of ROW_ITEM_KEYS) {
    if (Object.prototype.hasOwnProperty.call(row, candidateKey) && row[candidateKey] != null) {
      const valStr = String(row[candidateKey]).trim();
      if (valStr !== '') {
        matchedKey = candidateKey;
        rawTerm = valStr;
        break;
      }
    }
  }

  if (!matchedKey) {
    for (const [k, v] of Object.entries(row)) {
      if (v == null) continue;
      const clean = stripForAliasLookup(k);
      if (ROW_ITEM_KEYS.some((rk) => stripForAliasLookup(rk) === clean)) {
        const valStr = String(v).trim();
        if (valStr !== '') {
          matchedKey = k;
          rawTerm = valStr;
          break;
        }
      }
    }
  }

  const readNumber = (keys: readonly string[]): number | undefined => {
    for (const key of keys) {
      if (row[key] != null) {
        const converted = convertEasternToWesternNumerals(String(row[key])).replace(/,/g, '').trim();
        const num = Number(converted);
        if (converted !== '' && Number.isFinite(num)) return num;
      }
    }
    return undefined;
  };

  return {
    itemKey: matchedKey,
    rawTerm,
    qty: readNumber(ROW_QTY_KEYS),
    price: readNumber(ROW_PRICE_KEYS)
  };
}


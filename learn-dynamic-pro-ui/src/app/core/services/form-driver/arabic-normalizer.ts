/**
 * Arabic text normalization, synonym matching, and ERP field alias dictionary.
 */

/**
 * Normalizes Arabic text for flexible matching:
 * - Removes diacritics / tashkeel
 * - Unifies Alef shapes (أ, إ, آ -> ا)
 * - Unifies Taa Marbuta / Haa (ة -> ه)
 * - Unifies Yaa / Alef Maksura (ى -> ي)
 * - Trims and collapses multiple spaces
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Canonical ERP form field aliases (e.g. POSetting <-> طريقة الشراء, StoreID <-> المخزن).
 */
export const ERP_FIELD_ALIAS_MAP: Record<string, string[]> = {
  supplierid: ['supplier', 'vendor', 'المورد', 'مورد'],
  storeid: ['store', 'warehouse', 'المخزن', 'مخزن'],
  safeaccounid: [
    'safe',
    'cashbox',
    'treasury',
    'الخزينة',
    'خزينة',
    'الصندوق',
    'صندوق',
    'طريقة الدفع',
    'طريقة السداد',
  ],
  projectid: ['project', 'المشروع', 'مشروع', 'المشروعات', 'مشروعات'],
  posetting: [
    'posetting',
    'purchasesetting',
    'طريقة الشراء',
    'طريقةالشراء',
    'نوع الشراء',
    'اعدادات الشراء',
  ],
  costitemid: ['costitem', 'costcenter', 'مركز التكلفة', 'مركزالتكلفة'],
  cashpaid: [
    'paid',
    'cash',
    'paidamount',
    'netpaid',
    'المدفوع',
    'مدفوع',
    'المسدد',
    'مسدد',
    'المدفوع نقدا',
    'مدفوع نقدا',
    'نقدا',
  ],
};

/**
 * Resolves all candidate search keys for an input key including known aliases.
 */
export function resolveKeysToTry(cleanKey: string): string[] {
  const keysToTry = [cleanKey];
  const cleanLower = cleanKey.toLowerCase();

  for (const [canonical, aliases] of Object.entries(ERP_FIELD_ALIAS_MAP)) {
    if (
      cleanLower === canonical ||
      aliases.includes(cleanKey) ||
      aliases.includes(cleanLower)
    ) {
      if (!keysToTry.includes(canonical)) keysToTry.push(canonical);
      for (const al of aliases) {
        if (!keysToTry.includes(al)) keysToTry.push(al);
      }
    }
  }

  return keysToTry;
}

/**
 * Common column synonyms for items grid tables.
 */
export const GRID_COLUMN_SYNONYMS: string[][] = [
  ['اسمالمنتج', 'الصنف', 'المنتج', 'البيان', 'البند', 'item', 'product', 'itemname', 'productname'],
  ['الكمية', 'العدد', 'كمية', 'qty', 'quantity', 'count'],
  ['السعر', 'التكلفة', 'سعرالشراء', 'سعرالوحدة', 'سعر', 'تكلفة', 'price', 'cost', 'unitprice', 'purchasingprice'],
  ['الوحدة', 'وحدةالقياس', 'وحدة', 'unit'],
  ['الملاحظات', 'ملاحظات', 'بيان', 'notes', 'remarks'],
  ['الاجمالي', 'اجمالي', 'القيمة', 'total', 'amount'],
];

/**
 * Matches a grid column header text with a target key using Arabic normalization and synonym groups.
 */
export function matchesColKey(headerText: string, key: string): boolean {
  const normHeader = normalizeArabicText(headerText).replace(/\s+/g, '');
  const normKey = normalizeArabicText(key).replace(/\s+/g, '');

  if (normHeader.includes(normKey) || normKey.includes(normHeader)) return true;

  for (const group of GRID_COLUMN_SYNONYMS) {
    const keyInGroup = group.some((g) => normKey.includes(g) || g.includes(normKey));
    if (keyInGroup) {
      const headerInGroup = group.some((g) => normHeader.includes(g) || g.includes(normHeader));
      if (headerInGroup) return true;
    }
  }

  return false;
}

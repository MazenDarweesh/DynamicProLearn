export interface ErpScreen {
  key: string;
  name: string;
  category: string;
  description: string;
  sampleQuery: string;
}

export const MOCK_ERP_SCREENS: ErpScreen[] = [
  {
    key: 'SALES_INVOICE',
    name: 'فاتورة المبيعات',
    category: 'المبيعات والعملاء',
    description:
      'شاشة إصدار فواتير المبيعات للعملاء وتحديد طريقة الدفع ومخزن الصرف والأصناف المباعة واحتساب ضريبة القيمة المضافة.',
    sampleQuery:
      'عايز اسجل فاتورة مبيعات للعميل شركة النيل للتجارة قطاع جملة صنف شاشات حاسوب كمية 5 بسعر 8500 والدفع نقداً',
  },
  {
    key: 'NEW_CUSTOMER',
    name: 'تسجيل عميل جديد',
    category: 'العملاء والحسابات',
    description:
      'شاشة فتح بطاقة عميل جديد في الـ ERP وتسجيل بيانات الاتصال والتصنيف والحد الائتماني والبيانات الضريبية.',
    sampleQuery:
      'سجل لي عميل جديد باسم شركة الأمل الدولية وتليفونه 01122334455 وعنوانه المعادي ومبلغ الحد الائتماني 150000 وتصنيف جملة',
  },
  {
    key: 'PURCHASE_INVOICE',
    name: 'فاتورة المشتريات',
    category: 'المخازن والمشتريات',
    description:
      'شاشة تسجيل أوامر التوريد وفواتير المشتريات وتوريد الأصناف وإثبات السداد وسحب الحقول التابعة تلقائياً.',
    sampleQuery:
      'سجل لي فاتورة مشتريات من المورد شركة التوحيد خامات المنتج كابلات شبكة CAT6 الكمية 10 وسعر 150 نقدي',
  },
  {
    key: 'JOURNAL_ENTRY',
    name: 'قيود اليومية العامة',
    category: 'الحسابات العامة',
    description:
      'شاشة تسجيل قيود اليومية المحاسبية المزدوجة والتوجيه المحاسبي لمراكز التكلفة والتأكد من توازن القيد.',
    sampleQuery:
      'سجل لي قيد يومية صرف مرتبات بقيمة 5000 جنيه من حساب الصندوق الرئيسي إلى حساب الرواتب والأجور',
  },
  {
    key: 'INVENTORY_AUDIT',
    name: 'الجرد والتسويات المخزنية',
    category: 'إدارة المستودعات',
    description:
      'شاشة الجرد الفعلي للمخزون وتسجيل الرصيد الفعلي وحساب العجز أو الزيادة والتسوية الجردية آلياً.',
    sampleQuery:
      'عايز اعمل محضر جرد لمخزن القاهرة نوع التسوية تسوية جردية لصنف شاشات حاسوب الرصيد الفعلي 8',
  },
  {
    key: 'EMPLOYEES',
    name: 'الموظفين',
    category: 'شئون الموظفين',
    description: 'شاشة إدارة ملفات وبيانات الموظفين والرواتب والأقسام والتكويدات العامة في النظام.',
    sampleQuery: 'عايز اضيف موظف جديد باسم احمد علي في قسم المبيعات براتب 8000 جنيه',
  },
];

export const MOCK_ERP_MODULES: string[] = [
  'الجميع',
  'العملاء و المبيعات',
  'الموردين و المشتريات',
  'المخازن',
  'الحسابات العامه',
  'شئون الموظفين',
];

export const MOCK_FILTER_CHIPS: string[] = ['الجميع', 'الحركات', 'التكويدات', 'التقارير'];

export const MOCK_MODULE_SCREEN_MAP: Record<string, string[]> = {
  'العملاء و المبيعات': ['SALES_INVOICE', 'NEW_CUSTOMER'],
  'الموردين و المشتريات': ['PURCHASE_INVOICE'],
  المخازن: ['INVENTORY_AUDIT'],
  'الحسابات العامه': ['JOURNAL_ENTRY'],
  'شئون الموظفين': ['EMPLOYEES'],
};

export const MOCK_DEV_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlcnAtbW9jay1hZG1pbiIsIm5hbWUiOiJcdTA2NDVcdTA2MjdcdTA2MzJcdTA2NDYgXHUwNjJmXHUwNjMxXHUwNjQ4XHUwNjRhXHUwNjM0Iiwicm9sZSI6IkFkbWluIiwidGVuYW50X2lkIjoidGVuYW50LXRlc3QiLCJkZXBhcnRtZW50X2lkIjoiZGVwdC10ZXN0IiwiaXNzIjoiRHluYW1pY1Byb0xlYXJuIiwiYXVkIjoiRHluYW1pY1Byb0xlYXJuQ2xpZW50IiwiZXhwIjoxODIyOTE0ODc2fQ.t7-b2keNiYiFEuzB5QYqrNNzmYTyIDjAFdVM_s3C3DQ';


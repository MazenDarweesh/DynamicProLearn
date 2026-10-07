# عينات الـ DOM الحقيقية لنظام DynamicPro ERP

هذا الملف يحتوي على عينات فعلية مستخرجة من صفحات النظام (مثل شاشة فاتورة المشتريات / الموردين) لاستخدامها في بناء وتثبيت الاختبارات الوهمية (Fixtures) واختبار محددات الـ Driver.

---

## 1. نموذج حقل المورد والحقول التابعة (المكتشف في 2026-10-07)

### الوصف:
- الحقل الأساسي: `<label>المورد</label>` متبوع بمكون مخصص `<eg-select>` يغلف مكتبة `@ng-select/ng-select`.
- السلوك:
  - البحث يتم عبر `<input role="combobox">`.
  - القائمة المنسدلة تستخدم `appendto="body"` فتظهر في نهاية الـ `<body>` كعنصر `<ng-dropdown-panel>`.
  - عند اختيار المورد، يقوم Angular تلقائياً بملء الحقول التابعة الأربعة (`SupplierName`, `address`, `phone`, `TaxFile`) لأنها معطلة (`disabled=""`).
  - يوجد زر جانبي "جديد" (`btn-outline-primary`) لإضافة مورد جديد.

### كود الـ HTML الحقيقي:
```html
<div _ngcontent-sim-c494="" class="row form-group border rounded p-4 ng-star-inserted" style="background-color: #f2f3f86b;">
  <div _ngcontent-sim-c494="" class="col-12">
    <div _ngcontent-sim-c494="" class="row form-group">
      <label _ngcontent-sim-c494="" class="col-2">المورد</label>
      <eg-select _ngcontent-sim-c494="" name="c.ColumnName" class="col-8 ng-untouched ng-pristine ng-valid" _nghost-sim-c576="">
        <ng-select _ngcontent-sim-c576="" role="listbox" appendto="body" class="col-8 ng-select ng-select-single ng-select-searchable ng-select-clearable ng-select-typeahead ng-pristine ng-valid ng-star-inserted ng-select-bottom ng-touched ng-select-focused ng-select-opened" id="undefined">
          <div class="ng-select-container">
            <div class="ng-value-container">
              <div class="ng-placeholder"></div>
              <div class="ng-input">
                <input role="combobox" type="text" autocorrect="off" autocapitalize="off" autocomplete="a52323f4a17a" aria-expanded="true" aria-owns="a52323f4a17a" aria-activedescendant="a52323f4a17a-0">
              </div>
            </div>
            <span class="ng-arrow-wrapper"><span class="ng-arrow"></span></span>
          </div>
        </ng-select>
      </eg-select>
      <div _ngcontent-sim-c494="" class="col-2">
        <button _ngcontent-sim-c494="" class="btn btn-outline-primary">جديد</button>
      </div>
    </div>
  </div>
  <div _ngcontent-sim-c494="" class="col-12">
    <div _ngcontent-sim-c494="" class="form-group row">
      <label _ngcontent-sim-c494="" class="col-2">الاسم</label>
      <input _ngcontent-sim-c494="" name="'SupplierName'" type="text" class="form-control col-10 ng-untouched ng-pristine" disabled="">
    </div>
    <div _ngcontent-sim-c494="" class="form-group row">
      <label _ngcontent-sim-c494="" class="col-2">العنوان</label>
      <input _ngcontent-sim-c494="" name="'address'" type="text" class="form-control col-10 ng-untouched ng-pristine" disabled="">
    </div>
    <div _ngcontent-sim-c494="" class="form-group row">
      <label _ngcontent-sim-c494="" class="col-2">رقم الهاتف</label>
      <input _ngcontent-sim-c494="" type="'text'" name="phone" class="form-control col-10 ng-untouched ng-pristine" disabled="">
    </div>
    <div _ngcontent-sim-c494="" class="form-group row">
      <label _ngcontent-sim-c494="" class="col-2">الملف الضريبى</label>
      <input _ngcontent-sim-c494="" type="'text'" name="TaxFile" class="form-control col-10 ng-untouched ng-pristine" disabled="">
    </div>
  </div>
</div>
```

### كود القائمة المنسدلة بعد الاختيار (المكتشف من عينة سابقة):
```html
<div class="ng-select-container ng-has-value">
  <div class="ng-value-container">
    <div class="ng-value ng-star-inserted">
      <span aria-hidden="true" class="ng-value-icon left ng-star-inserted">×</span>
      <span class="ng-value-label ng-star-inserted">شركة التوحيد خامات</span>
    </div>
    <div class="ng-input">
      <input role="combobox" type="text" autocorrect="off" autocapitalize="off" autocomplete="..." aria-expanded="false">
    </div>
  </div>
  <span class="ng-arrow-wrapper"><span class="ng-arrow"></span></span>
</div>
```

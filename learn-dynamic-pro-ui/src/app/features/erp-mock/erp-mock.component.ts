import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { CopilotService } from '../../core/services/copilot.service';

interface ErpScreen {
  key: string;
  name: string;
  category: string;
  description: string;
  sampleQuery: string;
}

@Component({
  selector: 'app-erp-mock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="erp-container" dir="rtl">
      <!-- ── ERP Header Bar ─────────────────────────────────────────────── -->
      <header class="erp-header">
        <div class="erp-brand">
          <div class="erp-logo">🏢</div>
          <div>
            <h1 class="erp-title">DynamicPro ERP Enterprise</h1>
            <span class="erp-subtitle">محاكي نظام تخطيط الموارد المؤسسية (بيئة الاختبار والتكامل الحية)</span>
          </div>
        </div>

        <!-- ── Live Open Tabs (.dp-hdr__tab) ────────────────────────── -->
        <div class="dp-hdr__tabs-strip" *ngIf="openTabs.length > 0">
          <div *ngFor="let s of openTabs"
               class="dp-hdr__tab"
               [class.is-active]="activeScreen.key === s.key"
               [attr.data-screen]="s.key"
               (click)="switchScreen(s)">
            <button type="button" class="dp-hdr__tab-open">
              <span class="dp-hdr__tab-name">{{ s.name }}</span>
            </button>
            <span class="dp-hdr__tab-close" (click)="$event.stopPropagation(); closeTab(s)">×</span>
          </div>
        </div>

        <div class="erp-user-badge">
          <div class="user-avatar">👤</div>
          <div class="user-details">
            <span class="user-name">{{ authService.userName() || 'مازن درويش' }}</span>
            <span class="user-dept">إدارة الحسابات والمخازن</span>
          </div>
          <div class="conn-status" [class.connected]="authService.isAuthenticated()">
            {{ authService.isAuthenticated() ? '🟢 متصل بالـ LMS' : '🟡 جلسة تجريبية' }}
          </div>
        </div>
      </header>

      <!-- ── DynamicPro Real ERP Navigation Bar ──────────────────────── -->
      <nav class="erp-nav-bar dp-menu-container">
        <!-- 1. ERP Modules (.dp-pgs__mod) -->
        <div class="dp-nav-section">
          <div class="nav-headline">
            <span class="nav-icon">📦</span>
            <span>وحدات الـ ERP الرئيسية (الموديولات):</span>
          </div>
          <div class="dp-modules-bar">
            <button *ngFor="let mod of erpModules"
                    type="button"
                    class="dp-pgs__mod"
                    [class.is-active]="activeModule === mod"
                    (click)="selectModule(mod)">
              <span class="dp-pgs__mod-name">{{ mod }}</span>
            </button>
          </div>
        </div>

        <!-- 2. Categories / Filter Chips (.dp-cats__chip) -->
        <div class="dp-nav-section">
          <div class="dp-cats-bar">
            <button *ngFor="let cat of filterChips"
                    type="button"
                    class="dp-cats__chip"
                    [class.is-on]="activeChip === cat"
                    (click)="activeChip = cat">
              <span class="dp-cats__txt">{{ cat }}</span>
            </button>
          </div>
        </div>

        <!-- 3. Screen Tiles (.dp-pgs__tile) -->
        <div class="dp-nav-section">
          <div class="nav-headline">
            <span class="nav-icon">🧭</span>
            <span>الشاشات والبرامج المتاحة (انقر أو اطلب من الكوبيلوت التنقل والملء آلياً):</span>
          </div>
          <div class="screen-tabs dp-tiles-grid">
            <div *ngFor="let s of getScreensForActiveModule()" class="dp-pgs__cell">
              <button type="button"
                      class="dp-pgs__tile screen-btn"
                      [attr.data-screen]="s.key"
                      [class.active]="activeScreen.key === s.key"
                      (click)="switchScreen(s)">
                <span class="screen-badge">{{ s.category }}</span>
                <span class="dp-pgs__tile-name screen-label">{{ s.name }}</span>
                <code class="screen-code">[{{ s.key }}]</code>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <!-- ── Main ERP Workspace ─────────────────────────────────────────── -->
      <main class="erp-workspace">
        <!-- ── Right Column: Simulated ERP Screen ───────────────────────── -->
        <div class="erp-main-col">
          <!-- ERP Active Form Card -->
          <div class="erp-card">
            <div class="card-header">
              <div class="header-left">
                <h2>{{ activeScreen.name }}</h2>
                <span class="screen-tag">ERP Key: <code>{{ activeScreen.key }}</code></span>
              </div>
              <div class="header-actions">
                <button type="button" class="btn-erp btn-outline dp-btn--new" data-action="new" title="تفريغ النموذج الحالي" (click)="clearCurrentScreenForm()">✨ جديد / تفريغ</button>
                <button class="btn-erp btn-primary">💾 حفظ</button>
                <button class="btn-erp btn-secondary">🖨️ طباعة</button>
                <button class="btn-erp btn-outline">↺ تراجع</button>
              </div>
            </div>

            <div class="card-body">
              <p class="screen-desc">{{ activeScreen.description }}</p>

              <!-- 1. Simulated New Customer Form -->
              <div *ngIf="activeScreen.key === 'NEW_CUSTOMER'" class="erp-form-grid" data-screen-content="NEW_CUSTOMER">
                <div class="form-group">
                  <label>كود العميل:</label>
                  <input type="text" name="CustomerCode" id="CustomerCode" class="erp-input" value="CUST-2026-0188" readonly />
                </div>
                <div class="form-group">
                  <label>اسم العميل / الشركة:</label>
                  <input type="text" name="CustomerName" id="CustomerName" class="erp-input" placeholder="اكتب اسم العميل أو دعه يتعبأ آلياً..." />
                </div>
                <div class="form-group">
                  <label>تصنيف / فئة العميل:</label>
                  <select name="CustomerCategory" id="CustomerCategory" class="erp-input">
                    <option value="">-- اختر التصنيف --</option>
                    <option value="قطاع جملة">قطاع جملة (خصم خاص)</option>
                    <option value="نصف جملة">نصف جملة</option>
                    <option value="تجزئة">تجزئة / أفراد</option>
                    <option value="كبار عملاء VIP">كبار عملاء VIP</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>رقم الهاتف / الموبايل:</label>
                  <input type="text" name="Phone" id="Phone" class="erp-input" placeholder="010..." />
                </div>
                <div class="form-group">
                  <label>البريد الإلكتروني:</label>
                  <input type="email" name="Email" id="CustomerEmail" class="erp-input" placeholder="info@company.com" />
                </div>
                <div class="form-group">
                  <label>العنوان / المقر:</label>
                  <input type="text" name="Address" id="Address" class="erp-input" placeholder="المدينة، الحي، الشارع..." />
                </div>
                <div class="form-group">
                  <label>السجل التجاري:</label>
                  <input type="text" name="CommercialReg" id="CommercialReg" class="erp-input" placeholder="CR-99201" />
                </div>
                <div class="form-group">
                  <label>البطاقة الضريبية:</label>
                  <input type="text" name="TaxId" id="CustomerTaxId" class="erp-input" placeholder="TAX-7721-00" />
                </div>
                <div class="form-group">
                  <label>الحد الائتماني (ج.م):</label>
                  <input type="number" name="CreditLimit" id="CreditLimit" class="erp-input" placeholder="مثال: 150000" />
                </div>
                <div class="form-group">
                  <label>فترة السداد المسموحة:</label>
                  <select name="PaymentTerms" id="CustomerPaymentTerms" class="erp-input">
                    <option value="نقدي فوري">نقدي فوري</option>
                    <option value="آجل 30 يوم">آجل 30 يوم</option>
                    <option value="آجل 60 يوم">آجل 60 يوم</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>المندوب المسؤول:</label>
                  <select name="SalesRep" id="CustomerSalesRep" class="erp-input">
                    <option value="أحمد مصطفى">أحمد مصطفى (القاهرة)</option>
                    <option value="محمود حسني">محمود حسني (الجيزة والإسكندرية)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>حالة الحساب:</label>
                  <select name="Status" id="CustomerStatus" class="erp-input">
                    <option value="نشط">نشط (معتمد للتعامل)</option>
                    <option value="معلق">قيد المراجعة الائتمانية</option>
                  </select>
                </div>
              </div>

              <!-- 2. Simulated Purchase Invoice Form (DynamicPro Real Schema) -->
              <div *ngIf="activeScreen.key === 'PURCHASE_INVOICE'" class="erp-form-grid" data-screen-content="PURCHASE_INVOICE">
                <div class="form-group">
                  <label>المورد:</label>
                  <select name="Supplier" id="Supplier" class="erp-input" (change)="onMockSupplierChange($event)">
                    <option value="">-- اختر المورد --</option>
                    <option value="شركة التوحيد خامات">شركة التوحيد خامات</option>
                    <option value="شركة الحمد للتجارة">شركة الحمد للتجارة</option>
                    <option value="مؤسسة النور توريدات">مؤسسة النور توريدات</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>طريقة الشراء:</label>
                  <select name="PurchaseMethod" id="PurchaseMethod" class="erp-input">
                    <option value="مباشرة">مباشرة (شراء فوري)</option>
                    <option value="آجل">آجل (فترة سماح)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>المخزن المستلم:</label>
                  <select name="Warehouse" id="Warehouse" class="erp-input">
                    <option value="القاهرة">مخزن القاهرة الرئيسي</option>
                    <option value="الإسكندرية">مخزن الإسكندرية</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>تاريخ الفاتورة:</label>
                  <input type="date" name="Date" id="Date" class="erp-input" value="2026-10-07" />
                </div>
                <!-- 4 Dependent Fields Auto-Filled upon Supplier Selection -->
                <div class="form-group">
                  <label>اسم المورد الرسمي:</label>
                  <input type="text" name="'SupplierName'" id="SupplierName" class="erp-input" [value]="mockSupplierDetails.name" disabled />
                </div>
                <div class="form-group">
                  <label>العنوان:</label>
                  <input type="text" name="'address'" id="SupplierAddress" class="erp-input" [value]="mockSupplierDetails.address" disabled />
                </div>
                <div class="form-group">
                  <label>رقم الهاتف:</label>
                  <input type="text" name="phone" id="SupplierPhone" class="erp-input" [value]="mockSupplierDetails.phone" disabled />
                </div>
                <div class="form-group">
                  <label>الملف الضريبي:</label>
                  <input type="text" name="TaxFile" id="SupplierTax" class="erp-input" [value]="mockSupplierDetails.taxFile" disabled />
                </div>
              </div>

              <!-- 3. Simulated Sales Invoice Form -->
              <div *ngIf="activeScreen.key === 'SALES_INVOICE'" class="erp-form-grid" data-screen-content="SALES_INVOICE">
                <div class="form-group">
                  <label>رقم فاتورة المبيعات:</label>
                  <input type="text" name="InvoiceNumber" id="InvoiceNumber" class="erp-input" value="INV-2026-0922" readonly />
                </div>
                <div class="form-group">
                  <label>الطرف / العميل:</label>
                  <input type="text" name="CustomerName" id="CustomerName" class="erp-input" placeholder="اسم العميل..." />
                </div>
                <div class="form-group">
                  <label>تصنيف العميل:</label>
                  <select name="CustomerCategory" id="SalesCustomerCategory" class="erp-input">
                    <option value="">-- اختر التصنيف --</option>
                    <option value="قطاع جملة">قطاع جملة (أسعار الموزعين)</option>
                    <option value="نصف جملة">نصف جملة</option>
                    <option value="قطاعي">تجزئة / قطاعي</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>مخزن الصرف:</label>
                  <select name="Warehouse" id="SalesWarehouse" class="erp-input">
                    <option value="القاهرة">مخزن القاهرة الرئيسي</option>
                    <option value="الإسكندرية">مخزن الإسكندرية</option>
                    <option value="العاشر">مخزن العاشر من رمضان</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>تاريخ الفاتورة:</label>
                  <input type="date" name="DocDate" id="DocDate" class="erp-input" value="2026-10-11" />
                </div>
                <div class="form-group">
                  <label>طريقة الدفع:</label>
                  <select name="PaymentMethod" id="PaymentMethod" class="erp-input">
                    <option value="">-- اختر طريقة الدفع --</option>
                    <option value="نقداً">نقداً (الخزينة الرئيسية)</option>
                    <option value="آجل">آجل (استحقاق 30 يوم)</option>
                    <option value="تحويل بنكي">تحويل بنكي</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>مندوب المبيعات:</label>
                  <select name="SalesRep" id="SalesInvoiceRep" class="erp-input">
                    <option value="أحمد مصطفى">أحمد مصطفى</option>
                    <option value="محمود حسني">محمود حسني</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>مركز التكلفة:</label>
                  <select name="CostCenter" id="SalesCostCenter" class="erp-input">
                    <option value="إدارة المبيعات">إدارة المبيعات المركزية</option>
                    <option value="فرع القاهرة">فرع القاهرة</option>
                  </select>
                </div>
              </div>

              <!-- 4. Simulated Journal Entry Form -->
              <div *ngIf="activeScreen.key === 'JOURNAL_ENTRY'" class="erp-form-grid" data-screen-content="JOURNAL_ENTRY">
                <div class="form-group">
                  <label>رقم القيد المحاسبي:</label>
                  <input type="text" name="EntryNumber" id="EntryNumber" class="erp-input" value="JV-2026-0104" readonly />
                </div>
                <div class="form-group">
                  <label>تاريخ القيد:</label>
                  <input type="date" name="Date" id="EntryDate" class="erp-input" value="2026-10-11" />
                </div>
                <div class="form-group">
                  <label>نوع القيد:</label>
                  <select name="EntryType" id="EntryType" class="erp-input">
                    <option value="يومية عامة">يومية عامة</option>
                    <option value="تسوية">تسوية جردية / مالية</option>
                    <option value="رواتب وأجور">قيود رواتب وأجور</option>
                    <option value="إقفال">قيد إقفال</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>الفترة المالية:</label>
                  <input type="text" name="FiscalPeriod" id="FiscalPeriod" class="erp-input" value="2026 - الربع الرابع" readonly />
                </div>
                <div class="form-group">
                  <label>رقم المستند المرجعي:</label>
                  <input type="text" name="RefNumber" id="RefNumber" class="erp-input" placeholder="مثال: إذن صرف 402" />
                </div>
                <div class="form-group">
                  <label>العملة:</label>
                  <select name="Currency" id="EntryCurrency" class="erp-input">
                    <option value="EGP">جنيه مصري (EGP)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                  <label>البيان العام للقيد:</label>
                  <input type="text" name="Description" id="EntryDescription" class="erp-input" placeholder="شرح المعاملة أو القيد المحاسبي..." />
                </div>
              </div>

              <!-- 5. Simulated Inventory Audit Form -->
              <div *ngIf="activeScreen.key === 'INVENTORY_AUDIT'" class="erp-form-grid" data-screen-content="INVENTORY_AUDIT">
                <div class="form-group">
                  <label>رقم محضر الجرد:</label>
                  <input type="text" name="AuditNumber" id="AuditNumber" class="erp-input" value="AUD-2026-0042" readonly />
                </div>
                <div class="form-group">
                  <label>المخزن المستهدف:</label>
                  <select name="Warehouse" id="AuditWarehouse" class="erp-input">
                    <option value="">-- اختر المخزن --</option>
                    <option value="القاهرة">مخزن القاهرة الرئيسي</option>
                    <option value="الإسكندرية">مخزن الإسكندرية</option>
                    <option value="العاشر">مخزن العاشر من رمضان</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>تاريخ الجرد:</label>
                  <input type="date" name="AuditDate" id="AuditDate" class="erp-input" value="2026-10-11" />
                </div>
                <div class="form-group">
                  <label>نوع التسوية:</label>
                  <select name="AdjustmentType" id="AdjustmentType" class="erp-input">
                    <option value="تسوية جردية">تسوية جردية دورية</option>
                    <option value="عجز مخزني">إثبات عجز مخزني</option>
                    <option value="زيادة مخزنية">إثبات زيادة مخزنية</option>
                    <option value="تالف">إثبات بضاعة تالفة</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>رئيس لجنة الجرد:</label>
                  <input type="text" name="AuditorName" id="AuditorName" class="erp-input" value="م. تامر ممدوح (مدير المخازن)" />
                </div>
                <div class="form-group">
                  <label>حالة الاعتماد:</label>
                  <select name="AuditStatus" id="AuditStatus" class="erp-input">
                    <option value="مسودة">مسودة (قيد الفحص)</option>
                    <option value="معتمد">معتمد للتسوية</option>
                  </select>
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                  <label>ملاحظات محضر الجرد:</label>
                  <input type="text" name="AuditNotes" id="AuditNotes" class="erp-input" placeholder="ملاحظات وتوصيات لجنة الجرد..." />
                </div>
              </div>

              <!-- ── Dedicated Tables per Active Screen ─────────────────────────── -->

              <!-- 1. Purchase Invoice Table -->
              <div class="erp-table-box" *ngIf="activeScreen.key === 'PURCHASE_INVOICE'">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <strong style="font-size:13px;">📦 جدول الأصناف الموردة:</strong>
                  <button type="button" class="btn-erp btn-primary" (click)="addMockRow()">+ إضافة سطر صنف</button>
                </div>
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الصنف</th>
                      <th>الكمية</th>
                      <th>التكلفة</th>
                      <th>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of mockRows; let rIdx = index">
                      <td>{{ rIdx + 1 }}</td>
                      <td><input type="text" name="ItemName" [(ngModel)]="row.itemName" class="erp-input" style="padding:4px;" placeholder="اسم الصنف..." /></td>
                      <td><input type="number" name="Quantity" [(ngModel)]="row.quantity" (input)="calcMockTotals()" class="erp-input" style="padding:4px; width:80px;" /></td>
                      <td><input type="number" name="Cost" [(ngModel)]="row.cost" (input)="calcMockTotals()" class="erp-input" style="padding:4px; width:90px;" /></td>
                      <td><strong>{{ (row.quantity * row.cost) | number }} ج.م</strong></td>
                    </tr>
                  </tbody>
                </table>

                <div style="display:flex; justify-content:flex-end; gap:20px; margin-top:12px; padding:10px; background:#f8fafc; border-radius:6px;">
                  <div>
                    <label style="font-size:12px; color:#64748b; font-weight:600;">إجمالي الفاتورة:</label>
                    <input type="text" name="TotalAmount" id="TotalAmount" class="erp-input" [value]="mockTotalAmount" readonly style="width:120px; font-weight:700;" />
                  </div>
                  <div>
                    <label style="font-size:12px; color:#1e40af; font-weight:600;">المدفوع نقداً:</label>
                    <input type="text" name="CashPaid" id="CashPaid" class="erp-input" placeholder="0" style="width:120px; border-color:#3b82f6;" />
                  </div>
                </div>
              </div>

              <!-- 2. Sales Invoice Table -->
              <div class="erp-table-box" *ngIf="activeScreen.key === 'SALES_INVOICE'">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <strong style="font-size:13px;">🧾 جدول أصناف المبيعات والأسعار:</strong>
                  <button type="button" class="btn-erp btn-primary" (click)="addSalesRow()">+ إضافة سطر مبيعات</button>
                </div>
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>اسم الصنف</th>
                      <th>الوحدة</th>
                      <th>الكمية</th>
                      <th>سعر البيع</th>
                      <th>الخصم</th>
                      <th>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of mockSalesRows; let rIdx = index">
                      <td>{{ rIdx + 1 }}</td>
                      <td><input type="text" name="ItemName" [(ngModel)]="row.itemName" class="erp-input" style="padding:4px;" placeholder="اسم الصنف..." /></td>
                      <td><input type="text" name="Unit" [(ngModel)]="row.unit" class="erp-input" style="padding:4px; width:70px;" /></td>
                      <td><input type="number" name="Quantity" [(ngModel)]="row.quantity" (input)="calcSalesTotals()" class="erp-input" style="padding:4px; width:75px;" /></td>
                      <td><input type="number" name="Price" [(ngModel)]="row.price" (input)="calcSalesTotals()" class="erp-input" style="padding:4px; width:90px;" /></td>
                      <td><input type="number" name="Discount" [(ngModel)]="row.discount" (input)="calcSalesTotals()" class="erp-input" style="padding:4px; width:70px;" /></td>
                      <td><strong>{{ (((row.quantity * row.price) - (row.discount || 0)) | number) }} ج.م</strong></td>
                    </tr>
                  </tbody>
                </table>

                <div style="display:flex; justify-content:flex-end; gap:16px; margin-top:12px; padding:10px; background:#f8fafc; border-radius:6px; flex-wrap:wrap;">
                  <div>
                    <label style="font-size:11px; color:#64748b; font-weight:600;">قبل الضريبة:</label>
                    <input type="text" name="SubTotal" [value]="salesSubTotal | number" readonly class="erp-input" style="width:100px; font-weight:600;" />
                  </div>
                  <div>
                    <label style="font-size:11px; color:#64748b; font-weight:600;">ضريبة VAT (14%):</label>
                    <input type="text" name="TaxAmount" [value]="salesTax | number" readonly class="erp-input" style="width:90px; color:#dc2626; font-weight:600;" />
                  </div>
                  <div>
                    <label style="font-size:11px; color:#1e40af; font-weight:600;">الإجمالي الصافي:</label>
                    <input type="text" name="TotalAmount" id="SalesTotalAmount" [value]="salesTotal | number" readonly class="erp-input" style="width:110px; font-weight:700; color:#1e40af;" />
                  </div>
                  <div>
                    <label style="font-size:11px; color:#059669; font-weight:600;">المسدد نقداً:</label>
                    <input type="number" name="PaidAmount" [(ngModel)]="salesPaid" (input)="calcSalesTotals()" class="erp-input" style="width:100px; border-color:#059669;" />
                  </div>
                  <div>
                    <label style="font-size:11px; color:#d97706; font-weight:600;">المتبقي آجل:</label>
                    <input type="text" name="RemainingAmount" [value]="salesRemaining | number" readonly class="erp-input" style="width:100px; font-weight:600; color:#d97706;" />
                  </div>
                </div>
              </div>

              <!-- 3. New Customer Branches Table -->
              <div class="erp-table-box" *ngIf="activeScreen.key === 'NEW_CUSTOMER'">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <strong style="font-size:13px;">🏢 فروع ومواقع العميل:</strong>
                  <button type="button" class="btn-erp btn-primary" (click)="addCustomerBranch()">+ إضافة فرع / موقع</button>
                </div>
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>اسم الفرع / الموقع</th>
                      <th>مسؤول الاتصال</th>
                      <th>رقم الهاتف</th>
                      <th>المدينة / العنوان</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let b of mockCustomerBranches; let bIdx = index">
                      <td>{{ bIdx + 1 }}</td>
                      <td><input type="text" name="BranchName" [(ngModel)]="b.branchName" class="erp-input" style="padding:4px;" placeholder="المقر..." /></td>
                      <td><input type="text" name="ContactPerson" [(ngModel)]="b.contactPerson" class="erp-input" style="padding:4px;" placeholder="اسم المسؤول..." /></td>
                      <td><input type="text" name="BranchPhone" [(ngModel)]="b.phone" class="erp-input" style="padding:4px;" placeholder="010..." /></td>
                      <td><input type="text" name="BranchCity" [(ngModel)]="b.city" class="erp-input" style="padding:4px;" placeholder="العنوان..." /></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- 4. Journal Entry Rows Table -->
              <div class="erp-table-box" *ngIf="activeScreen.key === 'JOURNAL_ENTRY'">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <strong style="font-size:13px;">📑 أطراف القيد المحاسبي المزدوج:</strong>
                  <button type="button" class="btn-erp btn-primary" (click)="addJournalRow()">+ إضافة طرف قيد</button>
                </div>
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>كود الحساب</th>
                      <th>اسم الحساب المحاسبي</th>
                      <th>مركز التكلفة</th>
                      <th>مدين (ج.م)</th>
                      <th>دائن (ج.م)</th>
                      <th>البيان التحليلي</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of mockJournalRows; let rIdx = index">
                      <td>{{ rIdx + 1 }}</td>
                      <td><input type="text" name="AccountCode" [(ngModel)]="row.accountCode" class="erp-input" style="padding:4px; width:80px;" placeholder="10101" /></td>
                      <td><input type="text" name="AccountName" [(ngModel)]="row.accountName" class="erp-input" style="padding:4px;" placeholder="اسم الحساب..." /></td>
                      <td><input type="text" name="CostCenter" [(ngModel)]="row.costCenter" class="erp-input" style="padding:4px;" placeholder="مركز التكلفة..." /></td>
                      <td><input type="number" name="Debit" [(ngModel)]="row.debit" (input)="calcJournalTotals()" class="erp-input" style="padding:4px; width:90px; color:#1e40af; font-weight:600;" /></td>
                      <td><input type="number" name="Credit" [(ngModel)]="row.credit" (input)="calcJournalTotals()" class="erp-input" style="padding:4px; width:90px; color:#059669; font-weight:600;" /></td>
                      <td><input type="text" name="LineNotes" [(ngModel)]="row.lineNotes" class="erp-input" style="padding:4px;" placeholder="شرح..." /></td>
                    </tr>
                  </tbody>
                </table>

                <div style="display:flex; justify-content:flex-end; gap:20px; align-items:center; margin-top:12px; padding:10px; background:#f8fafc; border-radius:6px; flex-wrap:wrap;">
                  <div>
                    <label style="font-size:12px; color:#1e40af; font-weight:600;">إجمالي المدين:</label>
                    <input type="text" name="TotalDebit" [value]="journalTotalDebit | number" readonly class="erp-input" style="width:110px; font-weight:700; color:#1e40af;" />
                  </div>
                  <div>
                    <label style="font-size:12px; color:#059669; font-weight:600;">إجمالي الدائن:</label>
                    <input type="text" name="TotalCredit" [value]="journalTotalCredit | number" readonly class="erp-input" style="width:110px; font-weight:700; color:#059669;" />
                  </div>
                  <div style="padding:6px 12px; border-radius:6px; font-size:12px; font-weight:700;"
                       [style.background]="journalTotalDebit === journalTotalCredit ? '#dcfce7' : '#fee2e2'"
                       [style.color]="journalTotalDebit === journalTotalCredit ? '#15803d' : '#b91c1c'">
                    {{ journalTotalDebit === journalTotalCredit ? '🟢 القيد متزن ومطابق' : '🔴 القيد غير متزن (الفرق: ' + ((journalTotalDebit - journalTotalCredit) | number) + ' ج.م)' }}
                  </div>
                </div>
              </div>

              <!-- 5. Inventory Audit Items Table -->
              <div class="erp-table-box" *ngIf="activeScreen.key === 'INVENTORY_AUDIT'">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <strong style="font-size:13px;">📊 أصناف الجرد وحساب الفروقات:</strong>
                  <button type="button" class="btn-erp btn-primary" (click)="addAuditRow()">+ إضافة صنف للجرد</button>
                </div>
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>كود الصنف</th>
                      <th>اسم الصنف</th>
                      <th>الوحدة</th>
                      <th>الرصيد الدفتري</th>
                      <th>الرصيد الفعلي</th>
                      <th>الفرق (عجز / زيادة)</th>
                      <th>تكلفة الوحدة</th>
                      <th>قيمة الفرق</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let row of mockAuditRows; let rIdx = index">
                      <td>{{ rIdx + 1 }}</td>
                      <td><input type="text" name="ItemCode" [(ngModel)]="row.itemCode" class="erp-input" style="padding:4px; width:85px;" placeholder="ITM-..." /></td>
                      <td><input type="text" name="ItemName" [(ngModel)]="row.itemName" class="erp-input" style="padding:4px;" placeholder="اسم الصنف..." /></td>
                      <td><input type="text" name="Unit" [(ngModel)]="row.unit" class="erp-input" style="padding:4px; width:65px;" /></td>
                      <td><input type="number" name="BookQty" [(ngModel)]="row.bookQty" (input)="calcAuditTotals()" class="erp-input" style="padding:4px; width:75px;" /></td>
                      <td><input type="number" name="ActualQty" [(ngModel)]="row.actualQty" (input)="calcAuditTotals()" class="erp-input" style="padding:4px; width:75px;" /></td>
                      <td [style.color]="(row.actualQty - row.bookQty) < 0 ? '#dc2626' : (row.actualQty - row.bookQty) > 0 ? '#16a34a' : '#64748b'">
                        <strong>{{ (row.actualQty - row.bookQty) }}</strong>
                        <small>{{ (row.actualQty - row.bookQty) < 0 ? ' (عجز)' : (row.actualQty - row.bookQty) > 0 ? ' (زيادة)' : ' (مطابق)' }}</small>
                      </td>
                      <td><input type="number" name="UnitCost" [(ngModel)]="row.unitCost" (input)="calcAuditTotals()" class="erp-input" style="padding:4px; width:80px;" /></td>
                      <td><strong>{{ (((row.actualQty - row.bookQty) * row.unitCost) | number) }} ج.م</strong></td>
                    </tr>
                  </tbody>
                </table>

                <div style="display:flex; justify-content:flex-end; gap:20px; margin-top:12px; padding:10px; background:#f8fafc; border-radius:6px; flex-wrap:wrap;">
                  <div>
                    <label style="font-size:12px; color:#64748b; font-weight:600;">إجمالي الدفتري:</label>
                    <input type="text" name="TotalBookQty" [value]="auditTotalBook | number" readonly class="erp-input" style="width:80px; font-weight:600;" />
                  </div>
                  <div>
                    <label style="font-size:12px; color:#1e40af; font-weight:600;">إجمالي الفعلي:</label>
                    <input type="text" name="TotalActualQty" [value]="auditTotalActual | number" readonly class="erp-input" style="width:80px; font-weight:600;" />
                  </div>
                  <div>
                    <label style="font-size:12px; color:#b91c1c; font-weight:600;">صافي تسوية الفروق:</label>
                    <input type="text" name="NetVarianceAmount" [value]="auditNetVariance | number" readonly class="erp-input" style="width:110px; font-weight:700;" [style.color]="auditNetVariance < 0 ? '#dc2626' : '#16a34a'" />
                  </div>
                </div>
              </div>

              <!-- 6. Simulated Employees Form (.dp-pgs__tile: الموظفين) -->
              <div *ngIf="activeScreen.key === 'EMPLOYEES'" class="erp-form-grid" data-screen-content="EMPLOYEES">
                <div class="form-group">
                  <label>كود الموظف:</label>
                  <input type="text" name="EmployeeCode" id="EmployeeCode" class="erp-input" value="EMP-2026-0089" readonly />
                </div>
                <div class="form-group">
                  <label>اسم الموظف:</label>
                  <input type="text" name="EmployeeName" id="EmployeeName" class="erp-input" placeholder="اكتب اسم الموظف..." />
                </div>
                <div class="form-group">
                  <label>القسم / الإدارة:</label>
                  <select name="Department" id="Department" class="erp-input">
                    <option value="">-- اختر القسم --</option>
                    <option value="الحسابات والمالية">الحسابات والمالية</option>
                    <option value="المبيعات والتسويق">المبيعات والتسويق</option>
                    <option value="المخازن واللوجستيات">المخازن واللوجستيات</option>
                    <option value="الموارد البشرية">الموارد البشرية</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>المسمى الوظيفي:</label>
                  <input type="text" name="JobTitle" id="JobTitle" class="erp-input" placeholder="مثال: محاسب عام، أخصائي مبيعات..." />
                </div>
                <div class="form-group">
                  <label>الراتب الأساسي:</label>
                  <input type="number" name="BasicSalary" id="BasicSalary" class="erp-input" placeholder="0.00" />
                </div>
                <div class="form-group">
                  <label>رقم الهاتف:</label>
                  <input type="text" name="Phone" id="Phone" class="erp-input" placeholder="01xxxxxxxxx" />
                </div>
              </div>

              <!-- Integration Info Callout -->
              <div class="integration-callout">
                <div class="callout-icon">💡</div>
                <div class="callout-text">
                  <strong>كيف يتكامل الشات مع هذه الشاشة؟</strong>
                  <span>
                    الـ ERP يمرر كود الشاشة الحالية <code>erp-key="{{ activeScreen.key }}"</code> للشات بالجانب.
                    لاحظ كيف يتعرف المساعد الذكي فوراً على سياق الشاشة، وعندما تسأله: 
                    <em>"{{ activeScreen.sampleQuery }}"</em>،
                    سيجيبك مباشرة من واقع الفيديوهات التعليمية أو يملأ بيانات الشاشة آلياً!
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Left Column: Dedicated AI Copilot Panel (Side-by-Side) ───── -->
        <aside class="erp-copilot-col" [class.floating-mode]="isFloatingMode" [class.minimized]="isCopilotMinimized">
          <div class="erp-copilot-card">
            <!-- Header -->
            <div class="erp-copilot-header">
              <div class="copilot-header-title">
                <span class="copilot-header-icon">🤖</span>
                <span class="copilot-title-text">مساعد Dynamic Pro الذكي</span>
                <span class="copilot-screen-badge">{{ activeScreen.name }}</span>
              </div>
              <div class="header-controls">
                <button type="button" class="btn-dock-mode" (click)="clearCacheFromMock()" [disabled]="isClearingMockCache" title="تفريغ ذاكرة التخزين المؤقت للذكاء الاصطناعي">
                  {{ mockCacheStatus === 'success' ? '✅ تم التفريغ' : (isClearingMockCache ? '⏳...' : '🧹 تفريغ الكاش') }}
                </button>
                <button type="button" class="btn-dock-mode" (click)="toggleFloatingMode()" [title]="isFloatingMode ? 'تثبيت بالجانب' : 'تحويل لنافذة عائمة'">
                  {{ isFloatingMode ? '📌 تثبيت' : '🪟 عائم' }}
                </button>
                <button type="button" class="btn-dock-toggle" (click)="toggleCopilotMinimized()" [title]="isCopilotMinimized ? 'تكبير' : 'تصغير'">
                  {{ isCopilotMinimized ? '🔼' : '🔽' }}
                </button>
              </div>
            </div>

            <!-- Chat Body with ai-chat-window isolation -->
            <div class="erp-copilot-body ai-chat-window" *ngIf="!isCopilotMinimized">
              <lms-ai-copilot
                [attr.erp-key]="activeScreen.key"
                [attr.token]="effectiveToken"
                [attr.api-url]="'http://localhost:8000'"
                [attr.hide-header]="'true'"
                [attr.inline]="'true'">
              </lms-ai-copilot>
            </div>
          </div>

          <!-- Quick Test & Specs Panel (Compact & Collapsible) -->
          <div class="erp-specs-collapsible" *ngIf="!isFloatingMode">
            <div class="specs-header" (click)="toggleSpecsOpen()">
              <span>⚙️ مواصفات التكامل والأوامر المقترحة</span>
              <span class="specs-arrow">{{ isSpecsOpen ? '▲' : '▼' }}</span>
            </div>
            <div class="specs-body" *ngIf="isSpecsOpen">
              <div class="prompt-quick-card" (click)="copyPrompt(activeScreen.sampleQuery)">
                <div class="prompt-label">💬 انقر لنسخ أمر التجربة:</div>
                <div class="prompt-text">"{{ activeScreen.sampleQuery }}"</div>
                <span class="copy-hint">{{ copiedPrompt ? '✅ تم النسخ إلى الحافظة!' : '📋 انقر للنسخ' }}</span>
              </div>
              <ul class="specs-mini-list">
                <li><strong>التاج:</strong> <code>&lt;lms-ai-copilot hide-header="true"&gt;</code></li>
                <li><strong>السيرفر:</strong> <code>http://localhost:8000</code></li>
                <li><strong>كود الشاشة:</strong> <code>{{ activeScreen.key }}</code></li>
              </ul>
            </div>
          </div>
        </aside>
      </main>
    </div>
  `,
  styles: [`
    .erp-container {
      min-height: 100vh;
      background: #f1f5f9;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1e293b;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ────────────────────────────────────────── */
    .erp-header {
      background: #1e293b;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px solid #3b82f6;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .erp-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .erp-logo {
      font-size: 28px;
      background: rgba(255,255,255,0.1);
      padding: 6px 10px;
      border-radius: 8px;
    }
    .erp-title {
      font-size: 18px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .erp-subtitle {
      font-size: 11px;
      color: #94a3b8;
    }

    .erp-user-badge {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255,255,255,0.08);
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.15);
    }
    .user-avatar { font-size: 18px; }
    .user-details { display: flex; flex-direction: column; text-align: right; }
    .user-name { font-size: 12px; font-weight: 600; color: #f8fafc; }
    .user-dept { font-size: 10px; color: #cbd5e1; }
    .conn-status {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 10px;
      background: #0f172a;
      border: 1px solid #334155;
    }
    .conn-status.connected { color: #4ade80; border-color: #22c55e; }

    /* ── Live ERP Header Tabs (.dp-hdr__tab) ──────────── */
    .dp-hdr__tabs-strip {
      display: flex;
      align-items: center;
      gap: 6px;
      overflow-x: auto;
      margin: 0 16px;
    }
    .dp-hdr__tab {
      display: inline-flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px 6px 0 0;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 11px;
      color: #cbd5e1;
      transition: all 0.2s;
    }
    .dp-hdr__tab:hover {
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
    }
    .dp-hdr__tab.is-active {
      background: #ffffff;
      color: #1e293b;
      font-weight: 700;
      border-color: #ffffff;
      box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.1);
    }
    .dp-hdr__tab-open {
      background: transparent;
      border: none;
      color: inherit;
      font-family: inherit;
      font-size: inherit;
      font-weight: inherit;
      cursor: pointer;
      padding: 0;
    }
    .dp-hdr__tab-close {
      margin-right: 6px;
      font-size: 14px;
      color: #94a3b8;
      cursor: pointer;
    }
    .dp-hdr__tab-close:hover {
      color: #ef4444;
    }

    /* ── Live ERP Navigation Bar ───────────────────────── */
    .erp-nav-bar {
      background: #ffffff;
      padding: 12px 24px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .dp-nav-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .nav-headline {
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* 1. Modules Bar (.dp-pgs__mod) */
    .dp-modules-bar {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .dp-pgs__mod {
      padding: 6px 14px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #334155;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.18s;
    }
    .dp-pgs__mod:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }
    .dp-pgs__mod.is-active {
      background: #1e293b;
      color: #ffffff;
      border-color: #1e293b;
      box-shadow: 0 2px 6px rgba(30, 41, 59, 0.2);
    }

    /* 2. Filter Chips (.dp-cats__chip) */
    .dp-cats-bar {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .dp-cats__chip {
      padding: 3px 10px;
      border-radius: 14px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #64748b;
      font-size: 11px;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s;
    }
    .dp-cats__chip:hover {
      background: #f8fafc;
    }
    .dp-cats__chip.is-on {
      background: #3b82f6;
      color: #ffffff;
      border-color: #3b82f6;
      font-weight: 600;
    }

    /* 3. Screen Tiles (.dp-pgs__tile) */
    .dp-tiles-grid {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .dp-pgs__cell {
      display: inline-flex;
    }
    .dp-pgs__tile, .screen-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      transition: all 0.2s;
    }
    .dp-pgs__tile:hover, .screen-btn:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }
    .dp-pgs__tile.active, .screen-btn.active {
      background: #eff6ff;
      border-color: #3b82f6;
      color: #1d4ed8;
      box-shadow: 0 2px 6px rgba(59, 130, 246, 0.15);
      font-weight: 600;
    }
    .screen-badge {
      font-size: 10px;
      background: #e2e8f0;
      padding: 2px 6px;
      border-radius: 4px;
      color: #475569;
    }
    .dp-pgs__tile.active .screen-badge, .screen-btn.active .screen-badge {
      background: #dbeafe;
      color: #1e40af;
    }
    .screen-code {
      font-size: 10px;
      color: #64748b;
      font-family: monospace;
    }

    /* ── Workspace ─────────────────────────────────────── */
    .erp-workspace {
      flex: 1;
      padding: 16px 24px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 480px;
      gap: 20px;
      max-width: 1680px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
      align-items: start;
    }

    .erp-card {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      overflow: hidden;
    }
    .card-header {
      padding: 16px 20px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-left h2 {
      margin: 0 0 4px 0;
      font-size: 16px;
      color: #0f172a;
    }
    .screen-tag {
      font-size: 11px;
      color: #64748b;
    }
    .screen-tag code {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      color: #2563eb;
      font-weight: bold;
    }
    .header-actions {
      display: flex;
      gap: 6px;
    }
    .btn-erp {
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      font-family: inherit;
      border: 1px solid transparent;
      font-weight: 500;
    }
    .btn-primary { background: #2563eb; color: #ffffff; }
    .btn-secondary { background: #f1f5f9; color: #334155; border-color: #cbd5e1; }
    .btn-outline { background: transparent; color: #64748b; border-color: #cbd5e1; }

    .card-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .screen-desc {
      font-size: 13px;
      color: #64748b;
      margin: 0;
      background: #f8fafc;
      padding: 8px 12px;
      border-radius: 6px;
      border-right: 3px solid #3b82f6;
    }

    .erp-form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .form-group label {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
    }
    .erp-input {
      padding: 8px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 12px;
      outline: none;
      font-family: inherit;
      background: #ffffff;
    }

    .erp-table-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 6px;
    }
    .erp-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      text-align: right;
    }
    .erp-table th {
      background: #f8fafc;
      padding: 10px 12px;
      color: #475569;
      font-weight: 600;
      border-bottom: 1px solid #e2e8f0;
    }
    .erp-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
    }

    .integration-callout {
      display: flex;
      gap: 12px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 12px 16px;
      align-items: flex-start;
    }
    .callout-icon { font-size: 20px; }
    .callout-text {
      font-size: 12px;
      color: #166534;
      line-height: 1.5;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    /* ── Dedicated Side-by-Side Copilot Panel strictly inside ERP Mock ── */
    .erp-copilot-col {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 480px;
      max-width: 480px;
      position: sticky;
      top: 28px;
      margin-top: 8px;
      z-index: 100;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .erp-copilot-card {
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      height: 720px;
      max-height: calc(100vh - 120px);
      overflow: hidden;
      transition: height 0.2s ease, box-shadow 0.2s ease;
    }

    .erp-copilot-col.floating-mode {
      position: fixed;
      bottom: 24px;
      left: 24px;
      width: 460px;
      max-width: calc(100vw - 48px);
      z-index: 99999;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
      border-radius: 14px;
    }

    .erp-copilot-col.floating-mode .erp-copilot-card {
      height: 620px;
      box-shadow: none;
      border: 1px solid #94a3b8;
    }

    .erp-copilot-col.minimized .erp-copilot-card {
      height: 48px;
      overflow: hidden;
    }

    .erp-copilot-header {
      background: #1e293b;
      color: #ffffff;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      user-select: none;
      border-bottom: 2px solid #3b82f6;
    }

    .copilot-header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
    }

    .copilot-header-icon {
      font-size: 16px;
    }

    .copilot-title-text {
      color: #ffffff;
    }

    .copilot-screen-badge {
      font-size: 10px;
      background: #3b82f6;
      color: #ffffff;
      padding: 2px 7px;
      border-radius: 10px;
      font-weight: 500;
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-dock-mode, .btn-dock-toggle {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #f1f5f9;
      font-size: 11px;
      cursor: pointer;
      padding: 3px 8px;
      border-radius: 6px;
      transition: all 0.15s ease;
      font-family: inherit;
    }

    .btn-dock-mode:hover, .btn-dock-toggle:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }

    .erp-copilot-body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      background: #f8fafc;
      overflow: hidden;
      position: relative;
      padding-top: 16px;
      box-sizing: border-box;
    }

    .erp-copilot-body lms-ai-copilot {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      flex: 1;
      min-height: 0;
      box-sizing: border-box;
    }

    .erp-copilot-body ::ng-deep .admin-cache-strip {
      display: flex !important;
      visibility: visible !important;
      margin: 4px 10px 8px 10px !important;
      border-radius: 8px !important;
      border: 1px solid #cbd5e1 !important;
      background: #ffffff !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;
    }

    .erp-copilot-body ::ng-deep .copilot-window {
      padding-top: 6px !important;
      overflow: visible !important;
    }

    .erp-copilot-body ::ng-deep .filter-ribbon {
      border-top: 1px solid #e2e8f0;
      border-radius: 8px 8px 0 0;
      margin-top: 4px;
    }

    /* ── Collapsible Specs Box ─────────────────────────── */
    .erp-specs-collapsible {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    .specs-header {
      background: #f8fafc;
      padding: 8px 14px;
      font-size: 12px;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
      user-select: none;
    }

    .specs-arrow {
      font-size: 10px;
      color: #64748b;
    }

    .specs-body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .prompt-quick-card {
      background: #eff6ff;
      border: 1px dashed #3b82f6;
      border-radius: 8px;
      padding: 10px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .prompt-quick-card:hover {
      background: #dbeafe;
    }

    .prompt-label {
      font-size: 10px;
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 4px;
    }

    .prompt-text {
      font-size: 11px;
      color: #1d4ed8;
      line-height: 1.4;
      font-weight: 500;
    }

    .copy-hint {
      display: block;
      font-size: 10px;
      color: #2563eb;
      margin-top: 6px;
      text-align: left;
      font-weight: 600;
    }

    .specs-mini-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 11px;
      color: #475569;
    }

    .specs-mini-list code {
      font-family: monospace;
      background: #f1f5f9;
      padding: 1px 5px;
      border-radius: 4px;
      color: #0f172a;
    }

    @media (max-width: 1200px) {
      .erp-workspace {
        grid-template-columns: 1fr;
      }
      .erp-copilot-col {
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
        position: static;
      }
    }
  `]
})
export class ErpMockComponent implements OnInit {
  authService = inject(AuthService);
  copilotService = inject(CopilotService);
  private cdr = inject(ChangeDetectorRef);
  isFloatingMode = false;
  isCopilotMinimized = false;
  isSpecsOpen = true;
  copiedPrompt = false;
  isClearingMockCache = false;
  mockCacheStatus: 'idle' | 'success' | 'error' = 'idle';

  clearCacheFromMock() {
    if (this.isClearingMockCache) return;
    this.isClearingMockCache = true;
    this.mockCacheStatus = 'idle';
    this.copilotService.clearAiCache().subscribe({
      next: () => {
        this.isClearingMockCache = false;
        this.mockCacheStatus = 'success';
        setTimeout(() => this.mockCacheStatus = 'idle', 3000);
      },
      error: () => {
        this.isClearingMockCache = false;
        this.mockCacheStatus = 'error';
        setTimeout(() => this.mockCacheStatus = 'idle', 3000);
      }
    });
  }

  toggleFloatingMode() {
    this.isFloatingMode = !this.isFloatingMode;
  }

  toggleCopilotMinimized() {
    this.isCopilotMinimized = !this.isCopilotMinimized;
  }

  toggleSpecsOpen() {
    this.isSpecsOpen = !this.isSpecsOpen;
  }

  erpScreens: ErpScreen[] = [
    {
      key: 'SALES_INVOICE',
      name: 'فاتورة المبيعات',
      category: 'المبيعات والعملاء',
      description: 'شاشة إصدار فواتير المبيعات للعملاء وتحديد طريقة الدفع ومخزن الصرف والأصناف المباعة واحتساب ضريبة القيمة المضافة.',
      sampleQuery: 'عايز اسجل فاتورة مبيعات للعميل شركة النيل للتجارة قطاع جملة صنف شاشات حاسوب كمية 5 بسعر 8500 والدفع نقداً'
    },
    {
      key: 'NEW_CUSTOMER',
      name: 'تسجيل عميل جديد',
      category: 'العملاء والحسابات',
      description: 'شاشة فتح بطاقة عميل جديد في الـ ERP وتسجيل بيانات الاتصال والتصنيف والحد الائتماني والبيانات الضريبية.',
      sampleQuery: 'سجل لي عميل جديد باسم شركة الأمل الدولية وتليفونه 01122334455 وعنوانه المعادي ومبلغ الحد الائتماني 150000 وتصنيف جملة'
    },
    {
      key: 'PURCHASE_INVOICE',
      name: 'فاتورة المشتريات',
      category: 'المخازن والمشتريات',
      description: 'شاشة تسجيل أوامر التوريد وفواتير المشتريات وتوريد الأصناف وإثبات السداد وسحب الحقول التابعة تلقائياً.',
      sampleQuery: 'سجل لي فاتورة مشتريات من المورد شركة التوحيد خامات المنتج كابلات شبكة CAT6 الكمية 10 وسعر 150 نقدي'
    },
    {
      key: 'JOURNAL_ENTRY',
      name: 'قيود اليومية العامة',
      category: 'الحسابات العامة',
      description: 'شاشة تسجيل قيود اليومية المحاسبية المزدوجة والتوجيه المحاسبي لمراكز التكلفة والتأكد من توازن القيد.',
      sampleQuery: 'سجل لي قيد يومية صرف مرتبات بقيمة 5000 جنيه من حساب الصندوق الرئيسي إلى حساب الرواتب والأجور'
    },
    {
      key: 'INVENTORY_AUDIT',
      name: 'الجرد والتسويات المخزنية',
      category: 'إدارة المستودعات',
      description: 'شاشة الجرد الفعلي للمخزون وتسجيل الرصيد الفعلي وحساب العجز أو الزيادة والتسوية الجردية آلياً.',
      sampleQuery: 'عايز اعمل محضر جرد لمخزن القاهرة نوع التسوية تسوية جردية لصنف شاشات حاسوب الرصيد الفعلي 8'
    },
    {
      key: 'EMPLOYEES',
      name: 'الموظفين',
      category: 'شئون الموظفين',
      description: 'شاشة إدارة ملفات وبيانات الموظفين والرواتب والأقسام والتكويدات العامة في النظام.',
      sampleQuery: 'عايز اضيف موظف جديد باسم احمد علي في قسم المبيعات براتب 8000 جنيه'
    }
  ];

  activeScreen: ErpScreen = this.erpScreens[0];

  erpModules: string[] = [
    'الجميع',
    'العملاء و المبيعات',
    'الموردين و المشتريات',
    'المخازن',
    'الحسابات العامه',
    'شئون الموظفين'
  ];

  activeModule: string = 'الجميع';

  filterChips: string[] = ['الجميع', 'الحركات', 'التكويدات', 'التقارير'];
  activeChip: string = 'الجميع';

  openTabs: ErpScreen[] = [];

  selectModule(mod: string) {
    this.activeModule = mod;
    this.cdr.detectChanges();
  }

  getScreensForActiveModule(): ErpScreen[] {
    if (!this.activeModule || this.activeModule === 'الجميع') {
      return this.erpScreens;
    }
    const moduleMap: Record<string, string[]> = {
      'العملاء و المبيعات': ['SALES_INVOICE', 'NEW_CUSTOMER'],
      'الموردين و المشتريات': ['PURCHASE_INVOICE'],
      'المخازن': ['INVENTORY_AUDIT'],
      'الحسابات العامه': ['JOURNAL_ENTRY'],
      'شئون الموظفين': ['EMPLOYEES']
    };
    const allowed = moduleMap[this.activeModule] || [];
    return this.erpScreens.filter(s => allowed.includes(s.key));
  }

  closeTab(screen: ErpScreen) {
    this.openTabs = this.openTabs.filter(s => s.key !== screen.key);
    if (this.activeScreen.key === screen.key && this.openTabs.length > 0) {
      this.switchScreen(this.openTabs[this.openTabs.length - 1]);
    }
    this.cdr.detectChanges();
  }

  // 1. Purchase Invoice State
  mockSupplierDetails = { name: '', address: '', phone: '', taxFile: '' };
  mockRows = [
    { itemName: '', quantity: 0, cost: 0 }
  ];
  mockTotalAmount = 0;

  onMockSupplierChange(e: any) {
    const val = e.target.value;
    if (val.includes('التوحيد')) {
      this.mockSupplierDetails = { name: 'شركة التوحيد خامات', address: 'العاشر من رمضان - المنطقة الصناعية B3', phone: '01099887766', taxFile: 'TAX-8849-01' };
    } else if (val.includes('الحمد')) {
      this.mockSupplierDetails = { name: 'شركة الحمد للتجارة', address: 'مدينة العبور - المنطقة الأولى', phone: '01122334455', taxFile: 'TAX-1122-33' };
    } else if (val) {
      this.mockSupplierDetails = { name: val, address: 'القاهرة', phone: '01012345678', taxFile: 'TAX-0000-00' };
    } else {
      this.mockSupplierDetails = { name: '', address: '', phone: '', taxFile: '' };
    }
  }

  addMockRow() {
    this.mockRows.push({ itemName: '', quantity: 0, cost: 0 });
    this.cdr.detectChanges();
  }

  calcMockTotals() {
    this.mockTotalAmount = this.mockRows.reduce((sum, r) => sum + ((Number(r.quantity) || 0) * (Number(r.cost) || 0)), 0);
  }

  clearMockPurchaseForm() {
    this.mockSupplierDetails = { name: '', address: '', phone: '', taxFile: '' };
    this.mockRows = [{ itemName: '', quantity: 0, cost: 0 }];
    this.mockTotalAmount = 0;
    const supplierSel = document.querySelector('select[name="Supplier"]') as HTMLSelectElement;
    if (supplierSel) supplierSel.value = '';
    const cashInput = document.querySelector('input[name="CashPaid"]') as HTMLInputElement;
    if (cashInput) cashInput.value = '';
  }

  // 2. Sales Invoice State
  mockSalesRows = [
    { itemName: 'شاشات حاسوب 27 بوصة IPS 4K', unit: 'قطعة', quantity: 5, price: 8500, discount: 0 }
  ];
  salesSubTotal = 42500;
  salesTax = 5950;
  salesTotal = 48450;
  salesPaid = 48450;
  salesRemaining = 0;

  addSalesRow() {
    this.mockSalesRows.push({ itemName: '', unit: 'قطعة', quantity: 1, price: 0, discount: 0 });
    this.calcSalesTotals();
    this.cdr.detectChanges();
  }

  calcSalesTotals() {
    this.salesSubTotal = this.mockSalesRows.reduce((sum, r) => {
      const q = Number(r.quantity) || 0;
      const p = Number(r.price) || 0;
      const d = Number(r.discount) || 0;
      return sum + Math.max(0, (q * p) - d);
    }, 0);
    this.salesTax = Math.round(this.salesSubTotal * 0.14);
    this.salesTotal = this.salesSubTotal + this.salesTax;
    this.salesRemaining = Math.max(0, this.salesTotal - (Number(this.salesPaid) || 0));
  }

  // 3. New Customer Branches State
  mockCustomerBranches = [
    { branchName: 'المقر الرئيسي', contactPerson: 'أحمد سعيد', phone: '01011223344', city: 'القاهرة' },
    { branchName: 'فرع الإسكندرية', contactPerson: 'كريم ممدوح', phone: '01299887766', city: 'الإسكندرية' }
  ];

  addCustomerBranch() {
    this.mockCustomerBranches.push({ branchName: '', contactPerson: '', phone: '', city: '' });
    this.cdr.detectChanges();
  }

  // 4. Journal Entry State
  mockJournalRows = [
    { accountCode: '10101', accountName: 'الرواتب والأجور', costCenter: 'الإدارة العامة', debit: 5000, credit: 0, lineNotes: 'صرف راتب شهر أكتوبر' },
    { accountCode: '10201', accountName: 'الصندوق الرئيسي', costCenter: 'الخزينة المركزية', debit: 0, credit: 5000, lineNotes: 'صرف نقدي من الخزينة' }
  ];
  journalTotalDebit = 5000;
  journalTotalCredit = 5000;

  addJournalRow() {
    this.mockJournalRows.push({ accountCode: '', accountName: '', costCenter: '', debit: 0, credit: 0, lineNotes: '' });
    this.calcJournalTotals();
    this.cdr.detectChanges();
  }

  calcJournalTotals() {
    this.journalTotalDebit = this.mockJournalRows.reduce((sum, r) => sum + (Number(r.debit) || 0), 0);
    this.journalTotalCredit = this.mockJournalRows.reduce((sum, r) => sum + (Number(r.credit) || 0), 0);
  }

  // 5. Inventory Audit State
  mockAuditRows = [
    { itemCode: 'ITM-1029', itemName: 'شاشات حاسوب 27 بوصة IPS 4K', unit: 'قطعة', bookQty: 10, actualQty: 8, unitCost: 8500 },
    { itemCode: 'ITM-3301', itemName: 'كابلات شبكة CAT6 معتمدة 305م', unit: 'لفة', bookQty: 5, actualQty: 5, unitCost: 2200 }
  ];
  auditTotalBook = 15;
  auditTotalActual = 13;
  auditNetVariance = -17000;

  addAuditRow() {
    this.mockAuditRows.push({ itemCode: '', itemName: '', unit: 'قطعة', bookQty: 0, actualQty: 0, unitCost: 0 });
    this.calcAuditTotals();
    this.cdr.detectChanges();
  }

  calcAuditTotals() {
    this.auditTotalBook = this.mockAuditRows.reduce((sum, r) => sum + (Number(r.bookQty) || 0), 0);
    this.auditTotalActual = this.mockAuditRows.reduce((sum, r) => sum + (Number(r.actualQty) || 0), 0);
    this.auditNetVariance = this.mockAuditRows.reduce((sum, r) => {
      const diff = (Number(r.actualQty) || 0) - (Number(r.bookQty) || 0);
      return sum + (diff * (Number(r.unitCost) || 0));
    }, 0);
  }

  clearCurrentScreenForm() {
    if (this.activeScreen.key === 'PURCHASE_INVOICE') {
      this.clearMockPurchaseForm();
    } else if (this.activeScreen.key === 'SALES_INVOICE') {
      this.mockSalesRows = [{ itemName: '', unit: 'قطعة', quantity: 1, price: 0, discount: 0 }];
      this.salesPaid = 0;
      this.calcSalesTotals();
      const custInput = document.querySelector('input[name="CustomerName"]') as HTMLInputElement;
      if (custInput) custInput.value = '';
    } else if (this.activeScreen.key === 'NEW_CUSTOMER') {
      const inputs = document.querySelectorAll('.erp-form-grid input');
      inputs.forEach(i => (i as HTMLInputElement).value = '');
    } else if (this.activeScreen.key === 'JOURNAL_ENTRY') {
      this.mockJournalRows = [
        { accountCode: '', accountName: '', costCenter: '', debit: 0, credit: 0, lineNotes: '' }
      ];
      this.calcJournalTotals();
    } else if (this.activeScreen.key === 'INVENTORY_AUDIT') {
      this.mockAuditRows = [
        { itemCode: '', itemName: '', unit: 'قطعة', bookQty: 0, actualQty: 0, unitCost: 0 }
      ];
      this.calcAuditTotals();
    } else if (this.activeScreen.key === 'EMPLOYEES') {
      const inputs = document.querySelectorAll('[data-screen-content="EMPLOYEES"] input, [data-screen-content="EMPLOYEES"] select');
      inputs.forEach(i => (i as HTMLInputElement).value = '');
    }
  }

  mockDevToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlcnAtbW9jay1hZG1pbiIsIm5hbWUiOiJcdTA2NDVcdTA2MjdcdTA2MzJcdTA2NDYgXHUwNjJmXHUwNjMxXHUwNjQ4XHUwNjRhXHUwNjM0Iiwicm9sZSI6IkFkbWluIiwidGVuYW50X2lkIjoidGVuYW50LXRlc3QiLCJkZXBhcnRtZW50X2lkIjoiZGVwdC10ZXN0IiwiaXNzIjoiRHluYW1pY1Byb0xlYXJuIiwiYXVkIjoiRHluYW1pY1Byb0xlYXJuQ2xpZW50IiwiZXhwIjoxODIyOTE0ODc2fQ.t7-b2keNiYiFEuzB5QYqrNNzmYTyIDjAFdVM_s3C3DQ';

  get effectiveToken(): string {
    const active = this.authService.token();
    if (active && !this.authService.isTokenExpired(active)) {
      return active;
    }
    return this.mockDevToken;
  }

  ngOnInit() {
    if (!this.authService.isAuthenticated()) {
      const savedToken = localStorage.getItem('jwt_token');
      if (savedToken && !this.authService.isTokenExpired(savedToken)) {
        this.authService.login(savedToken);
      } else {
        this.authService.login(this.mockDevToken);
      }
    }
    this.openTabs = [this.activeScreen];
  }

  switchScreen(screen: ErpScreen) {
    this.activeScreen = screen;
    if (!this.openTabs.some(t => t.key === screen.key)) {
      this.openTabs.push(screen);
    }
    this.cdr.detectChanges();
  }

  @HostListener('window:lms:navigate', ['$event'])
  onLmsNavigate(e: Event) {
    const customEvt = e as CustomEvent;
    const key = customEvt.detail?.screenKey;
    const label = customEvt.detail?.label;
    if (key || label) {
      // 1. Check if matches a module name
      if (this.erpModules.includes(label) || this.erpModules.includes(key)) {
        const targetMod = this.erpModules.find(m => m === label || m === key);
        if (targetMod) {
          console.info('%c[ErpMock] Switched active module via lms:navigate to:', 'color:#10b981;font-weight:bold', targetMod);
          this.selectModule(targetMod);
          return;
        }
      }

      // 2. Check if matches a screen
      const found = this.erpScreens.find(s => s.key === key || s.name.includes(key) || (label && s.name.includes(label)));
      if (found) {
        console.info('%c[ErpMock] Switched active screen via lms:navigate to:', 'color:#10b981;font-weight:bold', found.name);
        this.switchScreen(found);
      }
    }
  }

  copyPrompt(text: string) {
    navigator.clipboard?.writeText(text);
    this.copiedPrompt = true;
    setTimeout(() => this.copiedPrompt = false, 2500);
  }
}


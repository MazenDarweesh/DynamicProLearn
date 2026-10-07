import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, inject } from '@angular/core';
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
            <span class="erp-subtitle">محاكي نظام تخطيط الموارد المؤسسية (بيئة الاختبار والتكامل)</span>
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

      <!-- ── Screen Switcher Bar (Simulating ERP Navigation) ─────────────── -->
      <nav class="erp-nav-bar">
        <div class="nav-headline">
          <span class="nav-icon">🧭</span>
          <span>شاشات الـ ERP (انقر لاختبار استجابة الشات الفورية لكل شاشة):</span>
        </div>

        <div class="screen-tabs">
          <button *ngFor="let s of erpScreens"
                  type="button"
                  class="screen-btn"
                  [class.active]="activeScreen.key === s.key"
                  (click)="switchScreen(s)">
            <span class="screen-badge">{{ s.category }}</span>
            <span class="screen-label">{{ s.name }}</span>
            <code class="screen-code">[{{ s.key }}]</code>
          </button>
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
                <button type="button" class="btn-erp btn-outline" title="فاتورة جديدة" (click)="clearMockPurchaseForm()">✨ جديد / تفريغ</button>
                <button class="btn-erp btn-primary">💾 حفظ</button>
                <button class="btn-erp btn-secondary">🖨️ طباعة</button>
                <button class="btn-erp btn-outline">↺ تراجع</button>
              </div>
            </div>

            <div class="card-body">
              <p class="screen-desc">{{ activeScreen.description }}</p>

              <!-- Simulated ERP Data Form -->
              <div *ngIf="activeScreen.key === 'NEW_CUSTOMER'" class="erp-form-grid">
                <div class="form-group">
                  <label>اسم العميل / الشركة:</label>
                  <input type="text" name="CustomerName" id="CustomerName" class="erp-input" placeholder="اكتب اسم العميل أو دعه يتعبأ آلياً..." />
                </div>
                <div class="form-group">
                  <label>رقم الهاتف / الموبايل:</label>
                  <input type="text" name="Phone" id="Phone" class="erp-input" placeholder="010..." />
                </div>
                <div class="form-group">
                  <label>العنوان / المقر:</label>
                  <input type="text" name="Address" id="Address" class="erp-input" placeholder="المدينة، الحي، الشارع..." />
                </div>
                <div class="form-group">
                  <label>الحد الائتماني (ج.م):</label>
                  <input type="number" name="CreditLimit" id="CreditLimit" class="erp-input" placeholder="مثال: 50000" />
                </div>
              </div>

              <!-- Simulated Purchase Invoice Form (DynamicPro Real Schema) -->
              <div *ngIf="activeScreen.key === 'PURCHASE_INVOICE'" class="erp-form-grid">
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

              <!-- Simulated General ERP Form for Other Screens -->
              <div *ngIf="activeScreen.key !== 'NEW_CUSTOMER' && activeScreen.key !== 'PURCHASE_INVOICE'" class="erp-form-grid">
                <div class="form-group">
                  <label>رقم المستند / الفاتورة:</label>
                  <input type="text" name="InvoiceNumber" id="InvoiceNumber" class="erp-input" value="INV-2026-0922" readonly />
                </div>
                <div class="form-group">
                  <label>الطرف / العميل:</label>
                  <input type="text" name="CustomerName" id="CustomerName" class="erp-input" value="شركة الأمل للتجارة والتوزيع" />
                </div>
                <div class="form-group">
                  <label>تاريخ المعاملة:</label>
                  <input type="date" name="DocDate" id="DocDate" class="erp-input" value="2026-09-22" />
                </div>
                <div class="form-group">
                  <label>طريقة الدفع:</label>
                  <select name="PaymentMethod" id="PaymentMethod" class="erp-input">
                    <option>آجل (استحقاق 30 يوم)</option>
                    <option>نقداً (الخزينة الرئيسية)</option>
                    <option>تحويل بنكي</option>
                  </select>
                </div>
              </div>

              <!-- Purchase Invoice Items Grid -->
              <div class="erp-table-box" *ngIf="activeScreen.key === 'PURCHASE_INVOICE'">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <strong style="font-size:13px;">جدول الأصناف الموردة:</strong>
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

              <!-- Simulated General ERP Table for Other Screens -->
              <div class="erp-table-box" *ngIf="activeScreen.key !== 'PURCHASE_INVOICE'">
                <table class="erp-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>كود البند</th>
                      <th>الوصف</th>
                      <th>الكمية</th>
                      <th>سعر الوحدة</th>
                      <th>ضريبة QVAT (14%)</th>
                      <th>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td><code>ITM-1029</code></td>
                      <td>شاشات حاسوب 27 بوصة IPS 4K</td>
                      <td>10</td>
                      <td>8,500 ج.م</td>
                      <td>11,900 ج.م</td>
                      <td><strong>96,900 ج.م</strong></td>
                    </tr>
                    <tr>
                      <td>2</td>
                      <td><code>ITM-3301</code></td>
                      <td>كابلات شبكة CAT6 معتمدة 305م</td>
                      <td>5</td>
                      <td>2,200 ج.م</td>
                      <td>1,540 ج.م</td>
                      <td><strong>12,540 ج.م</strong></td>
                    </tr>
                  </tbody>
                </table>
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

    /* ── Screen Navigation ─────────────────────────────── */
    .erp-nav-bar {
      background: #ffffff;
      padding: 10px 24px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .nav-headline {
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .screen-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .screen-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #334155;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      transition: all 0.2s;
    }
    .screen-btn:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
    }
    .screen-btn.active {
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
    .screen-btn.active .screen-badge {
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
      description: 'شاشة إصدار فواتير المبيعات للعملاء واحتساب ضريبة القيمة المضافة وإرسال الفاتورة الإلكترونية.',
      sampleQuery: 'كيف أقوم بإصدار فاتورة مبيعات مع تطبيق خصم تجاري؟'
    },
    {
      key: 'NEW_CUSTOMER',
      name: 'تسجيل عميل جديد (تجربة التعبئة بالذكاء الاصطناعي)',
      category: 'العملاء والحسابات',
      description: 'شاشة فتح بطاقة عميل جديد في الـ ERP وتسجيل بيانات الاتصال والحد الائتماني.',
      sampleQuery: 'سجل لي عميل جديد باسم شركة الأمل للتجارة وتليفونه 01012345678 وعنوانه مدينة نصر وحد ائتماني 50000'
    },
    {
      key: 'PURCHASE_INVOICE',
      name: 'فاتورة المشتريات (تجربة تعبئة الأصناف والدفعات المتكررة)',
      category: 'المخازن والمشتريات',
      description: 'شاشة تسجيل أوامر التوريد وفواتير المشتريات وتوريد الأصناف وإثبات السداد وسحب الحقول التابعة تلقائياً.',
      sampleQuery: 'سجل لي دفعة من 3 فواتير مشتريات: الأولى من شركة التوحيد خامات المنتج كابلات شبكة CAT6 الكمية 10 وسعر 150 نقدي، الثانية من شركة الحمد للتجارة المنتج رواتر 5 وسعر 800، الثالثة من مؤسسة النور توريدات المنتج سويتشات 2 وسعر 1200'
    },
    {
      key: 'JOURNAL_ENTRY',
      name: 'قيود اليومية العامة',
      category: 'الحسابات العامة',
      description: 'شاشة تسجيل قيود اليومية المحاسبية المزدوجة والتوجيه المحاسبي لشجرة الحسابات.',
      sampleQuery: 'كيف أوازن قيد اليومية وأربطه مع مركز التكلفة؟'
    },
    {
      key: 'INVENTORY_AUDIT',
      name: 'الجرد والتسويات المخزنية',
      category: 'إدارة المستودعات',
      description: 'شاشة الجرد الفعلي للمخزون وتسجيل العجز والزيادة وأذون الصرف والإضافة.',
      sampleQuery: 'كيف أقوم بتسجيل تسوية جردية بعد الجرد السنوي؟'
    }
  ];

  activeScreen: ErpScreen = this.erpScreens[0];

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
  }

  switchScreen(screen: ErpScreen) {
    this.activeScreen = screen;
  }

  copyPrompt(text: string) {
    navigator.clipboard?.writeText(text);
    this.copiedPrompt = true;
    setTimeout(() => this.copiedPrompt = false, 2500);
  }
}


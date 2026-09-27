import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

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
        <div class="erp-main-col">
          <!-- ERP Active Form Card -->
          <div class="erp-card">
            <div class="card-header">
              <div class="header-left">
                <h2>{{ activeScreen.name }}</h2>
                <span class="screen-tag">ERP Key: <code>{{ activeScreen.key }}</code></span>
              </div>
              <div class="header-actions">
                <button class="btn-erp btn-primary">💾 حفظ</button>
                <button class="btn-erp btn-secondary">🖨️ طباعة</button>
                <button class="btn-erp btn-outline">↺ تراجع</button>
              </div>
            </div>

            <div class="card-body">
              <p class="screen-desc">{{ activeScreen.description }}</p>

              <!-- Simulated ERP Data Form -->
              <div class="erp-form-grid">
                <div class="form-group">
                  <label>رقم المستند / الفاتورة:</label>
                  <input type="text" class="erp-input" value="INV-2026-0922" readonly />
                </div>
                <div class="form-group">
                  <label>الطرف / العميل:</label>
                  <input type="text" class="erp-input" value="شركة الأمل للتجارة والتوزيع" />
                </div>
                <div class="form-group">
                  <label>تاريخ المعاملة:</label>
                  <input type="date" class="erp-input" value="2026-09-22" />
                </div>
                <div class="form-group">
                  <label>طريقة الدفع:</label>
                  <select class="erp-input">
                    <option>آجل (استحقاق 30 يوم)</option>
                    <option>نقداً (الخزينة الرئيسية)</option>
                    <option>تحويل بنكي</option>
                  </select>
                </div>
              </div>

              <!-- Simulated ERP Table -->
              <div class="erp-table-box">
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
                    الـ ERP يمرر كود الشاشة الحالية <code>erp-key="{{ activeScreen.key }}"</code> للودجت بالأسفل.
                    لاحظ كيف يتعرف المساعد الذكي فوراً على سياق الشاشة، وعندما تسأله: 
                    <em>"{{ activeScreen.sampleQuery }}"</em>،
                    سيجيبك مباشرة من واقع الفيديوهات التعليمية الخاصة بهذا الموضوع!
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar Explaining the Architecture -->
        <aside class="erp-sidebar">
          <div class="sidebar-card">
            <h3>⚙️ مواصفات التكامل للـ ERP</h3>
            <ul class="specs-list">
              <li>
                <strong>نوع التكامل:</strong>
                <span>Web Component (Custom Element)</span>
              </li>
              <li>
                <strong>اسم التاج في الـ ERP:</strong>
                <code>&lt;lms-ai-copilot&gt;</code>
              </li>
              <li>
                <strong>الكود الممرر للشاشة:</strong>
                <span class="active-key-pill">{{ activeScreen.key }}</span>
              </li>
              <li>
                <strong>سيرفر الـ AI:</strong>
                <span>http://localhost:8000</span>
              </li>
              <li>
                <strong>الميزة المفعلة:</strong>
                <span>توجيه السياق التلقائي (Zero-Click Context)</span>
              </li>
            </ul>

            <hr class="divider" />

            <div class="test-helper-box">
              <h4>🎯 جرب تسأل الشات الآن:</h4>
              <p class="test-tip">انقر على زر الشات العائم بالزاوية السفلية، واسأله:</p>
              <div class="prompt-card" (click)="copyPrompt(activeScreen.sampleQuery)">
                <span>💬 "{{ activeScreen.sampleQuery }}"</span>
              </div>
            </div>
          </div>
        </aside>
      </main>

      <!-- ── The Actual Embedded Web Component / Copilot Widget ─────────── -->
      <!-- This is the exact tag that the ERP developers will embed in their screens! -->
      <lms-ai-copilot
        [attr.erp-key]="activeScreen.key"
        [attr.u]="'admin'"
        [attr.p]="'admin'"
        [attr.api-url]="'http://localhost:8000'">
      </lms-ai-copilot>
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
      padding: 20px 24px;
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 20px;
      max-width: 1400px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
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

    /* ── Sidebar ───────────────────────────────────────── */
    .sidebar-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .sidebar-card h3 {
      font-size: 14px;
      margin: 0 0 12px 0;
      color: #0f172a;
    }
    .specs-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .specs-list li {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 11px;
    }
    .specs-list li strong { color: #64748b; font-size: 10px; text-transform: uppercase; }
    .specs-list li span { color: #1e293b; font-weight: 600; }
    .active-key-pill {
      background: #eff6ff;
      color: #2563eb;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid #bfdbfe;
      font-family: monospace;
      font-size: 11px;
      display: inline-block;
      width: fit-content;
    }
    .divider {
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 16px 0;
    }
    .test-helper-box h4 {
      font-size: 12px;
      margin: 0 0 4px 0;
      color: #1e293b;
    }
    .test-tip {
      font-size: 11px;
      color: #64748b;
      margin: 0 0 8px 0;
    }
    .prompt-card {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 11px;
      color: #3b82f6;
      cursor: pointer;
      transition: all 0.15s;
    }
    .prompt-card:hover {
      background: #eff6ff;
      border-color: #93c5fd;
    }
  `]
})
export class ErpMockComponent implements OnInit {
  authService = inject(AuthService);

  erpScreens: ErpScreen[] = [
    {
      key: 'SALES_INVOICE',
      name: 'فاتورة المبيعات',
      category: 'المبيعات والعملاء',
      description: 'شاشة إصدار فواتير المبيعات للعملاء واحتساب ضريبة القيمة المضافة وإرسال الفاتورة الإلكترونية.',
      sampleQuery: 'كيف أقوم بإصدار فاتورة مبيعات مع تطبيق خصم تجاري؟'
    },
    {
      key: 'PURCHASE_INVOICE',
      name: 'فاتورة المشتريات وتوريد الأصناف',
      category: 'المخازن والمشتريات',
      description: 'شاشة تسجيل أوامر التوريد وفواتير المشتريات وإثبات زيادة المخزون في المستودعات.',
      sampleQuery: 'ما هي خطوات تسجيل فاتورة شراء وإثباتها في المستودع؟'
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

  ngOnInit() {
    // If not authenticated, silent login as student for seamless testing
    if (!this.authService.isAuthenticated()) {
      const savedToken = localStorage.getItem('jwt_token');
      if (savedToken && !this.authService.isTokenExpired(savedToken)) {
        this.authService.login(savedToken);
      }
    }
  }

  switchScreen(screen: ErpScreen) {
    this.activeScreen = screen;
  }

  copyPrompt(text: string) {
    navigator.clipboard?.writeText(text);
  }
}

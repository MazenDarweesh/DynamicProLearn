import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, OnDestroy, inject, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/platform-core/auth.service';
import { CopilotService } from '../../core/services/ai-copilot/copilot.service';
import {
  ErpScreen,
  MOCK_ERP_SCREENS,
  MOCK_ERP_MODULES,
  MOCK_FILTER_CHIPS,
  MOCK_MODULE_SCREEN_MAP,
  MOCK_DEV_TOKEN
} from './erp-mock.data';

export type { ErpScreen } from './erp-mock.data';

@Component({
  selector: 'app-erp-mock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './erp-mock.component.html',
  styleUrls: ['./erp-mock.component.css']
})
export class ErpMockComponent implements OnInit, OnDestroy {
  authService = inject(AuthService);
  copilotService = inject(CopilotService);
  private cdr = inject(ChangeDetectorRef);

  isFloatingMode = false;
  isCopilotMinimized = false;
  isSpecsOpen = true;
  copiedPrompt = false;
  isClearingMockCache = false;
  mockCacheStatus: 'idle' | 'success' | 'error' = 'idle';

  erpScreens: ErpScreen[] = MOCK_ERP_SCREENS;
  activeScreen: ErpScreen = this.erpScreens[0];
  erpModules: string[] = MOCK_ERP_MODULES;
  activeModule: string = 'الجميع';
  filterChips: string[] = MOCK_FILTER_CHIPS;
  activeChip: string = 'الجميع';
  openTabs: ErpScreen[] = [];
  mockDevToken = MOCK_DEV_TOKEN;

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

  selectModule(mod: string) {
    this.activeModule = mod;
    this.cdr.detectChanges();
  }

  getScreensForActiveModule(): ErpScreen[] {
    if (!this.activeModule || this.activeModule === 'الجميع') {
      return this.erpScreens;
    }
    const allowed = MOCK_MODULE_SCREEN_MAP[this.activeModule] || [];
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

    // Expose simulated DynamicERP native bridge on window for 100% faithful local testing
    if (typeof window !== 'undefined') {
      window.DynamicERP = {
        listScreens: () => this.erpScreens.map((s, idx) => ({
          pageId: 1000 + idx,
          pageName: s.key,
          title: s.name,
          moduleId: idx + 1,
          moduleName: s.category
        })),
        getActiveScreen: () => ({
          pageId: 1000 + this.erpScreens.findIndex(s => s.key === this.activeScreen.key),
          pageName: this.activeScreen.key
        }),
        navigateToScreen: (screenNameOrId: string | number) => {
          const found = this.erpScreens.find(s =>
            s.key === screenNameOrId ||
            s.name === screenNameOrId ||
            String(1000 + this.erpScreens.indexOf(s)) === String(screenNameOrId)
          );
          if (found) {
            this.switchScreen(found);
            return true;
          }
          return false;
        },
        triggerAddNew: () => {
          this.clearCurrentScreenForm();
          return true;
        },
        submitActiveForm: () => {
          const fakeDocId = Math.floor(1000 + Math.random() * 9000).toString();
          return {
            success: true,
            docId: fakeDocId,
            message: `تم الحفظ بنجاح في محاكي الـ ERP! رقم المستند: #${fakeDocId}`
          };
        },
        isPageBusy: () => false
      };
    }
  }

  ngOnDestroy() {
    if (typeof window !== 'undefined' && window.DynamicERP) {
      delete window.DynamicERP;
    }
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

import { Injectable, inject, signal } from '@angular/core';
import { ErpFormDriverService } from './erp-form-driver.service';
import { ErpNavigatorService } from './erp-navigator.service';
import { ErpBatchItem, ErpBatchState, FormFillExecutionReport } from '../../models/erp-form.models';

@Injectable({
  providedIn: 'root'
})
export class ErpBatchStepperService {
  private formDriver = inject(ErpFormDriverService);
  private navigator = inject(ErpNavigatorService);

  readonly state = signal<ErpBatchState>({
    total: 0,
    currentIndex: 0,
    status: 'idle',
    items: [],
    autoAdvance: false
  });

  private isPaused = false;
  private isCancelled = false;
  private confirmResolver: (() => void) | null = null;

  /**
   * Starts executing a batch sequence of forms/invoices.
   */
  async startBatch(
    items: ErpBatchItem[],
    screenKey?: string,
    autoAdvance = false
  ): Promise<void> {
    if (!items || items.length === 0) return;

    this.isPaused = false;
    this.isCancelled = false;

    // Initialize state
    const normalizedItems = items.map((item, idx) => ({
      ...item,
      id: item.id || `batch_item_${idx + 1}`,
      title: item.title || `مستند ${idx + 1}`,
      status: 'pending' as const
    }));

    this.state.set({
      total: normalizedItems.length,
      currentIndex: 0,
      status: 'navigating',
      items: normalizedItems,
      autoAdvance,
      screenKey
    });

    // Step 1: Navigate to screen if specified
    if (screenKey) {
      const arrived = await this.navigator.navigateToScreen(screenKey);
      if (!arrived) {
        this.updateItemStatus(0, 'failed', undefined, 'تعذر الوصول إلى الشاشة المستهدفة');
        this.updateBatchStatus('cancelled');
        return;
      }
    }

    // Step 2: Sequential Loop over batch items
    for (let i = 0; i < normalizedItems.length; i++) {
      if (this.isCancelled) {
        this.updateBatchStatus('cancelled');
        return;
      }

      // Check if paused
      if (this.isPaused) {
        this.updateBatchStatus('paused');
        await this.waitForResume();
        if (this.isCancelled) {
          this.updateBatchStatus('cancelled');
          return;
        }
      }

      // Update current index
      this.state.update(s => ({
        ...s,
        currentIndex: i,
        status: 'filling'
      }));

      const currentItem = this.state().items[i];
      this.updateItemStatus(i, 'filling');

      // 2.0 Screen Drift Guard: Verify screen hasn't drifted before filling
      const targetScreen = this.state().screenKey;
      if (targetScreen && !this.navigator.isScreenActive(targetScreen)) {
        console.warn(`[BatchStepper] Screen drift detected before item ${i + 1}. Re-navigating to ${targetScreen}...`);
        await this.navigator.navigateToScreen(targetScreen);
        await this.delay(300);
      }

      // 2.1 Prepare fresh form (except possibly the very first if already empty)
      if (i > 0) {
        await this.navigator.prepareFreshForm();
        await this.delay(300);

        // Re-check drift after prepareFreshForm to ensure no button redirected the page
        if (targetScreen && !this.navigator.isScreenActive(targetScreen)) {
          console.warn(`[BatchStepper] Post-reset screen drift detected. Re-navigating to ${targetScreen}...`);
          await this.navigator.navigateToScreen(targetScreen);
          await this.delay(300);
        }
      }

      // 2.2 Execute Form Fill via ErpFormDriverService
      try {
        const report = await this.formDriver.applyFormFill(currentItem.fields, currentItem.rows);
        this.updateItemStatus(i, report.success ? 'completed' : 'failed', report);
      } catch (err: any) {
        this.updateItemStatus(i, 'failed', undefined, err?.message || 'حدث خطأ أثناء التعبئة');
      }

      // 2.3 Post-fill step: Either wait for human confirmation or auto-advance
      if (i < normalizedItems.length - 1) {
        if (!this.state().autoAdvance) {
          this.updateBatchStatus('waiting_confirm');
          await this.waitForUserConfirmation();
        } else {
          await this.delay(1200);
        }
      }
    }

    this.updateBatchStatus('completed');
  }

  /**
   * Pause the active batch loop.
   */
  pause(): void {
    this.isPaused = true;
    this.updateBatchStatus('paused');
  }

  /**
   * Resume the paused batch loop.
   */
  resume(): void {
    this.isPaused = false;
    this.updateBatchStatus('filling');
  }

  /**
   * Cancel and abort the batch execution.
   */
  cancel(): void {
    this.isCancelled = true;
    this.isPaused = false;
    if (this.confirmResolver) {
      this.confirmResolver();
      this.confirmResolver = null;
    }
    this.updateBatchStatus('cancelled');
  }

  /**
   * User confirmed the current item and wishes to proceed to the next item.
   */
  confirmAndNext(): void {
    if (this.confirmResolver) {
      this.confirmResolver();
      this.confirmResolver = null;
    }
  }

  /**
   * Skip current item and move to next.
   */
  skipCurrent(): void {
    const idx = this.state().currentIndex;
    this.updateItemStatus(idx, 'skipped');
    if (this.confirmResolver) {
      this.confirmResolver();
      this.confirmResolver = null;
    }
  }

  /**
   * Toggle between auto-advancing and manual stepping.
   */
  toggleAutoAdvance(enable?: boolean): void {
    this.state.update(s => ({
      ...s,
      autoAdvance: enable !== undefined ? enable : !s.autoAdvance
    }));
    if (this.state().autoAdvance && this.state().status === 'waiting_confirm') {
      this.confirmAndNext();
    }
  }

  private updateItemStatus(
    index: number,
    status: ErpBatchItem['status'],
    report?: FormFillExecutionReport,
    error?: string
  ): void {
    this.state.update(s => {
      const items = [...s.items];
      if (items[index]) {
        items[index] = {
          ...items[index],
          status,
          report: report || items[index].report,
          error: error || items[index].error
        };
      }
      return { ...s, items };
    });
  }

  private updateBatchStatus(status: ErpBatchState['status']): void {
    this.state.update(s => ({ ...s, status }));
  }

  private waitForResume(): Promise<void> {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (!this.isPaused || this.isCancelled) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 150);
    });
  }

  private waitForUserConfirmation(): Promise<void> {
    return new Promise(resolve => {
      this.confirmResolver = resolve;
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

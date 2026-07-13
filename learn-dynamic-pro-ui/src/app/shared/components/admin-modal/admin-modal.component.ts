import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * AdminModalComponent — Shared modal shell for all admin screens.
 *
 * Usage:
 * <app-admin-modal
 *   [show]="showModal"
 *   title="عنوان النافذة"
 *   subtitle="وصف اختياري"
 *   confirmLabel="حفظ"
 *   [loading]="isSaving"
 *   [confirmDisabled]="!formValid"
 *   (closed)="onClose()"
 *   (confirmed)="onSave()">
 *   <!-- Content goes here via ng-content -->
 * </app-admin-modal>
 */
@Component({
  selector: 'app-admin-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-modal.component.html',
  styleUrls: ['./admin-modal.component.css']
})
export class AdminModalComponent {
  /** Whether the modal is visible */
  @Input() show: boolean = false;

  /** Bold title shown in the dark header */
  @Input() title: string = '';

  /** Smaller subtitle under the title (optional) */
  @Input() subtitle: string = '';

  /** Label for the confirm button */
  @Input() confirmLabel: string = 'حفظ';

  /** Label for the cancel button */
  @Input() cancelLabel: string = 'إلغاء';

  /** CSS class for the confirm button */
  @Input() confirmButtonClass: string = 'btn-primary';

  /** Shows a spinner and disables the confirm button */
  @Input() loading: boolean = false;

  /** Disable confirm button (e.g. form invalid) */
  @Input() confirmDisabled: boolean = false;

  /** max-width of the modal container (CSS value) */
  @Input() maxWidth: string = '500px';

  /** Emitted when the user clicks cancel or the X button */
  @Output() closed = new EventEmitter<void>();

  /** Emitted when the user clicks the confirm button */
  @Output() confirmed = new EventEmitter<void>();

  close() { this.closed.emit(); }
  confirm() { if (!this.loading && !this.confirmDisabled) this.confirmed.emit(); }
}

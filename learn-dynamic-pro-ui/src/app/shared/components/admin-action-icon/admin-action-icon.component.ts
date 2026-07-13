import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-action-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button *ngIf="action === 'edit'" class="icon-btn text-secondary" [title]="title || 'تعديل'" (click)="onClick($event)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    </button>
    
    <button *ngIf="action === 'delete'" class="icon-btn text-danger" [title]="title || 'حذف'" (click)="onClick($event)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18"></path>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    </button>
  `,
  styles: [`
    .icon-btn {
      background: none;
      border: none;
      padding: 6px;
      cursor: pointer;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    
    .icon-btn:hover {
      background-color: var(--color-surface);
    }
    
    .text-secondary {
      color: var(--color-text-secondary);
    }
    
    .text-secondary:hover {
      color: var(--color-primary);
    }
    
    .text-danger {
      color: #dc3545; /* Bootstrap danger color or use a variable */
    }
    
    .text-danger:hover {
      background-color: rgba(220, 53, 69, 0.1);
      color: #c82333;
    }
  `]
})
export class AdminActionIconComponent {
  @Input() action!: 'edit' | 'delete';
  @Input() title?: string;
  @Output() clicked = new EventEmitter<Event>();

  onClick(event: Event) {
    event.stopPropagation();
    this.clicked.emit(event);
  }
}

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-action-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-action-button.component.html',
  styleUrls: ['./admin-action-button.component.css']
})
export class AdminActionButtonComponent {
  @Input() label: string = 'إضافة';
  @Input() disabled: boolean = false;
  @Output() clicked = new EventEmitter<void>();

  onClick() {
    if (!this.disabled) this.clicked.emit();
  }
}

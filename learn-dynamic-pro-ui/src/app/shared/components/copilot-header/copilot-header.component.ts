import { Component, Input, Output, EventEmitter, booleanAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-copilot-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './copilot-header.component.html',
  styleUrls: ['./copilot-header.component.css']
})
export class CopilotHeaderComponent {
  @Input({ transform: booleanAttribute }) isMinimized = false;
  @Input({ transform: booleanAttribute }) isAiReady = true;
  @Input({ transform: booleanAttribute }) isWarmingUp = false;
  @Input({ transform: booleanAttribute }) hasConnectionError = false;

  @Output() toggleMinimize = new EventEmitter<void>();
  @Output() clearHistory = new EventEmitter<void>();

  onToggle() {
    this.toggleMinimize.emit();
  }

  onClear() {
    this.clearHistory.emit();
  }
}

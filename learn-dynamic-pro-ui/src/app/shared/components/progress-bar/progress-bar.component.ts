import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="progress-container" [style.width]="width">
      <span class="text-sm text-secondary" style="white-space: nowrap;">
        {{ completed }} / {{ total }}
      </span>
      <div class="progress-bar">
        <div class="progress-fill" [style.width]="(percentage || 0) + '%'" [style.background-color]="color"></div>
      </div>
      <span class="text-sm text-secondary" style="min-width: 35px; text-align: right;">
        {{ percentage || 0 }}%
      </span>
    </div>
  `,
  styles: [`
    .progress-container {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .progress-bar {
      flex: 1;
      height: 8px;
      background-color: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .text-sm {
      font-size: 0.875rem;
    }
    .text-secondary {
      color: #64748b;
    }
  `]
})
export class ProgressBarComponent {
  @Input() completed: number = 0;
  @Input() total: number = 0;
  @Input() width: string = '180px';
  @Input() color: string = '#f58220'; // Primary brand color
  @Input() customPercentage?: number;

  get percentage(): number {
    if (this.customPercentage !== undefined) {
      return this.customPercentage;
    }
    if (this.total === 0) return 0;
    return Math.round((this.completed / this.total) * 100 * 10) / 10;
  }
}

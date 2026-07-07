import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { TesterService, ErpVersionDto } from '../../../core/services/tester.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-feedback-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-container">
      <header class="header">
        <div>
          <h2>QA & Tester Portal</h2>
          <p class="subtitle">Report issues and submit feedback for ERP versions</p>
        </div>
        <button class="btn-primary" style="background: var(--color-border); color: var(--color-text-primary);" (click)="logout()">Logout</button>
      </header>

      <div class="content grid">
        <!-- Version Selection -->
        <div class="card">
          <h3>1. Select ERP Version</h3>
          <p class="text-secondary">Choose the version you are currently testing.</p>
          
          <div *ngIf="isLoadingVersions" class="text-secondary mt-2">Loading versions...</div>
          
          <select *ngIf="!isLoadingVersions" [(ngModel)]="selectedVersionId" class="form-control">
            <option value="" disabled>-- Select Version --</option>
            <option *ngFor="let v of versions" [value]="v.id">{{ v.versionNumber }} ({{ v.releaseDate | date }})</option>
          </select>
          
          <div *ngIf="!isLoadingVersions && versions.length === 0" class="text-danger mt-2">
            No active versions found to test.
          </div>
        </div>

        <!-- Feedback Form -->
        <div class="card" [class.disabled-card]="!selectedVersionId">
          <h3>2. Submit Feedback</h3>
          
          <form (ngSubmit)="submitFeedback()">
            <div class="form-group">
              <label>Issue Severity</label>
              <select [(ngModel)]="severity" name="severity" class="form-control" [disabled]="!selectedVersionId">
                <option [ngValue]="1">Low (UI/UX)</option>
                <option [ngValue]="2">Medium (Functional)</option>
                <option [ngValue]="3">High (Crash/Blocker)</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Detailed Notes</label>
              <textarea [(ngModel)]="notes" name="notes" class="form-control" rows="4" placeholder="Describe the issue in detail..." [disabled]="!selectedVersionId"></textarea>
            </div>
            
            <button type="submit" class="btn-primary" [disabled]="!selectedVersionId || isSubmitting || !notes">
              {{ isSubmitting ? 'Submitting...' : 'Submit Report' }}
            </button>
            
            <div *ngIf="successMessage" class="success-msg mt-3">{{ successMessage }}</div>
            <div *ngIf="errorMessage" class="error-msg mt-3">{{ errorMessage }}</div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container { padding: 40px; max-width: 1000px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
    .header h2 { margin-bottom: 5px; font-size: 28px; }
    .subtitle { color: var(--color-text-secondary); margin: 0; }
    
    .grid { display: grid; grid-template-columns: 1fr 2fr; gap: 30px; align-items: flex-start; }
    
    .form-control { width: 100%; padding: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-btn); background-color: var(--color-bg-page); color: var(--color-text-primary); font-family: 'Readex Pro', sans-serif; margin-top: 8px; }
    .form-control:focus { outline: none; border-color: var(--color-primary); }
    
    .form-group { margin-bottom: 20px; }
    .form-group label { font-weight: 500; font-size: 14px; }
    
    .disabled-card { opacity: 0.6; pointer-events: none; }
    .mt-2 { margin-top: 10px; }
    .mt-3 { margin-top: 15px; }
    
    .text-secondary { color: var(--color-text-secondary); }
    .text-danger { color: var(--color-danger); }
    .success-msg { color: #137333; background: #E6F4EA; padding: 10px; border-radius: 8px; text-align: center; font-size: 14px; font-weight: 500; }
    .error-msg { color: var(--color-danger); font-size: 14px; text-align: center; }
  `]
})
export class FeedbackPanel implements OnInit {
  private auth = inject(AuthService);
  private testerService = inject(TesterService);
  private router = inject(Router);

  versions: ErpVersionDto[] = [];
  isLoadingVersions = true;
  
  selectedVersionId = '';
  severity = 1;
  notes = '';
  isSubmitting = false;
  
  successMessage = '';
  errorMessage = '';

  ngOnInit() {
    this.testerService.getVersions().subscribe({
      next: (data) => {
        this.versions = data;
        this.isLoadingVersions = false;
      },
      error: () => {
        this.isLoadingVersions = false;
      }
    });
  }

  submitFeedback() {
    if (!this.selectedVersionId || !this.notes) return;
    
    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessage = '';
    
    // Using a dummy ConditionOptionId for demo purposes
    const request = {
      testerActiveVersionId: this.selectedVersionId,
      conditionOptionId: '00000000-0000-0000-0000-000000000001', 
      notes: this.notes,
      severity: this.severity
    };

    this.testerService.submitFeedback(request).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = 'Feedback submitted successfully!';
        this.notes = '';
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.detail || 'Failed to submit feedback. Ensure active version exists.';
      }
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/platform-core/auth.service';

@Component({
  selector: 'app-erp-redirect',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="redirect-container">
      <div class="loader"></div>
      <h2>جاري تسجيل الدخول وتحويلك...</h2>
      <p>يرجى الانتظار لحظات</p>
    </div>
  `,
  styles: [`
    .redirect-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background-color: var(--color-bg-page, #f8fafc);
      font-family: 'Readex Pro', sans-serif;
      text-align: center;
    }
    h2 { color: var(--color-navy, #1e293b); margin-bottom: 10px; }
    p { color: var(--color-text-secondary, #64748b); }
    .loader {
      border: 4px solid rgba(0,0,0,0.1);
      border-left-color: var(--color-primary, #4338ca);
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  `]
})
export class ErpRedirectComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  ngOnInit(): void {
    const u = this.route.snapshot.queryParamMap.get('u');
    const p = this.route.snapshot.queryParamMap.get('p');
    const key = this.route.snapshot.queryParamMap.get('key');

    if (!u || !p) {
      this.router.navigate(['/login']);
      return;
    }

    this.authService.erpLogin(u, p, key).subscribe({
      next: (res: any) => {
        // Store tokens locally
        this.authService.login(res.token, res.refreshToken);
        
        // Handle redirect
        if (res.erpRedirect && res.erpRedirect.moduleId) {
          // Open lesson directly
          // Assuming lesson-viewer can take lessonId as query param or handles it inside
          this.router.navigate(['/student/lesson', res.erpRedirect.moduleId], { 
            queryParams: { lessonId: res.erpRedirect.lessonId } 
          });
        } else {
          // No key or lesson not found, go to dashboard
          this.router.navigate(['/student']);
        }
      },
      error: (err: any) => {
        console.error('ERP Login failed', err);
        this.router.navigate(['/login'], { queryParams: { error: 'erp_failed' } });
      }
    });
  }
}

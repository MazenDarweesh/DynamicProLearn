import { Component, inject, Input } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-admin-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-header.component.html',
  styleUrls: ['./admin-header.component.css']
})
export class AdminHeaderComponent {
  private router = inject(Router);
  private authService = inject(AuthService);
  private location = inject(Location);

  @Input() title?: string;
  @Input() subtitle?: string;
  @Input() showBackBtn = false;
  @Input() backUrl?: string;

  currentRoute = '';
  userRole = this.authService.userRole;
  userName = this.authService.userName;

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentRoute = event.urlAfterRedirects;
    });
  }

  ngOnInit() {
    this.currentRoute = this.router.url;
  }

  goTo(path: string) {
    this.router.navigate([path]);
  }

  goToStudentTab(tab: 'resume' | 'browse') {
    this.router.navigate(['/student'], { queryParams: { tab } });
  }

  isStudentTabActive(tab: 'resume' | 'browse'): boolean {
    if (tab === 'resume') {
      return this.currentRoute.includes('tab=resume') || this.currentRoute === '/student';
    } else {
      return this.currentRoute.includes('tab=browse') || this.currentRoute.includes('/student/lesson/');
    }
  }

  goBack() {
    if (this.backUrl) {
      this.router.navigateByUrl(this.backUrl);
    } else {
      this.location.back();
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

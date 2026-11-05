import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { CopilotChatComponent } from './shared/components/copilot-chat/copilot-chat.component';
import { AuthService } from './core/services/platform-core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CopilotChatComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'learn-dynamic-pro-ui';
  authService = inject(AuthService);
  private router = inject(Router);

  private currentUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map((e: any) => e.urlAfterRedirects || e.url),
      startWith(this.router.url)
    )
  );

  get canShowCopilot(): boolean {
    const url = this.currentUrl() || window.location.pathname;
    const isAuthRoute = url.includes('/login') || url.includes('/erp-redirect') || url.includes('/erp-mock');
    return this.authService.isAuthenticated() && !isAuthRoute;
  }
}

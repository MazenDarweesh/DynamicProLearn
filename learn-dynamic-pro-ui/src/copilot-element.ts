import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { provideZoneChangeDetection, provideExperimentalZonelessChangeDetection, ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideMarkdown } from 'ngx-markdown';
import { CopilotChatComponent } from './app/shared/components/copilot-chat/copilot-chat.component';
import { jwtInterceptor } from './app/core/interceptors/jwt.interceptor';

// Flag embedded environment immediately
if (typeof window !== 'undefined') {
  (window as any).__LMS_COPILOT_EMBEDDED__ = true;
}

// Zone / Zoneless change detection provider
const changeDetectionProvider = typeof (window as any)?.Zone !== 'undefined'
  ? provideZoneChangeDetection({ eventCoalescing: true })
  : provideExperimentalZonelessChangeDetection();

/**
 * Isolated Application Config for LMS Copilot Custom Element.
 * Completely free of provideRouter(routes) to avoid hijacking host app navigation.
 */
const copilotElementConfig: ApplicationConfig = {
  providers: [
    changeDetectionProvider,
    provideHttpClient(withInterceptors([jwtInterceptor])),
    provideMarkdown()
  ]
};

// Auto-register Custom Elements when loaded
createApplication(copilotElementConfig)
  .then((appRef) => {
    const customTags = ['lms-ai-copilot', 'app-lms-copilot', 'app-copilot-chat'];
    for (const tag of customTags) {
      if (!customElements.get(tag)) {
        const copilotElement = createCustomElement(CopilotChatComponent, {
          injector: appRef.injector
        });
        customElements.define(tag, copilotElement);
        console.info(
          `%c[LMS AI Copilot] <${tag}> registered successfully (No Router / Isolated Providers)`,
          'color:#10b981;font-weight:bold'
        );
      }
    }
  })
  .catch((err) => {
    console.error('[LMS AI Copilot Init Error]:', err);
  });

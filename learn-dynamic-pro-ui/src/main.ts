import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Check strictly for our LMS standalone app element
// A generic 'app-root' query causes collision with host Angular applications (e.g., ERP)
const lmsRootEl = document.querySelector('app-root[data-lms-app]') || document.querySelector('lms-standalone-app');
const isExplicitlyEmbedded = !!(window as any)?.__LMS_COPILOT_EMBEDDED__ || !!(window as any)?.__ERP_HOST__;
const isOurStandaloneApp = !!lmsRootEl && !isExplicitlyEmbedded;

if (isOurStandaloneApp) {
  bootstrapApplication(AppComponent, appConfig)
    .catch((err) => console.error(err));
} else {
  // Embedded mode (inside ERP or external page): dynamically load copilot custom element without bloating main bundle
  import('./copilot-element').catch((err) => console.error('[LMS AI Copilot Init Error]:', err));
}



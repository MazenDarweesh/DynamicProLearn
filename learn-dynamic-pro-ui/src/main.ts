import { bootstrapApplication, createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { CopilotChatComponent } from './app/shared/components/copilot-chat/copilot-chat.component';
import { copilotElementConfig } from './copilot-element';

function registerCopilotElement(injector: any) {
  const customTags = ['lms-ai-copilot', 'app-lms-copilot', 'app-copilot-chat'];
  for (const tag of customTags) {
    if (!customElements.get(tag)) {
      const copilotElement = createCustomElement(CopilotChatComponent, { injector });
      customElements.define(tag, copilotElement);
      console.info(`%c[LMS AI Copilot] <${tag}> registered as Web Component`, 'color:#10b981;font-weight:bold');
    }
  }
}

// Check strictly for our LMS standalone app element
// A generic 'app-root' query causes collision with host Angular applications (e.g., ERP)
const lmsRootEl = document.querySelector('app-root[data-lms-app]') || document.querySelector('lms-standalone-app');
const isExplicitlyEmbedded = !!(window as any)?.__LMS_COPILOT_EMBEDDED__ || !!(window as any)?.__ERP_HOST__;
const isOurStandaloneApp = !!lmsRootEl && !isExplicitlyEmbedded;

if (isOurStandaloneApp) {
  bootstrapApplication(AppComponent, appConfig)
    .then(appRef => registerCopilotElement(appRef.injector))
    .catch((err) => console.error(err));
} else {
  // Embedded mode (inside ERP or external page): only initialize injector and register Custom Element
  // Uses isolated copilotElementConfig (NO ROUTER) to prevent hijacking host application routes/login!
  createApplication(copilotElementConfig)
    .then(appRef => registerCopilotElement(appRef.injector))
    .catch((err) => console.error(err));
}


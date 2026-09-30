import { bootstrapApplication, createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { CopilotChatComponent } from './app/shared/components/copilot-chat/copilot-chat.component';

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

// Only bootstrap the full LMS AppComponent if running standalone on our own LMS page
const rootEl = document.querySelector('app-root');
const isOurStandaloneApp = !!(rootEl && document.title.includes('DynamicProLearn') && window.location.hostname === 'localhost' && window.location.port === '4200');

if (isOurStandaloneApp) {
  bootstrapApplication(AppComponent, appConfig)
    .then(appRef => registerCopilotElement(appRef.injector))
    .catch((err) => console.error(err));
} else {
  // Embedded mode (inside ERP or external page): only initialize injector and register Custom Element
  createApplication(appConfig)
    .then(appRef => registerCopilotElement(appRef.injector))
    .catch((err) => console.error(err));
}

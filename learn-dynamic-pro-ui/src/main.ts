import { bootstrapApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { CopilotChatComponent } from './app/shared/components/copilot-chat/copilot-chat.component';

bootstrapApplication(AppComponent, appConfig)
  .then(appRef => {
    if (!customElements.get('lms-ai-copilot')) {
      const copilotElement = createCustomElement(CopilotChatComponent, { injector: appRef.injector });
      customElements.define('lms-ai-copilot', copilotElement);
      console.info('%c[LMS AI Copilot] <lms-ai-copilot> registered as Web Component', 'color:#10b981;font-weight:bold');
    }
  })
  .catch((err) => console.error(err));

import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CopilotChatComponent } from './shared/components/copilot-chat/copilot-chat.component';
import { AuthService } from './core/services/auth.service';

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
}

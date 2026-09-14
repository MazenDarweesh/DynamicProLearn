import { Component, inject, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CopilotService, CopilotSource } from '../../../core/services/copilot.service';
import { AuthService } from '../../../core/services/auth.service';

export interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  sources?: CopilotSource[];
  rating?: 'up' | 'down';
  feedbackSubmitted?: boolean;
  isStreaming?: boolean;
}

@Component({
  selector: 'app-copilot-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './copilot-chat.component.html',
  styleUrls: ['./copilot-chat.component.css']
})
export class CopilotChatComponent implements AfterViewChecked {
  private copilotService = inject(CopilotService);
  authService = inject(AuthService);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  isOpen = false;
  isMinimized = false;
  inputQuery = '';
  isStreaming = false;

  messages: ChatMessage[] = [
    {
      sender: 'assistant',
      text: 'مرحباً بك! أنا مساعدك الذكي في منصة DynamicProLearn. اسألني أي سؤال عن دروس وموديولات النظام وسأجيبك مباشرة من واقع الفيديوهات والمحتوى التعليمي! ✨'
    }
  ];

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.isMinimized = false;
    }
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
  }

  closeChat() {
    this.isOpen = false;
  }

  scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) {}
  }

  async sendMessage() {
    const query = this.inputQuery.trim();
    if (!query || this.isStreaming) return;

    // Add user message
    this.messages.push({
      sender: 'user',
      text: query
    });

    this.inputQuery = '';
    this.isStreaming = true;

    // Create assistant message placeholder
    const assistantMsgIndex = this.messages.length;
    this.messages.push({
      sender: 'assistant',
      text: '',
      sources: [],
      isStreaming: true
    });

    await this.copilotService.streamSearch(
      query,
      undefined,
      (sources: CopilotSource[]) => {
        this.messages[assistantMsgIndex].sources = sources;
      },
      (token: string) => {
        this.messages[assistantMsgIndex].text += token;
      },
      () => {
        this.messages[assistantMsgIndex].isStreaming = false;
        this.isStreaming = false;
      },
      (err: any) => {
        this.messages[assistantMsgIndex].text += '\n\n⚠️ تعذر إكمال الإجابة. يرجى التأكد من تشغيل محرك الذكاء الاصطناعي.';
        this.messages[assistantMsgIndex].isStreaming = false;
        this.isStreaming = false;
      }
    );
  }

  rateAnswer(msgIndex: number, rating: 'up' | 'down') {
    const msg = this.messages[msgIndex];
    if (msg.feedbackSubmitted) return;

    // Find the prior user query
    let userQuery = '';
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (this.messages[i].sender === 'user') {
        userQuery = this.messages[i].text;
        break;
      }
    }

    msg.rating = rating;
    msg.feedbackSubmitted = true;

    this.copilotService.sendFeedback({
      query: userQuery || 'استفسار عام',
      answer: msg.text,
      rating: rating,
      sources: msg.sources || []
    }).subscribe({
      next: () => {},
      error: () => {}
    });
  }
}

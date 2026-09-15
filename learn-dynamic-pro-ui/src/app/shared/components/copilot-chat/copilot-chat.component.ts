import { Component, inject, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownComponent } from 'ngx-markdown';
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
  imports: [CommonModule, FormsModule, MarkdownComponent],
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

  /**
   * Removes duplicate sources based on URL + start time combination.
   */
  deduplicateSources(sources: CopilotSource[]): CopilotSource[] {
    const seen = new Set<string>();
    return sources.filter(src => {
      const key = `${src.url ?? ''}::${src.start ?? 0}::${src.end ?? 0}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Formats seconds into MM:SS or HH:MM:SS display format.
   */
  formatTimestamp(seconds?: number): string {
    if (seconds == null || seconds < 0) return '';
    const totalSeconds = Math.floor(seconds);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Builds a YouTube URL that seeks to the given start time.
   */
  buildSourceUrl(src: CopilotSource): string {
    if (!src.url) return '#';
    try {
      const url = new URL(src.url);
      // Only add t= if not already set by the server
      if (src.start != null && src.start > 0 && !url.searchParams.has('t')) {
        url.searchParams.set('t', `${src.start}s`);
      }
      return url.toString();
    } catch {
      return src.url;
    }
  }

  /**
   * Returns a clean, friendly display label for a source chip.
   * Avoids showing raw video IDs, file extensions, or system hashes.
   */
  formatSourceLabel(src: CopilotSource, index: number): string {
    const rawTitle = src.lesson_title || src.title;
    if (rawTitle && !this.isRawFileNameOrId(rawTitle)) {
      return rawTitle;
    }

    if (src.type === 'video' || (src.url && (src.url.includes('youtu') || src.url.includes('video')))) {
      return `مقطع فيديو تعليمي ${index + 1}`;
    }

    if (src.type === 'pdf') {
      if (src.page != null) {
        return `مستند دراسي (صفحة ${src.page})`;
      }
      return `مستند دراسي ${index + 1}`;
    }

    return `مصدر تعليمي ${index + 1}`;
  }

  private isRawFileNameOrId(str: string): boolean {
    return /\.(mp4|mkv|avi|webm|mov|flv|pdf|docx|txt)$/i.test(str)
      || /^lesson_[a-zA-Z0-9_-]+$/i.test(str)
      || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
      || /^[a-zA-Z0-9_-]{11}$/.test(str);
  }

  /**
   * Transforms raw message text citations like [1], [1, 2], [1][2] into markdown links
   * pointing directly to the corresponding source URL with timestamp.
   * If a citation index exceeds available sources, preserves it gracefully without broken links.
   */
  renderMessageText(msg: ChatMessage): string {
    if (!msg.text) return '';
    if (!msg.sources || msg.sources.length === 0) return msg.text;

    // Matches bracketed citations e.g. [1], [1, 2], [1, 2, 3] or 【1】
    const citationRegex = /\[([0-9]+(?:\s*,\s*[0-9]+)*)\]/g;

    return msg.text.replace(citationRegex, (match, group) => {
      const numbers = group.split(',').map((s: string) => parseInt(s.trim(), 10));
      const formattedLinks = numbers.map((num: number) => {
        const sourceIndex = num - 1;
        if (sourceIndex >= 0 && sourceIndex < msg.sources!.length) {
          const src = msg.sources![sourceIndex];
          const url = this.buildSourceUrl(src);
          const label = this.formatSourceLabel(src, sourceIndex);
          return `[\[${num}\]](${url} "${label}")`;
        }
        // Graceful fallback for hallucinated citation indices
        return `[${num}]`;
      });
      return formattedLinks.join(' ');
    });
  }

  /**
   * Intercepts clicks on markdown links in message bubbles to open them
   * in a new tab and prevent in-app route changes.
   */
  onBubbleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href && !anchor.href.endsWith('#')) {
      event.preventDefault();
      event.stopPropagation();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Opens a source URL in a new tab.
   */
  openSource(src: CopilotSource): void {
    const url = this.buildSourceUrl(src);
    if (url && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
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
        this.messages[assistantMsgIndex].sources = this.deduplicateSources(sources);
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

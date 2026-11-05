import { Injectable, inject } from '@angular/core';
import { AuthService } from '../platform-core/auth.service';

@Injectable({
  providedIn: 'root'
})
export class CopilotNetworkService {
  private authService = inject(AuthService);

  private _aiBaseUrl = this.detectDefaultAiUrl();
  private _backendBaseUrl = this.detectDefaultBackendUrl();

  get aiBaseUrl(): string {
    return this._aiBaseUrl;
  }

  get backendBaseUrl(): string {
    return this._backendBaseUrl;
  }

  normalizeTunnelUrl(url: string): string {
    let clean = url.trim().replace(/[<>]/g, '').replace(/\/+$/, '');
    if (clean.includes('.devtunnels.ms')) {
      clean = clean.replace(/^http:\/\//i, 'https://').replace(/:80(?=\/|$)/, '');
      if (!clean.startsWith('http')) {
        clean = 'https://' + clean;
      }
    }
    return clean;
  }

  detectDefaultAiUrl(): string {
    if (typeof window !== 'undefined') {
      const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
      const tunnelScript = scripts.find(s => s.src && s.src.includes('.devtunnels.ms'));
      if (tunnelScript) {
        try {
          const parsed = new URL(tunnelScript.src);
          return `https://${parsed.host.replace(/-(?:4200|5115)\./, '-8000.')}`;
        } catch {}
      }
      if (window.location.host.includes('.devtunnels.ms')) {
        return `https://${window.location.host.replace(/-(?:4200|5115)\./, '-8000.')}`;
      }
    }
    return 'http://localhost:8000';
  }

  detectDefaultBackendUrl(): string {
    if (typeof window !== 'undefined') {
      const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
      const tunnelScript = scripts.find(s => s.src && s.src.includes('.devtunnels.ms'));
      if (tunnelScript) {
        try {
          const parsed = new URL(tunnelScript.src);
          const backendUrl = `https://${parsed.host.replace(/-(?:4200|8000)\./, '-5115.')}`;
          this.authService.setBackendUrl(backendUrl);
          return backendUrl;
        } catch {}
      }
      if (window.location.host.includes('.devtunnels.ms')) {
        const backendUrl = `https://${window.location.host.replace(/-(?:4200|8000)\./, '-5115.')}`;
        this.authService.setBackendUrl(backendUrl);
        return backendUrl;
      }
    }
    return '';
  }

  setBaseUrls(aiUrl?: string, backendUrl?: string): void {
    if (aiUrl) {
      const cleanAi = this.normalizeTunnelUrl(aiUrl);
      if (cleanAi) {
        this._aiBaseUrl = cleanAi;
      }
    }
    if (backendUrl) {
      const cleanBackend = this.normalizeTunnelUrl(backendUrl);
      if (cleanBackend) {
        this._backendBaseUrl = cleanBackend;
        this.authService.setBackendUrl(cleanBackend);
      }
    }
  }

  getAiBaseUrl(): string {
    return this._aiBaseUrl;
  }
}

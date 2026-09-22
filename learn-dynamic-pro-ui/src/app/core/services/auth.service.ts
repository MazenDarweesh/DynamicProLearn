import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  
  readonly token = signal<string | null>(this.getValidInitialToken());
  readonly refreshTokenValue = signal<string | null>(localStorage.getItem('refresh_token'));
  readonly userRole = signal<string | null>(this.extractRole(this.token()));
  readonly userName = signal<string | null>(this.extractName(this.token()));

  readonly isAuthenticated = computed(() => {
    const t = this.token();
    return !!t && !this.isTokenExpired(t);
  });

  erpLogin(username: string, password: string, erpKey: string | null) {
    return this.http.post<any>('/api/Auth/erp-login', { username, password, erpKey });
  }

  login(token: string, refreshToken?: string) {
    localStorage.setItem('jwt_token', token);
    this.token.set(token);
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
      this.refreshTokenValue.set(refreshToken);
    }
    this.userRole.set(this.extractRole(token));
    this.userName.set(this.extractName(token));
  }

  logout() {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('refresh_token');
    this.token.set(null);
    this.refreshTokenValue.set(null);
    this.userRole.set(null);
    this.userName.set(null);
  }

  refreshToken(): Observable<any> {
    const token = this.token();
    const refreshToken = this.refreshTokenValue();
    return this.http.post<any>('/api/Auth/refresh-token', { token, refreshToken }).pipe(
      tap((res: any) => {
        if (res && res.token) {
          this.login(res.token, res.refreshToken);
        }
      })
    );
  }

  private decodeJwtPayload(token: string): any {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  }

  private extractRole(token: string | null): string | null {
    if (!token) return null;
    try {
      const decoded = this.decodeJwtPayload(token);
      return decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || decoded.role || null;
    } catch {
      return null;
    }
  }

  private extractName(token: string | null): string | null {
    if (!token) return null;
    try {
      const decoded = this.decodeJwtPayload(token);
      return decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || decoded.name || decoded.unique_name || null;
    } catch {
      return null;
    }
  }

  isTokenExpired(token: string | null): boolean {
    if (!token) return true;
    try {
      const decoded = this.decodeJwtPayload(token);
      if (!decoded || !decoded.exp) return false;
      return decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  private getValidInitialToken(): string | null {
    const token = localStorage.getItem('jwt_token');
    if (!token) return null;
    if (this.isTokenExpired(token)) {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('refresh_token');
      return null;
    }
    return token;
  }
}

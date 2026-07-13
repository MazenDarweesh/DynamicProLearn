import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  readonly token = signal<string | null>(localStorage.getItem('jwt_token'));
  readonly userRole = signal<string | null>(this.extractRole(this.token()));
  readonly userName = signal<string | null>(this.extractName(this.token()));

  login(token: string) {
    localStorage.setItem('jwt_token', token);
    this.token.set(token);
    this.userRole.set(this.extractRole(token));
    this.userName.set(this.extractName(token));
  }

  logout() {
    localStorage.removeItem('jwt_token');
    this.token.set(null);
    this.userRole.set(null);
    this.userName.set(null);
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
}

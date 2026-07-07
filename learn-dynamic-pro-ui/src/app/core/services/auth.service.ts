import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Signal to hold the current token
  readonly token = signal<string | null>(localStorage.getItem('jwt_token'));
  
  // Signal to hold the user role extracted from token
  readonly userRole = signal<string | null>(this.extractRole(this.token()));

  login(token: string) {
    localStorage.setItem('jwt_token', token);
    this.token.set(token);
    this.userRole.set(this.extractRole(token));
  }

  logout() {
    localStorage.removeItem('jwt_token');
    this.token.set(null);
    this.userRole.set(null);
  }

  private extractRole(token: string | null): string | null {
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      // Standard JWT role claim or custom role claim
      return decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || decoded.role || null;
    } catch {
      return null;
    }
  }
}

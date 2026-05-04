import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthTokens, User } from '../models';

const KEYS = { access: 'wb_at', refresh: 'wb_rt' } as const;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly base = `${environment.apiUrl}/api/v1/auth`;

  private _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user());

  register(email: string, username: string, password: string, preferredLanguage: string) {
    return this.http.post<AuthTokens>(`${this.base}/register`, { email, username, password, preferred_language: preferredLanguage }).pipe(
      tap(tokens => this._storeTokens(tokens))
    );
  }

  login(email: string, password: string) {
    return this.http.post<AuthTokens>(`${this.base}/login`, { email, password }).pipe(
      tap(tokens => this._storeTokens(tokens))
    );
  }

  refresh() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return throwError(() => new Error('No refresh token'));
    return this.http.post<AuthTokens>(`${this.base}/refresh`, { refresh_token: refreshToken }).pipe(
      tap(tokens => this._storeTokens(tokens))
    );
  }

  logout() {
    localStorage.removeItem(KEYS.access);
    localStorage.removeItem(KEYS.refresh);
    this._user.set(null);
    this.router.navigate(['/auth/login']);
  }

  setUser(user: User) { this._user.set(user); }
  getAccessToken() { return localStorage.getItem(KEYS.access); }
  getRefreshToken() { return localStorage.getItem(KEYS.refresh); }
  hasToken() { return !!this.getAccessToken(); }

  private _storeTokens(tokens: AuthTokens) {
    localStorage.setItem(KEYS.access, tokens.accessToken);
    localStorage.setItem(KEYS.refresh, tokens.refreshToken);
  }
}

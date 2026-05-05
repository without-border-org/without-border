import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import Keycloak from 'keycloak-js';
import { Observable, firstValueFrom, from, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models';

/**
 * Authentication Service
 *
 * Wraps the Keycloak instance (injected directly via DI from provideKeycloak).
 * - Normal mode: delegates all auth to Keycloak
 * - AUTH_DISABLED mode: bypasses Keycloak, direct DB access
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private keycloak = inject(Keycloak);
  private http = inject(HttpClient);
  private router = inject(Router);

  private _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user() || environment.authDisabled);

  async loadCurrentUser(): Promise<User | null> {
    if (environment.authDisabled) {
      const u = await firstValueFrom(
        this.http.get<User>(`${environment.apiUrl}/api/v1/users/me`)
      );
      this._user.set(u);
      return u;
    }

    if (!this.keycloak.authenticated) {
      return null;
    }

    const u = await firstValueFrom(
      this.http.get<User>(`${environment.apiUrl}/api/v1/users/me`)
    );
    this._user.set(u);
    return u;
  }

  login(): void {
    if (environment.authDisabled) return;
    this.keycloak.login({ redirectUri: window.location.origin });
  }

  logout(): void {
    this._user.set(null);
    if (environment.authDisabled) {
      this.router.navigate(['/']);
      return;
    }
    this.keycloak.logout({ redirectUri: window.location.origin });
  }

  async getToken(): Promise<string | null> {
    if (environment.authDisabled) return null;
    return this.keycloak.token ?? null;
  }

  setUser(user: User) {
    this._user.set(user);
  }

  hasToken(): boolean {
    if (environment.authDisabled) return true;
    return !!this.keycloak.token;
  }

  getAccessToken(): string | null {
    if (environment.authDisabled) return null;
    return this.keycloak.token ?? null;
  }

  refresh(): Observable<string | null> {
    if (environment.authDisabled) return of(null);
    return from(this.keycloak.updateToken(-1)).pipe(
      switchMap(() => of(this.keycloak.token ?? null))
    );
  }
}

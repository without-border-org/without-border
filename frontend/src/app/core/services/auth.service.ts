import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import Keycloak from 'keycloak-js';
import { Observable, firstValueFrom, from, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models';

function mapUser(raw: Record<string, unknown>): User {
  return {
    id: raw['id'] as string,
    email: (raw['email'] as string) ?? '',
    username: raw['username'] as string,
    preferredLanguage: ((raw['preferred_language'] ?? raw['preferredLanguage']) as string) || 'fr',
    status: ((raw['status'] as string) || 'active') as User['status'],
    agenticEnabled: (raw['agentic_enabled'] ?? raw['agenticEnabled'] ?? false) as boolean,
    agenticPersona: (raw['agentic_persona'] ?? raw['agenticPersona']) as string | undefined,
    avatarUrl: (raw['avatar_url'] ?? raw['avatarUrl']) as string | undefined,
    createdAt: (raw['created_at'] ?? raw['createdAt']) as string,
  };
}
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
      const raw = await firstValueFrom(
        this.http.get<Record<string, unknown>>(`${environment.apiUrl}/api/v1/users/me`)
      );
      const u = mapUser(raw);
      this._user.set(u);
      return u;
    }

    if (!this.keycloak.authenticated) {
      return null;
    }

    const raw = await firstValueFrom(
      this.http.get<Record<string, unknown>>(`${environment.apiUrl}/api/v1/users/me`)
    );
    const u = mapUser(raw);
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

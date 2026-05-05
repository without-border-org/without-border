import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { Observable, firstValueFrom, from, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models';

/**
 * Authentication Service
 * 
 * Wraps Keycloak authentication via keycloak-angular.
 * - Mode normal: delegates all auth to Keycloak
 * - Mode AUTH_DISABLED: bypasses Keycloak, direct DB access
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private keycloak = inject(KeycloakService);
  private http = inject(HttpClient);
  private router = inject(Router);

  private _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user() || environment.authDisabled);

  /**
   * Load current user from /api/v1/users/me
   * 
   * This method is called on app initialization to populate the user signal.
   * In Keycloak mode, this triggers lazy-sync on the backend.
   * In AUTH_DISABLED mode, this returns the bypass user.
   */
  async loadCurrentUser(): Promise<User | null> {
    if (environment.authDisabled) {
      const u = await firstValueFrom(
        this.http.get<User>(`${environment.apiUrl}/api/v1/users/me`)
      );
      this._user.set(u);
      return u;
    }

    if (!(await this.keycloak.isLoggedIn())) {
      return null;
    }

    const u = await firstValueFrom(
      this.http.get<User>(`${environment.apiUrl}/api/v1/users/me`)
    );
    this._user.set(u);
    return u;
  }

  /**
   * Initiate Keycloak login flow
   * 
   * In AUTH_DISABLED mode, this is a no-op.
   */
  login(): void {
    if (environment.authDisabled) {
      return;
    }
    this.keycloak.login({ redirectUri: window.location.origin });
  }

  /**
   * Logout from Keycloak
   * 
   * Clears local user state and redirects to Keycloak logout endpoint.
   * In AUTH_DISABLED mode, just clears local state.
   */
  logout(): void {
    this._user.set(null);
    if (environment.authDisabled) {
      this.router.navigate(['/']);
      return;
    }
    this.keycloak.logout(window.location.origin);
  }

  /**
   * Get the current access token from Keycloak
   * 
   * Returns null if not authenticated or AUTH_DISABLED is true.
   */
  async getToken(): Promise<string | null> {
    if (environment.authDisabled) {
      return null;
    }
    return await this.keycloak.getToken();
  }

  setUser(user: User) {
    this._user.set(user);
  }

  /** Synchronous check — true if a Keycloak token is present (or AUTH_DISABLED). */
  hasToken(): boolean {
    if (environment.authDisabled) return true;
    return !!this.keycloak.getKeycloakInstance().token;
  }

  /** Synchronous token read — returns raw token string or null. */
  getAccessToken(): string | null {
    if (environment.authDisabled) return null;
    return this.keycloak.getKeycloakInstance().token ?? null;
  }

  /** Force-refresh the Keycloak token and return the new value. */
  refresh(): Observable<string | null> {
    if (environment.authDisabled) return of(null);
    const kc = this.keycloak.getKeycloakInstance();
    return from(kc.updateToken(-1)).pipe(
      switchMap(() => from(this.keycloak.getToken()))
    );
  }
}

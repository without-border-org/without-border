import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { environment } from '../../../environments/environment';

/**
 * Authentication Guard
 * 
 * Protects routes that require authentication.
 * - AUTH_DISABLED mode: always returns true
 * - Keycloak mode: checks if logged in, redirects to login if not
 */
export const authGuard: CanActivateFn = async () => {
  if (environment.authDisabled) {
    return true;
  }

  const keycloak = inject(KeycloakService);
  // With onLoad: 'login-required', Keycloak already handled the redirect
  // before Angular booted — so isLoggedIn() should always be true here.
  // This guard is kept as a safety net only.
  return keycloak.isLoggedIn();
};


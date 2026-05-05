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
  if (await keycloak.isLoggedIn()) {
    return true;
  }

  await keycloak.login({ redirectUri: window.location.href });
  return false;
};


import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import Keycloak from 'keycloak-js';
import { environment } from '../../../environments/environment';

/**
 * Authentication Guard
 *
 * With onLoad: 'login-required', Keycloak handles the redirect BEFORE Angular
 * boots (inside provideKeycloak init). By the time this guard runs, the user
 * is already authenticated. This guard is a safety net only.
 */
export const authGuard: CanActivateFn = () => {
  if (environment.authDisabled) {
    return true;
  }
  const keycloak = inject(Keycloak);
  return keycloak.authenticated ?? false;
};


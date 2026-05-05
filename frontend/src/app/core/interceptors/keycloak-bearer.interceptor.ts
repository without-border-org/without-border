import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';
import { from, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Keycloak Bearer Token Interceptor
 * 
 * Injects the Keycloak access token into Authorization header for API requests.
 * If AUTH_DISABLED is true, skips token injection.
 */
export const keycloakBearerInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip if auth is disabled
  if (environment.authDisabled) {
    return next(req);
  }

  // Only add token to requests to our API
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const keycloak = inject(KeycloakService);

  return from(keycloak.getToken()).pipe(
    switchMap(token => {
      // Add token to header if available
      const cloned = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;
      return next(cloned);
    }),
  );
};

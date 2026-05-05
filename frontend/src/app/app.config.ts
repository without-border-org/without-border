import { ApplicationConfig, APP_INITIALIZER, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { KeycloakService, KeycloakAngularModule } from 'keycloak-angular';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { keycloakBearerInterceptor } from './core/interceptors/keycloak-bearer.interceptor';

function initializeKeycloak(keycloak: KeycloakService) {
  return () => {
    if (environment.authDisabled) {
      console.log('[Keycloak] AUTH_DISABLED=true — authentication bypass');
      return Promise.resolve();
    }
    return keycloak.init({
      config: environment.keycloak,
      initOptions: {
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      },
    });
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    KeycloakService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeKeycloak,
      deps: [KeycloakService],
      multi: true,
    },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([keycloakBearerInterceptor, jwtInterceptor, errorInterceptor])),
    provideAnimations(),
  ],
};

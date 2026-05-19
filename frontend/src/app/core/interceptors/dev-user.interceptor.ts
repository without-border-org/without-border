import { inject } from '@angular/core';
import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DevUserService } from '../services/dev-user.service';

/**
 * Adds the `X-Dev-User-Id` header to every API request when AUTH_DISABLED=true.
 * The header tells the backend which seeded user to impersonate for this request.
 */
export const devUserInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  if (!environment.authDisabled) return next(req);

  const devUserSvc = inject(DevUserService);
  const userId = devUserSvc.selectedId();
  if (!userId) return next(req);

  const cloned = req.clone({
    setHeaders: { 'X-Dev-User-Id': userId },
  });
  return next(cloned);
};

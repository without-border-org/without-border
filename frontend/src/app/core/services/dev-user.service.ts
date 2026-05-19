import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models';

const STORAGE_KEY = 'wb_dev_user_id';

export interface DevUser {
  id: string;
  username: string;
  preferred_language: string;
  status: string;
  avatar_url: string | null;
}

/**
 * Dev-only service that manages the "impersonated" user in AUTH_DISABLED mode.
 * Stores the selected UUID in localStorage and exposes it as a signal.
 * Used by DevUserInterceptor (HTTP) and ChatWebSocketService (WS).
 */
@Injectable({ providedIn: 'root' })
export class DevUserService {
  private http = inject(HttpClient);

  private _selectedId = signal<string | null>(localStorage.getItem(STORAGE_KEY));
  private _users = signal<DevUser[]>([]);

  readonly selectedId = this._selectedId.asReadonly();
  readonly users = this._users.asReadonly();

  async loadUsers(): Promise<void> {
    if (!environment.authDisabled) return;
    try {
      const users = await firstValueFrom(
        this.http.get<DevUser[]>(`${environment.apiUrl}/api/v1/users/dev/list`)
      );
      this._users.set(users);
      // Default to Sophie (first seeded user) if nothing is stored
      if (!this._selectedId() && users.length > 0) {
        this.select(users[0].id);
      }
    } catch {
      // Non-blocking — app still works with default bypass user
    }
  }

  select(userId: string): void {
    localStorage.setItem(STORAGE_KEY, userId);
    this._selectedId.set(userId);
  }

  get selectedUser(): DevUser | null {
    const id = this._selectedId();
    return this._users().find(u => u.id === id) ?? null;
  }
}

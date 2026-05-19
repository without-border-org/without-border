import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, UserStatus, Notification } from '../models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private readonly base = `${environment.apiUrl}/api/v1/users`;

  private _notifications = signal<Notification[]>([]);
  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = signal<number>(0);

  loadMe() {
    return this.http.get<Record<string, unknown>>(`${this.base}/me`).pipe(
      tap(user => {
        this.auth.setUser(this._mapUser(user));
      })
    );
  }

  updateMe(payload: Partial<{ username: string; preferredLanguage: string; agenticEnabled: boolean; agenticPersona: string }>) {
    const body: Record<string, unknown> = {};
    if (payload.username !== undefined) body['username'] = payload.username.trim();
    if (payload.preferredLanguage !== undefined) body['preferred_language'] = payload.preferredLanguage;
    if (payload.agenticEnabled !== undefined) body['agentic_enabled'] = payload.agenticEnabled;
    if (payload.agenticPersona !== undefined) body['agentic_persona'] = payload.agenticPersona.trim();
    return this.http.put<Record<string, unknown>>(`${this.base}/me`, body).pipe(
      tap(user => this.auth.setUser(this._mapUser(user)))
    );
  }

  updateStatus(status: UserStatus): Observable<unknown> {
    return this.http.put<Record<string, unknown>>(`${this.base}/me/status`, { status }).pipe(
      tap(user => this.auth.setUser(this._mapUser(user)))
    );
  }

  searchUsers(query: string) {
    return this.http.get<User[]>(`${this.base}/search?q=${encodeURIComponent(query)}`);
  }

  loadNotifications() {
    return this.http.get<Record<string, unknown>[]>(`${this.base}/me/notifications`).pipe(
      tap(notifs => {
        this._notifications.set(notifs.map(n => this._mapNotif(n)));
        this.unreadCount.set(notifs.filter(n => !n['is_read']).length);
      })
    );
  }

  markAllRead() {
    return this.http.put(`${this.base}/me/notifications/read-all`, {}).pipe(
      tap(() => {
        this._notifications.update(ns => ns.map(n => ({ ...n, isRead: true })));
        this.unreadCount.set(0);
      })
    );
  }

  private _mapUser(raw: Record<string, unknown>): User {
    return {
      id: raw['id'] as string,
      email: raw['email'] as string,
      username: raw['username'] as string,
      preferredLanguage: raw['preferred_language'] as string,
      status: raw['status'] as User['status'],
      agenticEnabled: raw['agentic_enabled'] as boolean,
      agenticPersona: raw['agentic_persona'] as string | undefined,
      avatarUrl: raw['avatar_url'] as string | undefined,
      createdAt: raw['created_at'] as string,
    };
  }

  private _mapNotif(raw: Record<string, unknown>): Notification {
    return {
      id: raw['id'] as string,
      type: raw['type'] as Notification['type'],
      channelId: raw['channel_id'] as string | undefined,
      messageId: raw['message_id'] as string | undefined,
      content: raw['content'] as string | undefined,
      isRead: raw['is_read'] as boolean,
      createdAt: raw['created_at'] as string,
    };
  }
}

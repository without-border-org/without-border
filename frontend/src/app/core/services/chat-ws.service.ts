import { Injectable, inject, signal } from '@angular/core';
import { Subject, Observable, filter, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Message, WsEvent, PresenceUser } from '../models';
import { AuthService } from './auth.service';
import { MessageService } from './channel.service';
import { DevUserService } from './dev-user.service';

@Injectable({ providedIn: 'root' })
export class ChatWebSocketService {
  private auth = inject(AuthService);
  private msgSvc = inject(MessageService);
  private devUserSvc = inject(DevUserService);

  private ws: WebSocket | null = null;
  private _events$ = new Subject<WsEvent>();
  private _typingUsers = signal<Set<string>>(new Set());
  private _onlineUsers = signal<Map<string, PresenceUser>>(new Map());
  private currentChannelId: string | null = null;
  private _pendingMessages: object[] = [];
  private _connected$ = new Subject<void>();

  readonly typingUsers = this._typingUsers.asReadonly();
  readonly onlineUsers = this._onlineUsers.asReadonly();

  connect(channelId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.currentChannelId === channelId) return;
    this.disconnect();

    this.currentChannelId = channelId;
    const token = this.auth.getAccessToken();

    // Build an absolute WebSocket URL.
    // - Absolute apiUrl  (local dev):  'http://localhost:8000'  → 'ws://localhost:8000'
    //   WS path appended: '/api/v1/ws/channels/<id>'
    // - Relative apiUrl  (production): '/app/api'
    //   nginx proxies /app/api/v1/ → backend /api/v1/, so we resolve against window.location
    //   and append '/v1/ws/channels/<id>' (the '/api' part is already in the relative path)
    const apiUrl = environment.apiUrl;
    let wsBase: string;
    let wsApiPath: string;
    if (/^https?:\/\//.test(apiUrl)) {
      wsBase = apiUrl.replace(/^https/, 'wss').replace(/^http/, 'ws');
      wsApiPath = '/api/v1/ws';
    } else {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      wsBase = `${wsProtocol}://${window.location.host}${apiUrl}`;
      wsApiPath = '/v1/ws';
    }

    const tokenParam = token ? `?token=${token}` : '?token=';
    const devUserParam = environment.authDisabled
      ? `&dev_user_id=${this.devUserSvc.selectedId() ?? ''}`
      : '';
    this.ws = new WebSocket(`${wsBase}${wsApiPath}/channels/${channelId}${tokenParam}${devUserParam}`);

    this.ws.onopen = () => {
      console.log('[WS] Connected to', channelId);
      // Drain any messages queued while the connection was opening
      while (this._pendingMessages.length > 0) {
        this.ws!.send(JSON.stringify(this._pendingMessages.shift()));
      }
      this._connected$.next();
    };
    this.ws.onmessage = ({ data }) => {
      try {
        this._events$.next(JSON.parse(data));
      } catch { /* ignore */ }
    };
    this.ws.onerror = (e) => this._events$.next({ type: 'error', data: { message: 'WS error' } });
    this.ws.onclose = () => console.log('[WS] Disconnected');
  }

  disconnect(): void {
    this._pendingMessages = [];
    this.ws?.close();
    this.ws = null;
    this.currentChannelId = null;
    this._typingUsers.set(new Set());
  }

  sendMessage(content: string, parentId?: string): void {
    this._send({ type: 'message', content, ...(parentId ? { parent_id: parentId } : {}) });
  }

  sendTyping(): void {
    this._send({ type: 'typing' });
  }

  get connected$(): Observable<void> {
    return this._connected$.asObservable();
  }

  get messages$(): Observable<Message> {
    return this._events$.pipe(
      filter(e => e.type === 'message'),
      map(e => this.msgSvc.mapMessage(e.data as Record<string, unknown>))
    );
  }

  get messageTranslated$(): Observable<{ messageId: string; translatedContent: string }> {
    return this._events$.pipe(
      filter(e => e.type === 'message_translated'),
      map(e => {
        const d = e.data as Record<string, string>;
        return { messageId: d['message_id'], translatedContent: d['translated_content'] };
      })
    );
  }

  get typing$(): Observable<{ userId: string; username: string }> {
    return this._events$.pipe(
      filter(e => e.type === 'typing'),
      map(e => e.data as { userId: string; username: string })
    );
  }

  get presence$(): Observable<PresenceUser> {
    return this._events$.pipe(
      filter(e => e.type === 'presence'),
      map(e => {
        const d = e.data as Record<string, string>;
        return { userId: d['user_id'], username: d['username'], status: d['status'] as 'online' | 'offline' };
      })
    );
  }

  private _send(payload: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else if (this.ws?.readyState === WebSocket.CONNECTING) {
      // Queue and flush once onopen fires
      this._pendingMessages.push(payload);
    }
  }
}

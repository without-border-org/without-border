import { Injectable, inject, signal } from '@angular/core';
import { Subject, Observable, filter, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Message, WsEvent, PresenceUser } from '../models';
import { AuthService } from './auth.service';
import { MessageService } from './channel.service';

@Injectable({ providedIn: 'root' })
export class ChatWebSocketService {
  private auth = inject(AuthService);
  private msgSvc = inject(MessageService);

  private ws: WebSocket | null = null;
  private _events$ = new Subject<WsEvent>();
  private _typingUsers = signal<Set<string>>(new Set());
  private _onlineUsers = signal<Map<string, PresenceUser>>(new Map());
  private currentChannelId: string | null = null;

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
    this.ws = new WebSocket(`${wsBase}${wsApiPath}/channels/${channelId}${tokenParam}`);

    this.ws.onopen = () => console.log('[WS] Connected to', channelId);
    this.ws.onmessage = ({ data }) => {
      try {
        this._events$.next(JSON.parse(data));
      } catch { /* ignore */ }
    };
    this.ws.onerror = (e) => this._events$.next({ type: 'error', data: { message: 'WS error' } });
    this.ws.onclose = () => console.log('[WS] Disconnected');
  }

  disconnect(): void {
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

  get messages$(): Observable<Message> {
    return this._events$.pipe(
      filter(e => e.type === 'message'),
      map(e => this.msgSvc.mapMessage(e.data as Record<string, unknown>))
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
    }
  }
}

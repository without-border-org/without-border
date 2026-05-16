import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Channel, Message, PaginatedMessages } from '../models';

function mapChannel(raw: Record<string, unknown>): Channel {
  return {
    id: raw['id'] as string,
    name: raw['name'] as string,
    description: raw['description'] as string | undefined,
    type: raw['type'] as Channel['type'],
    createdBy: raw['created_by'] as string,
    isArchived: raw['is_archived'] as boolean,
    memberCount: (raw['member_count'] as number) ?? 0,
    unreadCount: (raw['unread_count'] as number) ?? 0,
    createdAt: raw['created_at'] as string,
  };
}

function mapMessage(raw: Record<string, unknown>): Message {
  const reactions = (raw['reactions'] as Array<{emoji: string; count: number; reacted_by_me: boolean}>)?.map(r => ({
    emoji: r.emoji,
    count: r.count,
    reactedByMe: r.reacted_by_me ?? false,
  })) ?? [];

  return {
    id: raw['id'] as string,
    channelId: raw['channel_id'] as string,
    senderId: raw['sender_id'] as string,
    senderUsername: (raw['sender_username'] as string) ?? 'Unknown',
    senderAvatar: raw['sender_avatar'] as string | undefined,
    originalContent: raw['original_content'] as string,
    translatedContent: raw['translated_content'] as string | undefined,
    originalLanguage: raw['original_language'] as string,
    isAgentic: raw['is_agentic'] as boolean,
    isPinned: (raw['is_pinned'] as boolean) ?? false,
    parentId: raw['parent_id'] as string | undefined,
    fileUrl: raw['file_url'] as string | undefined,
    fileName: raw['file_name'] as string | undefined,
    fileType: raw['file_type'] as string | undefined,
    reactions,
    replyCount: (raw['reply_count'] as number) ?? 0,
    createdAt: raw['created_at'] as string,
    updatedAt: raw['updated_at'] as string,
  };
}

@Injectable({ providedIn: 'root' })
export class ChannelService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/v1`;

  private _channels = signal<Channel[]>([]);
  readonly channels = this._channels.asReadonly();

  loadChannels() {
    return this.http.get<unknown[]>(`${this.base}/channels`).pipe(
      tap(data => this._channels.set(data.map(c => mapChannel(c as Record<string, unknown>))))
    );
  }

  createChannel(payload: { name: string; description?: string; type: string; memberIds: string[] }) {
    return this.http.post<unknown>(`${this.base}/channels`, {
      name: payload.name, description: payload.description,
      type: payload.type, member_ids: payload.memberIds,
    }).pipe(
      tap(ch => this._channels.update(list => [...list, mapChannel(ch as Record<string, unknown>)]))
    );
  }

  getChannel(id: string) {
    return this.http.get<unknown>(`${this.base}/channels/${id}`);
  }

  getMembers(channelId: string) {
    return this.http.get<unknown[]>(`${this.base}/channels/${channelId}/members`);
  }

  addMember(channelId: string, userId: string) {
    return this.http.post(`${this.base}/channels/${channelId}/members?user_id=${userId}`, {});
  }

  removeMember(channelId: string, userId: string) {
    return this.http.delete(`${this.base}/channels/${channelId}/members/${userId}`);
  }
}

@Injectable({ providedIn: 'root' })
export class MessageService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/v1`;

  getMessages(channelId: string, page = 1) {
    return this.http.get<unknown>(`${this.base}/channels/${channelId}/messages?page=${page}&page_size=50`).pipe(
      map((data: unknown) => {
        const raw = data as Record<string, unknown>;
        return {
          ...raw,
          items: ((raw['items'] as unknown[]) ?? []).map(msg => mapMessage(msg as Record<string, unknown>))
        } as PaginatedMessages;
      })
    );
  }

  getPinned(channelId: string) {
    return this.http.get<unknown[]>(`${this.base}/channels/${channelId}/messages/pinned`).pipe(
      map(msgs => msgs.map(msg => mapMessage(msg as Record<string, unknown>)))
    );
  }

  searchMessages(channelId: string, query: string) {
    return this.http.get<unknown[]>(`${this.base}/channels/${channelId}/messages/search?q=${encodeURIComponent(query)}`).pipe(
      map(msgs => msgs.map(msg => mapMessage(msg as Record<string, unknown>)))
    );
  }

  pinMessage(messageId: string) {
    return this.http.post(`${this.base}/messages/${messageId}/pin`, {});
  }

  deleteMessage(messageId: string) {
    return this.http.delete(`${this.base}/messages/${messageId}`);
  }

  addReaction(messageId: string, emoji: string) {
    return this.http.post(`${this.base}/messages/${messageId}/reactions`, { emoji });
  }

  uploadFile(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ file_url: string; file_name: string; file_type: string }>(`${this.base}/files/upload`, form);
  }

  translateFile(fileId: string, targetLanguage: string) {
    return this.http.post<{ translated_content: string }>(`${this.base}/files/${fileId}/translate?target_language=${targetLanguage}`, {});
  }

  mapMessage(raw: Record<string, unknown>): Message {
    return mapMessage(raw);
  }
}

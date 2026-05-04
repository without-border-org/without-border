export type UserStatus = 'active' | 'agentic' | 'inactive';
export type ChannelType = 'team' | 'pair';
export type NotificationType = 'mention' | 'reply' | 'agentic_reply' | 'summary_ready' | 'new_member';

export interface User {
  id: string;
  email: string;
  username: string;
  preferredLanguage: string;
  status: UserStatus;
  agenticEnabled: boolean;
  agenticPersona?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  type: ChannelType;
  createdBy: string;
  isArchived: boolean;
  memberCount: number;
  unreadCount?: number;
  createdAt: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderUsername: string;
  senderAvatar?: string;
  originalContent: string;
  translatedContent?: string;
  originalLanguage: string;
  isAgentic: boolean;
  isPinned: boolean;
  parentId?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  reactions: Reaction[];
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  showOriginal?: boolean; // UI only
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  channelId?: string;
  messageId?: string;
  content?: string;
  isRead: boolean;
  createdAt: string;
}

export interface PaginatedMessages {
  items: Message[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface WsEvent {
  type: 'message' | 'typing' | 'presence' | 'error';
  data: Record<string, unknown>;
}

export interface PresenceUser {
  userId: string;
  username: string;
  status: 'online' | 'offline';
}

export const LANGUAGE_MAP: Record<string, { name: string; flag: string }> = {
  fr: { name: 'Français', flag: '🇫🇷' },
  en: { name: 'English', flag: '🇬🇧' },
  es: { name: 'Español', flag: '🇪🇸' },
  de: { name: 'Deutsch', flag: '🇩🇪' },
  zh: { name: '中文', flag: '🇨🇳' },
  ar: { name: 'العربية', flag: '🇸🇦' },
  pt: { name: 'Português', flag: '🇧🇷' },
  ru: { name: 'Русский', flag: '🇷🇺' },
  ja: { name: '日本語', flag: '🇯🇵' },
  ko: { name: '한국어', flag: '🇰🇷' },
  it: { name: 'Italiano', flag: '🇮🇹' },
  nl: { name: 'Nederlands', flag: '🇳🇱' },
};

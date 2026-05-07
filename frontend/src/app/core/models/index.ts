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

export interface ChannelMember {
  userId: string;
  username: string;
  status: UserStatus;
  role: string;
  preferredLanguage?: string;
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
  showOriginal?: boolean; // UI-only flag
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

/** Language metadata including UI badge code (country code used in message headers). */
export const LANGUAGE_MAP: Record<string, { name: string; flag: string; badge: string }> = {
  fr: { name: 'Français',   flag: '🇫🇷', badge: 'FR' },
  en: { name: 'English',    flag: '🇬🇧', badge: 'GB' },
  es: { name: 'Español',    flag: '🇪🇸', badge: 'ES' },
  de: { name: 'Deutsch',    flag: '🇩🇪', badge: 'DE' },
  zh: { name: '中文',        flag: '🇨🇳', badge: 'CN' },
  ar: { name: 'العربية',    flag: '🇸🇦', badge: 'SA' },
  pt: { name: 'Português',  flag: '🇧🇷', badge: 'BR' },
  ru: { name: 'Русский',    flag: '🇷🇺', badge: 'RU' },
  ja: { name: '日本語',      flag: '🇯🇵', badge: 'JP' },
  ko: { name: '한국어',      flag: '🇰🇷', badge: 'KR' },
  it: { name: 'Italiano',   flag: '🇮🇹', badge: 'IT' },
  nl: { name: 'Nederlands', flag: '🇳🇱', badge: 'NL' },
};

/**
 * Returns the Tailwind color name for a given userId.
 * Uses the last byte of the UUID (hex) modulo the palette length.
 * Colors are chosen to match the mockup user assignments:
 *   000...001 → orange (Sophie), 002 → blue (John), 003 → emerald (María),
 *   004 → zinc (Kevin), 005 → purple (Sarah)
 */
export function getUserColor(userId: string): string {
  const COLORS = ['violet', 'orange', 'blue', 'emerald', 'zinc', 'purple', 'pink', 'teal'];
  const lastByte = parseInt(userId.replace(/-/g, '').slice(-2), 16) || 0;
  return COLORS[lastByte % COLORS.length];
}

/** Returns 2-letter initials from a full name (e.g. "Sophie Martin" → "SM"). */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

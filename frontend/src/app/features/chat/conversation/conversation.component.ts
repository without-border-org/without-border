import {
  Component, inject, signal, computed, OnInit, OnDestroy, OnChanges, SimpleChanges,
  ViewChild, ElementRef, AfterViewChecked, Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChannelService, MessageService } from '../../../core/services/channel.service';
import { ChatWebSocketService } from '../../../core/services/chat-ws.service';
import { AuthService } from '../../../core/services/auth.service';
import { Message, Channel, ChannelMember, LANGUAGE_MAP, getUserColor, getInitials } from '../../../core/models';
import { MessageBubbleComponent } from '../components/message-bubble.component';

@Component({
  selector: 'wb-conversation',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageBubbleComponent],
  template: `
    <div class="flex flex-1 min-h-0 overflow-hidden relative">

      <!-- ═══════════════ ZONE CHAT ═══════════════ -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">

        <!-- ── Header (glassmorphism) ── -->
        <header class="h-16 glass-header absolute top-0 left-0 right-0 z-20
                       flex items-center justify-between px-6">
          <!-- Icône + titre + sous-titre -->
          <div class="flex items-center gap-3">
            <div class="p-2 bg-brand-orange/10 rounded-lg text-brand-orange">
              <!-- Icône groupe (team) ou initiales (DM) -->
              <ng-container *ngIf="channel()?.type === 'team'; else dmIcon">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857
                       M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857
                       m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </ng-container>
              <ng-template #dmIcon>
                <span class="w-5 h-5 flex items-center justify-center font-bold text-[10px]">
                  {{ getInitials(channel()?.name ?? '') }}
                </span>
              </ng-template>
            </div>
            <div>
              <h2 class="text-sm font-bold truncate dark:text-white text-zinc-900">
                {{ channel()?.name ?? '...' }}
              </h2>
              <p class="text-[10px] text-zinc-500 font-medium tracking-wide">
                {{ channel()?.description ?? (loading() ? 'Chargement...' : '') }}
                <span *ngIf="typingText()" class="text-brand-orange italic ml-1">{{ typingText() }}</span>
              </p>
            </div>
          </div>

          <!-- Groupe d'avatars participants → toggle sidebar droite -->
          <button (click)="toggleParticipants()"
                  class="flex -space-x-2.5 hover:opacity-80 transition-ui p-1.5 rounded-xl
                         hover:bg-zinc-100 dark:hover:bg-white/5">
            <ng-container *ngFor="let m of participantsPreview(); let idx = index">
              <div class="w-8 h-8 rounded-full border-2 dark:border-brand-darkBg border-white
                          flex items-center justify-center text-[10px] text-white font-bold shadow-sm"
                   [ngClass]="memberAvatarBg(m)"
                   [style.z-index]="30 - idx">
                {{ getInitials(m.username) }}
              </div>
            </ng-container>
            <div *ngIf="participantsOverflow() > 0"
                 class="w-8 h-8 rounded-full bg-zinc-400 border-2 dark:border-brand-darkBg border-white
                        flex items-center justify-center text-[10px] text-white font-bold shadow-sm z-0">
              +{{ participantsOverflow() }}
            </div>
          </button>
        </header>

        <!-- ── Messages ── -->
        <div #messagesEl
             class="flex-1 overflow-y-auto custom-scrollbar px-6 pt-24 pb-4 space-y-6"
             (scroll)="onScroll($event)">

          <!-- Load more -->
          <div *ngIf="hasMore()" class="text-center py-2">
            <button (click)="loadMore()"
              class="text-xs text-brand-orange hover:text-brand-orangeHover
                     bg-brand-orange/10 hover:bg-brand-orange/20 px-4 py-2 rounded-full transition-ui">
              Charger les messages précédents
            </button>
          </div>

          <!-- Skeleton loading -->
          <div *ngIf="loading()">
            <div *ngFor="let i of [1,2,3,4]" class="flex gap-4 animate-pulse">
              <div class="w-9 h-9 rounded-xl dark:bg-zinc-800 bg-zinc-200 flex-shrink-0"></div>
              <div class="flex-1">
                <div class="h-3 w-24 dark:bg-zinc-800 bg-zinc-200 rounded mb-2"></div>
                <div class="h-12 dark:bg-zinc-800 bg-zinc-200 rounded-2xl w-3/4"></div>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div *ngIf="!loading() && messages().length === 0"
               class="flex flex-col items-center justify-center h-full text-center py-20">
            <div class="text-5xl mb-4">💬</div>
            <h3 class="text-base font-semibold dark:text-white text-zinc-900 mb-2">
              Démarrez la conversation
            </h3>
            <p class="text-zinc-500 text-sm max-w-xs">
              Les messages seront automatiquement traduits pour chaque membre dans sa langue.
            </p>
          </div>

          <!-- Messages list -->
          <wb-message-bubble
            *ngFor="let msg of messages(); trackBy: trackById"
            [message]="msg"
            [currentUserLang]="currentUserLang()"
            [id]="'msg-' + msg.id"
            (react)="onReact(msg.id, $event)" />
        </div>

        <!-- ── Compositeur (Rich Text) ── -->
        <div class="px-4 pb-4 pt-2 border-t dark:border-brand-darkBorder border-brand-lightBorder
                    dark:bg-brand-darkBg bg-brand-lightBg">
          <div class="dark:bg-brand-darkPanel bg-zinc-100 border dark:border-brand-darkBorder
                      border-zinc-200 rounded-2xl transition-ui focus-within:border-brand-orange/30 overflow-hidden">

            <!-- Toolbar formatage (haut) -->
            <div class="flex items-center gap-0.5 px-3 pt-2.5 pb-2
                        border-b dark:border-white/[0.05] border-zinc-200/80">
              <button class="editor-tool font-bold text-xs dark:text-zinc-300 text-zinc-700"
                      (click)="applyFormat('bold')" title="Gras">B</button>
              <button class="editor-tool text-xs dark:text-zinc-300 text-zinc-700 italic"
                      (click)="applyFormat('italic')" title="Italique">I</button>
              <button class="editor-tool text-xs dark:text-zinc-300 text-zinc-700 underline"
                      (click)="applyFormat('underline')" title="Souligné">U</button>
              <button class="editor-tool text-xs dark:text-zinc-300 text-zinc-700 line-through"
                      (click)="applyFormat('strikethrough')" title="Barré">S</button>
              <div class="w-px h-3.5 dark:bg-white/10 bg-zinc-300 mx-1.5 flex-shrink-0"></div>
              <button class="editor-tool dark:text-zinc-300 text-zinc-700" title="Lien">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101
                       m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                </svg>
              </button>
              <div class="w-px h-3.5 dark:bg-white/10 bg-zinc-300 mx-1.5 flex-shrink-0"></div>
              <button class="editor-tool dark:text-zinc-300 text-zinc-700" title="Liste ordonnée">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                </svg>
              </button>
              <button class="editor-tool dark:text-zinc-300 text-zinc-700" title="Liste à puces">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                </svg>
              </button>
              <div class="w-px h-3.5 dark:bg-white/10 bg-zinc-300 mx-1.5 flex-shrink-0"></div>
              <button class="editor-tool dark:text-zinc-300 text-zinc-700" title="Code">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                </svg>
              </button>
              <button class="editor-tool dark:text-zinc-300 text-zinc-700" title="Citation">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                </svg>
              </button>
            </div>

            <!-- Zone de saisie -->
            <textarea #textareaEl [(ngModel)]="messageText"
              (input)="onInput()"
              (keydown)="onKeydown($event)"
              rows="3"
              class="w-full bg-transparent text-sm focus:outline-none resize-none px-4 py-3
                     dark:placeholder-zinc-600 placeholder-zinc-400 dark:text-zinc-200 text-zinc-800"
              placeholder="Envoyer un message..."></textarea>

            <!-- Toolbar actions (bas) -->
            <div class="flex items-center gap-0.5 px-3 pb-2.5 pt-1">
              <button class="editor-tool dark:text-zinc-400 text-zinc-500" title="Joindre un fichier">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
              </button>
              <button class="editor-tool text-[10px] font-semibold dark:text-zinc-400 text-zinc-500"
                      title="Format">Aa</button>
              <button class="editor-tool dark:text-zinc-400 text-zinc-500" title="Emoji">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </button>
              <button class="editor-tool text-[11px] font-bold dark:text-zinc-400 text-zinc-500"
                      title="Mentionner">@</button>
              <div class="w-px h-3.5 dark:bg-white/10 bg-zinc-300 mx-1.5 flex-shrink-0"></div>
              <button class="editor-tool dark:text-zinc-400 text-zinc-500" title="Clip vidéo">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14
                       M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
              </button>
              <button class="editor-tool dark:text-zinc-400 text-zinc-500" title="Message vocal">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                </svg>
              </button>
              <button class="editor-tool text-[11px] font-bold dark:text-zinc-400 text-zinc-500"
                      title="Commandes">/</button>
              <div class="flex-1"></div>
              <!-- Bouton envoi -->
              <button (click)="sendMessage()"
                      class="editor-tool rounded-lg"
                      [class]="messageText.trim() ? 'send-btn-active' : 'send-btn-inactive'"
                      title="Envoyer (Entrée)">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════════ SIDEBAR DROITE (PARTICIPANTS) ═══════════════ -->
      <aside class="flex flex-col flex-shrink-0 dark:bg-brand-darkSidebar bg-white
                    border-l dark:border-brand-darkBorder border-zinc-200 transition-ui z-40 overflow-hidden"
             [class]="showParticipants() ? 'sidebar-right-visible' : 'sidebar-right-hidden'">

        <!-- Header -->
        <div class="h-16 flex items-center justify-between px-6 flex-shrink-0
                    border-b dark:border-brand-darkBorder border-zinc-100">
          <h3 class="text-sm font-bold tracking-tight dark:text-white text-zinc-900">
            Participants
            <span class="ml-1 text-zinc-400 font-normal">({{ members().length }})</span>
          </h3>
          <button (click)="showParticipants.set(false)"
                  class="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-ui">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Participants list -->
        <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1">
          <div *ngFor="let m of members()"
               class="flex items-center gap-3 p-2.5 rounded-xl
                      hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer transition-ui">
            <!-- Avatar + status dot -->
            <div class="relative flex-shrink-0">
              <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                   [ngClass]="memberAvatarFull(m)">
                {{ getInitials(m.username) }}
              </div>
              <div class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2
                          dark:border-brand-darkSidebar border-white"
                   [ngClass]="memberStatusDot(m.status)"></div>
            </div>
            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold truncate dark:text-zinc-100 text-zinc-900">{{ m.username }}</p>
              <p class="text-[10px] text-zinc-500 font-medium">{{ memberRoleLabel(m) }}</p>
            </div>
            <!-- Agentic badge -->
            <span *ngIf="m.status === 'agentic'"
                  class="text-[8px] px-1.5 py-0.5 bg-brand-orange/20 text-brand-orange
                         rounded font-bold uppercase tracking-tight flex-shrink-0">
              Agentic
            </span>
          </div>
        </div>
      </aside>
    </div>
  `,
})
export class ConversationComponent implements OnInit, OnChanges, OnDestroy, AfterViewChecked {
  @Input() channelId!: string;
  @ViewChild('messagesEl')  private messagesEl!:  ElementRef<HTMLDivElement>;
  @ViewChild('textareaEl') private textareaEl!: ElementRef<HTMLTextAreaElement>;

  private channelSvc = inject(ChannelService);
  private msgSvc     = inject(MessageService);
  private wsSvc      = inject(ChatWebSocketService);
  private authSvc    = inject(AuthService);

  // Expose helpers to template
  getInitials = getInitials;

  messages       = signal<Message[]>([]);
  channel        = signal<Channel | null>(null);
  members        = signal<ChannelMember[]>([]);
  loading        = signal(true);
  hasMore        = signal(false);
  currentPage    = signal(1);
  showParticipants = signal(false);
  messageText    = '';
  typingText     = signal('');

  currentUserLang = computed(() => this.authSvc.user()?.preferredLanguage ?? 'fr');
  currentUserId   = computed(() => this.authSvc.user()?.id);

  participantsPreview = computed(() => this.members().slice(0, 3));
  participantsOverflow = computed(() => Math.max(0, this.members().length - 3));

  private subs: Subscription[] = [];
  private shouldScroll = true;
  private typingTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['channelId'] && !changes['channelId'].firstChange) {
      this.subs.forEach(s => s.unsubscribe());
      this.subs = [];
      this.wsSvc.disconnect();
      if (this.typingTimer) { clearTimeout(this.typingTimer); this.typingTimer = null; }
      this.messages.set([]);
      this.channel.set(null);
      this.members.set([]);
      this.loading.set(true);
      this.shouldScroll = true;
      this.typingText.set('');

      this.loadChannel();
      this.loadMessages();
      this.loadMembers();
      this.wsSvc.connect(this.channelId);

      this.subs.push(
        this.wsSvc.messages$.subscribe(msg => {
          this.messages.update(list => [...list, msg]);
          this.shouldScroll = true;
        }),
        this.wsSvc.typing$.subscribe(({ username }) => {
          this.typingText.set(`${username} écrit…`);
          if (this.typingTimer) clearTimeout(this.typingTimer);
          this.typingTimer = setTimeout(() => this.typingText.set(''), 2500);
        }),
      );
    }
  }

  ngOnInit() {
    this.loadChannel();
    this.loadMessages();
    this.loadMembers();
    this.wsSvc.connect(this.channelId);

    this.subs.push(
      this.wsSvc.messages$.subscribe(msg => {
        this.messages.update(list => [...list, msg]);
        this.shouldScroll = true;
      }),
      this.wsSvc.typing$.subscribe(({ username }) => {
        this.typingText.set(`${username} écrit…`);
        if (this.typingTimer) clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => this.typingText.set(''), 2500);
      }),
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    this.wsSvc.disconnect();
    if (this.typingTimer) clearTimeout(this.typingTimer);
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) { this.scrollToBottom(); this.shouldScroll = false; }
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  loadChannel() {
    this.channelSvc.getChannel(this.channelId).subscribe({
      next: (ch: unknown) => this.channel.set(ch as Channel),
    });
  }

  loadMessages() {
    this.loading.set(true);
    this.msgSvc.getMessages(this.channelId, this.currentPage()).subscribe({
      next: data => {
        this.messages.set(data.items.slice().reverse());
        this.hasMore.set(data.has_more ?? data.hasMore ?? false);
        this.loading.set(false);
        this.shouldScroll = true;
      },
      error: () => this.loading.set(false),
    });
  }

  loadMore() {
    const next = this.currentPage() + 1;
    this.msgSvc.getMessages(this.channelId, next).subscribe(data => {
      this.messages.update(list => [...data.items, ...list]);
      this.hasMore.set(data.has_more ?? data.hasMore ?? false);
      this.currentPage.set(next);
    });
  }

  loadMembers() {
    this.channelSvc.getMembers(this.channelId).subscribe({
      next: (raw: unknown[]) => {
        this.members.set(raw.map(r => this.mapMember(r as Record<string, unknown>)));
      },
      error: () => {},
    });
  }

  private mapMember(raw: Record<string, unknown>): ChannelMember {
    return {
      userId:            (raw['id'] ?? raw['user_id']) as string,
      username:          raw['username']             as string,
      status:            (raw['status'] as string ?? 'active') as ChannelMember['status'],
      role:              (raw['role'] as string)     ?? 'member',
      preferredLanguage: raw['preferred_language']   as string | undefined,
    };
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  sendMessage() {
    const text = this.messageText.trim();
    if (!text) return;
    this.wsSvc.sendMessage(text);
    this.messageText = '';
    this.shouldScroll = true;
  }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
  }

  onInput() {
    if (this.messageText.length % 5 === 0) this.wsSvc.sendTyping();
  }

  applyFormat(format: string) {
    const el = this.textareaEl?.nativeElement;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const sel   = el.value.slice(start, end);
    const marks: Record<string, [string, string]> = {
      bold:          ['**', '**'],
      italic:        ['_', '_'],
      underline:     ['<u>', '</u>'],
      strikethrough: ['~~', '~~'],
    };
    const [open, close] = marks[format] ?? ['', ''];
    if (!open) return;
    this.messageText =
      el.value.slice(0, start) + open + sel + close + el.value.slice(end);
    setTimeout(() => {
      el.selectionStart = start + open.length;
      el.selectionEnd   = start + open.length + sel.length;
      el.focus();
    });
  }

  // ── Reactions ─────────────────────────────────────────────────────────────

  onReact(messageId: string, emoji: string) {
    this.msgSvc.addReaction(messageId, emoji).subscribe(() => {
      this.messages.update(list => list.map(m => {
        if (m.id !== messageId) return m;
        const existing = m.reactions.find(r => r.emoji === emoji);
        const reactions = existing
          ? existing.reactedByMe
            ? m.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count - 1, reactedByMe: false } : r).filter(r => r.count > 0)
            : m.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r)
          : [...m.reactions, { emoji, count: 1, reactedByMe: true }];
        return { ...m, reactions };
      }));
    });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  toggleParticipants() {
    this.showParticipants.update(v => !v);
  }

  onScroll(e: Event) {
    const el = e.target as HTMLDivElement;
    if (el.scrollTop < 100 && this.hasMore()) this.loadMore();
  }

  scrollToBottom() {
    try { this.messagesEl.nativeElement.scrollTop = this.messagesEl.nativeElement.scrollHeight; } catch {}
  }

  trackById = (_: number, m: Message) => m.id;

  memberAvatarBg(m: ChannelMember): string {
    const c = getUserColor(m.userId);
    return `bg-${c}-500`;
  }

  memberAvatarFull(m: ChannelMember): string {
    const c = getUserColor(m.userId);
    return `bg-${c}-500/10 text-${c}-500 border border-${c}-500/20`;
  }

  memberStatusDot(status: string): string {
    return status === 'agentic' ? 'bg-brand-orange' : status === 'inactive' ? 'bg-zinc-400' : 'bg-green-500';
  }

  memberRoleLabel(m: ChannelMember): string {
    const lang = m.preferredLanguage;
    return lang ? (LANGUAGE_MAP[lang]?.badge ?? lang.toUpperCase()) : '';
  }
}

import { Component, inject, signal, computed, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChannelService, MessageService } from '../../../core/services/channel.service';
import { ChatWebSocketService } from '../../../core/services/chat-ws.service';
import { AiService } from '../../../core/services/ai.service';
import { AuthService } from '../../../core/services/auth.service';
import { Message, Channel } from '../../../core/models';
import { MessageBubbleComponent } from '../components/message-bubble.component';
import { AiPanelComponent } from '../components/ai-panel.component';

@Component({
  selector: 'wb-conversation',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageBubbleComponent, AiPanelComponent],
  template: `
    <div class="flex h-full overflow-hidden">

      <!-- ─── CHAT AREA ─────────────────────────────────── -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">

        <!-- Channel header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-surface-850/30 flex-shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm"
                 [class]="channel()?.type === 'pair' ? 'bg-gradient-to-br from-primary-600/40 to-accent-pink/30 text-white' : 'bg-primary-500/20 text-primary-300'">
              {{ channel()?.name?.[0]?.toUpperCase() || '#' }}
            </div>
            <div class="min-w-0">
              <h2 class="text-base font-semibold text-white leading-none truncate">{{ channel()?.name }}</h2>
              <p class="text-xs text-gray-500 mt-0.5">
                {{ channel()?.memberCount }} members
                <span *ngIf="typingText()" class="text-primary-400 italic ml-2">{{ typingText() }}</span>
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Search messages -->
            <div class="relative hidden sm:block">
              <input *ngIf="searchOpen()" [(ngModel)]="searchQuery" (ngModelChange)="onSearch($event)"
                placeholder="Search messages..." autofocus
                class="bg-surface-800 border border-white/10 rounded-xl py-1.5 pl-3 pr-8 text-sm text-white placeholder-gray-500
                       focus:outline-none focus:border-primary-500/50 w-48 transition-all" />
              <button (click)="searchOpen.update(v => !v)"
                class="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all text-sm">
                🔍
              </button>
            </div>

            <!-- Pinned messages -->
            <button (click)="showPinned.update(v => !v)"
              class="p-2 rounded-xl transition-all text-sm"
              [class]="showPinned() ? 'bg-primary-500/20 text-primary-400' : 'hover:bg-white/10 text-gray-400 hover:text-white'"
              title="Pinned messages">📌</button>

            <!-- AI panel toggle -->
            <button (click)="aiPanelOpen.update(v => !v)"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
              [class]="aiPanelOpen() ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'">
              <span>✨</span>
              <span class="hidden sm:inline">AI Tools</span>
            </button>
          </div>
        </div>

        <!-- Pinned messages banner -->
        <div *ngIf="showPinned() && pinnedMessages().length > 0"
             class="px-5 py-3 bg-amber-500/5 border-b border-amber-500/20 flex-shrink-0">
          <p class="text-xs font-semibold text-amber-400 mb-2">📌 Pinned Messages</p>
          <div *ngFor="let msg of pinnedMessages()" class="text-sm text-gray-300 py-1 border-l-2 border-amber-500/40 pl-3">
            <span class="font-medium text-white">{{ msg.senderUsername }}: </span>
            {{ msg.translatedContent || msg.originalContent | slice:0:100 }}
          </div>
        </div>

        <!-- Search results banner -->
        <div *ngIf="searchResults().length > 0"
             class="px-5 py-3 bg-primary-500/5 border-b border-primary-500/20 flex-shrink-0">
          <p class="text-xs font-semibold text-primary-400 mb-2">🔍 {{ searchResults().length }} results</p>
          <div *ngFor="let msg of searchResults()" class="text-sm text-gray-300 py-1 border-l-2 border-primary-500/40 pl-3 cursor-pointer hover:text-white"
               (click)="scrollToMessage(msg.id)">
            <span class="font-medium text-white">{{ msg.senderUsername }}: </span>
            {{ msg.translatedContent || msg.originalContent | slice:0:80 }}
          </div>
        </div>

        <!-- ─── MESSAGES ────────────────────────────── -->
        <div #messagesEl class="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin"
             (scroll)="onScroll($event)">

          <!-- Load more -->
          <div *ngIf="hasMore()" class="text-center py-3">
            <button (click)="loadMore()"
              class="text-xs text-primary-400 hover:text-primary-300 bg-primary-500/10 hover:bg-primary-500/20
                     px-4 py-2 rounded-full transition-all">
              Load older messages
            </button>
          </div>

          <!-- Loading skeleton -->
          <div *ngIf="loading()">
            <div *ngFor="let i of [1,2,3,4,5]" class="flex gap-3 mb-4 animate-pulse">
              <div class="w-9 h-9 rounded-full bg-white/5 flex-shrink-0"></div>
              <div class="flex-1">
                <div class="h-3 w-24 bg-white/5 rounded mb-2"></div>
                <div class="h-10 bg-white/5 rounded-xl w-3/4"></div>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div *ngIf="!loading() && messages().length === 0"
               class="flex flex-col items-center justify-center h-full text-center py-20">
            <div class="text-5xl mb-4">💬</div>
            <h3 class="text-lg font-semibold text-white mb-2">Start the conversation</h3>
            <p class="text-gray-500 text-sm max-w-xs">
              Messages will be automatically translated for every team member in their language.
            </p>
          </div>

          <!-- Messages list -->
          <wb-message-bubble
            *ngFor="let msg of messages(); trackBy: trackById"
            [message]="msg"
            [isOwn]="msg.senderId === currentUserId()"
            [id]="'msg-' + msg.id"
            (react)="onReact(msg.id, $event)"
            (pin)="onPin(msg.id)"
            (delete)="onDelete(msg.id)"
            (reply)="onReply(msg)" />
        </div>

        <!-- ─── MESSAGE INPUT ────────────────────────── -->
        <div class="flex-shrink-0 px-4 pb-4 pt-2">
          <!-- Reply preview -->
          <div *ngIf="replyTo()" class="flex items-center gap-3 px-4 py-2.5 mb-2
               bg-primary-500/10 border border-primary-500/20 rounded-xl">
            <div class="w-0.5 h-8 bg-primary-500 rounded-full flex-shrink-0"></div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-primary-400">Replying to {{ replyTo()?.senderUsername }}</p>
              <p class="text-xs text-gray-400 truncate">{{ replyTo()?.originalContent }}</p>
            </div>
            <button (click)="replyTo.set(null)" class="text-gray-500 hover:text-white transition-colors text-sm p-1">✕</button>
          </div>

          <div class="bg-surface-850 border border-white/10 rounded-2xl overflow-hidden
                      focus-within:border-primary-500/50 focus-within:shadow-glow-primary transition-all duration-200">
            <!-- Toolbar -->
            <div class="flex items-center gap-1 px-3 py-2 border-b border-white/5">
              <button class="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-all text-sm" title="Bold">𝐁</button>
              <button class="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-all text-sm" title="Italic">𝐼</button>
              <button class="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-all text-sm" title="Code">&lt;/&gt;</button>
              <div class="w-px h-4 bg-white/10 mx-1"></div>
              <label class="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-all text-sm cursor-pointer" title="Attach file">
                📎
                <input type="file" class="hidden" (change)="onFileSelect($event)" accept="image/*,.pdf,.txt,.md" />
              </label>
              <!-- Emoji -->
              <button class="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-all text-sm">😊</button>
            </div>

            <div class="flex items-end gap-3 p-3">
              <textarea [(ngModel)]="messageText"
                (keydown.enter)="onEnter($event)"
                (input)="onTyping()"
                placeholder="Write your message... it will be translated automatically"
                rows="1"
                class="flex-1 bg-transparent text-white text-sm placeholder-gray-500
                       focus:outline-none resize-none leading-relaxed min-h-[24px] max-h-40"></textarea>

              <!-- File preview -->
              <div *ngIf="attachedFile()" class="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-lg">
                <span class="text-xs text-gray-300 max-w-[100px] truncate">{{ attachedFile()?.name }}</span>
                <button (click)="attachedFile.set(null)" class="text-gray-500 hover:text-white text-xs">✕</button>
              </div>

              <button (click)="sendMessage()"
                [disabled]="!messageText.trim() && !attachedFile()"
                class="flex-shrink-0 w-9 h-9 bg-primary-500 hover:bg-primary-400 disabled:opacity-40
                       disabled:cursor-not-allowed rounded-xl flex items-center justify-center
                       transition-all duration-150 transform hover:scale-105 active:scale-95">
                <svg class="w-4 h-4 text-white rotate-45" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>

            <div class="px-3 py-1.5 border-t border-white/5 flex items-center justify-between">
              <span class="text-xs text-gray-600">
                ↵ Send &nbsp;·&nbsp; ⇧↵ New line &nbsp;·&nbsp;
                <span class="text-primary-600">🌍 Auto-translated for all members</span>
              </span>
              <span class="text-xs text-gray-600">{{ messageText.length }}/2000</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── AI PANEL ─────────────────────────────────── -->
      <wb-ai-panel *ngIf="aiPanelOpen()"
        [channelId]="channelId"
        (close)="aiPanelOpen.set(false)" />
    </div>
  `,
})
export class ConversationComponent implements OnInit, OnDestroy, AfterViewChecked {
  @Input() channelId!: string;
  @ViewChild('messagesEl') private messagesEl!: ElementRef<HTMLDivElement>;

  private channelSvc = inject(ChannelService);
  private msgSvc = inject(MessageService);
  private wsSvc = inject(ChatWebSocketService);
  private authSvc = inject(AuthService);

  messages = signal<Message[]>([]);
  channel = signal<Channel | null>(null);
  loading = signal(true);
  hasMore = signal(false);
  currentPage = signal(1);
  replyTo = signal<Message | null>(null);
  pinnedMessages = signal<Message[]>([]);
  searchResults = signal<Message[]>([]);
  searchQuery = '';
  searchOpen = signal(false);
  showPinned = signal(false);
  aiPanelOpen = signal(false);
  messageText = '';
  attachedFile = signal<File | null>(null);
  typingText = signal('');
  currentUserId = computed(() => this.authSvc.user()?.id);

  private subs: Subscription[] = [];
  private shouldScroll = true;
  private typingTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    this.loadChannel();
    this.loadMessages();
    this.wsSvc.connect(this.channelId);

    this.subs.push(
      this.wsSvc.messages$.subscribe(msg => {
        this.messages.update(list => [...list, msg]);
        this.shouldScroll = true;
      }),
      this.wsSvc.typing$.subscribe(({ username }) => {
        this.typingText.set(`${username} is typing...`);
        if (this.typingTimer) clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => this.typingText.set(''), 2500);
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    this.wsSvc.disconnect();
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  loadChannel() {
    this.channelSvc.getChannel(this.channelId).subscribe({
      next: (ch: unknown) => this.channel.set(ch as Channel),
    });
  }

  loadMessages() {
    this.loading.set(true);
    this.msgSvc.getMessages(this.channelId, this.currentPage()).subscribe({
      next: (data) => {
        this.messages.set(data.items.reverse ? data.items : data.items);
        this.hasMore.set(data.hasMore);
        this.loading.set(false);
        this.shouldScroll = true;
      },
      error: () => this.loading.set(false),
    });
  }

  loadMore() {
    const nextPage = this.currentPage() + 1;
    this.msgSvc.getMessages(this.channelId, nextPage).subscribe(data => {
      this.messages.update(list => [...data.items, ...list]);
      this.hasMore.set(data.hasMore);
      this.currentPage.set(nextPage);
    });
  }

  sendMessage() {
    const text = this.messageText.trim();
    const file = this.attachedFile();
    if (!text && !file) return;

    if (file) {
      this.msgSvc.uploadFile(file).subscribe(res => {
        this.wsSvc.sendMessage(text || file.name, this.replyTo()?.id);
        this.attachedFile.set(null);
      });
    } else {
      this.wsSvc.sendMessage(text, this.replyTo()?.id);
    }

    this.messageText = '';
    this.replyTo.set(null);
    this.shouldScroll = true;
  }

  onEnter(e: KeyboardEvent) {
    if (!e.shiftKey) { e.preventDefault(); this.sendMessage(); }
  }

  onTyping() {
    if (this.messageText.length % 5 === 0) this.wsSvc.sendTyping();
  }

  onReact(messageId: string, emoji: string) {
    this.msgSvc.addReaction(messageId, emoji).subscribe(() => {
      this.messages.update(list => list.map(m =>
        m.id === messageId ? {
          ...m,
          reactions: (() => {
            const existing = m.reactions.find(r => r.emoji === emoji);
            if (existing) {
              return existing.reactedByMe
                ? m.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count - 1, reactedByMe: false } : r).filter(r => r.count > 0)
                : m.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r);
            }
            return [...m.reactions, { emoji, count: 1, reactedByMe: true }];
          })()
        } : m
      ));
    });
  }

  onPin(messageId: string) {
    this.msgSvc.pinMessage(messageId).subscribe(() => this.loadPinned());
  }

  onDelete(messageId: string) {
    this.msgSvc.deleteMessage(messageId).subscribe(() => {
      this.messages.update(list => list.filter(m => m.id !== messageId));
    });
  }

  onReply(msg: Message) { this.replyTo.set(msg); }

  onFileSelect(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.attachedFile.set(file);
  }

  onSearch(q: string) {
    if (q.length < 2) { this.searchResults.set([]); return; }
    this.msgSvc.searchMessages(this.channelId, q).subscribe(res => this.searchResults.set(res));
  }

  loadPinned() {
    this.msgSvc.getPinned(this.channelId).subscribe(msgs => this.pinnedMessages.set(msgs));
  }

  onScroll(e: Event) {
    const el = e.target as HTMLDivElement;
    if (el.scrollTop < 100 && this.hasMore()) this.loadMore();
  }

  scrollToBottom() {
    try { this.messagesEl.nativeElement.scrollTop = this.messagesEl.nativeElement.scrollHeight; } catch {}
  }

  scrollToMessage(id: string) {
    document.getElementById('msg-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  trackById = (_: number, m: Message) => m.id;
}

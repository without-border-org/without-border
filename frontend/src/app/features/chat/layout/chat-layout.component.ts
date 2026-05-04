import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterOutlet, Router, ActivatedRoute } from '@angular/router';
import { ChannelService } from '../../../core/services/channel.service';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { AiService } from '../../../core/services/ai.service';
import { Channel, LANGUAGE_MAP } from '../../../core/models';
import { CreateChannelModalComponent } from '../components/create-channel-modal.component';
import { NotificationsPanelComponent } from '../components/notifications-panel.component';

@Component({
  selector: 'wb-chat-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterOutlet, CreateChannelModalComponent, NotificationsPanelComponent],
  template: `
    <div class="flex h-screen bg-surface-900 overflow-hidden">

      <!-- Mobile overlay -->
      <div *ngIf="sidebarOpen() && isMobile()"
           class="fixed inset-0 bg-black/60 z-20 lg:hidden"
           (click)="sidebarOpen.set(false)"></div>

      <!-- ─── SIDEBAR ─────────────────────────────────────── -->
      <aside class="flex-shrink-0 w-72 h-full flex flex-col
                    bg-surface-850/95 backdrop-blur-xl border-r border-white/5
                    fixed lg:relative z-30 transition-transform duration-300
                    {{ sidebarOpen() || !isMobile() ? 'translate-x-0' : '-translate-x-full' }}">

        <!-- Brand -->
        <div class="flex items-center gap-3 px-5 py-5 border-b border-white/5">
          <div class="w-9 h-9 bg-gradient-to-br from-primary-500 to-accent-pink rounded-xl flex items-center justify-center shadow-glow-primary flex-shrink-0">
            <span class="text-lg">🌍</span>
          </div>
          <div class="flex-1 min-w-0">
            <h1 class="text-base font-bold text-white leading-none">WithoutBorder</h1>
            <p class="text-xs text-gray-500 mt-0.5 truncate">
              {{ langInfo()?.flag }} {{ langInfo()?.name }}
            </p>
          </div>
          <!-- AI Status dot -->
          <div class="w-2 h-2 rounded-full flex-shrink-0" [class]="aiAvailable() ? 'bg-accent-green animate-pulse' : 'bg-gray-600'"
               [title]="aiAvailable() ? 'Gemma 4 ready' : 'AI unavailable'"></div>
        </div>

        <!-- Search -->
        <div class="px-4 py-3">
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
            <input [(ngModel)]="searchQuery" (ngModelChange)="onSearch($event)"
              placeholder="Search channels..."
              class="w-full bg-surface-800 border border-white/5 rounded-xl py-2 pl-9 pr-4
                     text-sm text-white placeholder-gray-500 focus:outline-none
                     focus:border-primary-500/50 transition-colors" />
          </div>
        </div>

        <!-- Nav content -->
        <nav class="flex-1 overflow-y-auto px-3 pb-3 space-y-1 scrollbar-thin">

          <!-- Teams section -->
          <div class="mb-1">
            <div class="flex items-center justify-between px-2 py-2">
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Teams</span>
              <button (click)="showCreateModal.set(true)"
                class="w-5 h-5 rounded-md bg-white/5 hover:bg-primary-500/20 text-gray-400
                       hover:text-primary-400 flex items-center justify-center transition-all text-sm"
                title="New team">+</button>
            </div>
            <a *ngFor="let ch of teamChannels()" [routerLink]="['/chat', ch.id]"
               (click)="sidebarOpen.set(false)"
               class="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 group"
               [class]="activeChannelId() === ch.id
                 ? 'bg-primary-500/15 text-white'
                 : 'text-gray-400 hover:bg-white/5 hover:text-white'">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
                   [class]="activeChannelId() === ch.id ? 'bg-primary-500/30 text-primary-300' : 'bg-white/5 text-gray-500 group-hover:bg-white/10'">
                {{ ch.name[0].toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate leading-none">{{ ch.name }}</p>
                <p class="text-xs text-gray-500 mt-0.5">{{ ch.memberCount }} members</p>
              </div>
              <span *ngIf="ch.unreadCount" class="text-xs bg-accent-pink text-white font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                {{ ch.unreadCount }}
              </span>
            </a>
            <p *ngIf="teamChannels().length === 0" class="text-xs text-gray-600 px-3 py-2 italic">
              No teams yet — create one above
            </p>
          </div>

          <!-- Direct Messages section -->
          <div>
            <div class="flex items-center justify-between px-2 py-2">
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Direct Messages</span>
              <button (click)="showCreateDM.set(true)"
                class="w-5 h-5 rounded-md bg-white/5 hover:bg-primary-500/20 text-gray-400 hover:text-primary-400 flex items-center justify-center transition-all text-sm"
                title="New DM">+</button>
            </div>
            <a *ngFor="let ch of pairChannels()" [routerLink]="['/chat', ch.id]"
               (click)="sidebarOpen.set(false)"
               class="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 group"
               [class]="activeChannelId() === ch.id
                 ? 'bg-primary-500/15 text-white'
                 : 'text-gray-400 hover:bg-white/5 hover:text-white'">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-600/40 to-accent-pink/30 flex items-center justify-center flex-shrink-0 text-sm">
                {{ ch.name[0].toUpperCase() }}
              </div>
              <span class="flex-1 text-sm font-medium truncate">{{ ch.name }}</span>
              <span *ngIf="ch.unreadCount" class="text-xs bg-accent-pink text-white font-bold px-1.5 py-0.5 rounded-full">
                {{ ch.unreadCount }}
              </span>
            </a>
          </div>
        </nav>

        <!-- User footer -->
        <div class="border-t border-white/5 p-3">
          <div class="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 cursor-pointer transition-all group"
               [routerLink]="['/profile']" (click)="sidebarOpen.set(false)">
            <!-- Avatar -->
            <div class="relative flex-shrink-0">
              <div class="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-primary-500 to-accent-pink flex items-center justify-center">
                <img *ngIf="user()?.avatarUrl" [src]="user()?.avatarUrl" class="w-full h-full object-cover" />
                <span *ngIf="!user()?.avatarUrl" class="text-sm font-bold text-white">
                  {{ user()?.username?.[0]?.toUpperCase() }}
                </span>
              </div>
              <!-- Status dot -->
              <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-850"
                   [class]="statusColor()"></div>
            </div>
            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-white truncate leading-none">{{ user()?.username }}</p>
              <p class="text-xs mt-0.5" [class]="statusTextColor()">{{ statusLabel() }}</p>
            </div>
            <!-- Notifications bell -->
            <button (click)="$event.stopPropagation(); showNotifs.update(v => !v)"
              class="relative p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all">
              🔔
              <span *ngIf="unreadCount() > 0"
                class="absolute -top-1 -right-1 w-4 h-4 bg-accent-pink text-white text-xs rounded-full flex items-center justify-center font-bold">
                {{ unreadCount() > 9 ? '9+' : unreadCount() }}
              </span>
            </button>
            <!-- Logout -->
            <button (click)="$event.stopPropagation(); logout()"
              class="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
              title="Sign out">⏏</button>
          </div>
        </div>
      </aside>

      <!-- ─── MAIN CONTENT ────────────────────────────────── -->
      <main class="flex-1 flex flex-col min-w-0 overflow-hidden">

        <!-- Mobile header -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-surface-850/50 lg:hidden">
          <button (click)="sidebarOpen.update(v => !v)"
            class="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all">
            ☰
          </button>
          <div class="w-7 h-7 bg-gradient-to-br from-primary-500 to-accent-pink rounded-lg flex items-center justify-center">
            <span class="text-sm">🌍</span>
          </div>
          <span class="font-semibold text-white text-sm">WithoutBorder</span>
        </div>

        <router-outlet />
      </main>

      <!-- Notifications panel -->
      <wb-notifications-panel *ngIf="showNotifs()" (close)="showNotifs.set(false)" />

      <!-- Create channel modal -->
      <wb-create-channel-modal *ngIf="showCreateModal()"
        [type]="'team'"
        (close)="showCreateModal.set(false)"
        (created)="onChannelCreated($event)" />

      <wb-create-channel-modal *ngIf="showCreateDM()"
        [type]="'pair'"
        (close)="showCreateDM.set(false)"
        (created)="onChannelCreated($event)" />
    </div>
  `,
})
export class ChatLayoutComponent implements OnInit {
  private channelSvc = inject(ChannelService);
  private userSvc = inject(UserService);
  private authSvc = inject(AuthService);
  private aiSvc = inject(AiService);
  private router = inject(Router);

  sidebarOpen = signal(false);
  showCreateModal = signal(false);
  showCreateDM = signal(false);
  showNotifs = signal(false);
  searchQuery = '';
  aiAvailable = signal(false);

  user = this.authSvc.user;
  unreadCount = this.userSvc.unreadCount;
  channels = this.channelSvc.channels;

  activeChannelId = computed(() => {
    const url = this.router.url;
    const match = url.match(/\/chat\/([^/]+)/);
    return match ? match[1] : null;
  });

  teamChannels = computed(() =>
    this.channels().filter(c => c.type === 'team' && c.name.toLowerCase().includes(this.searchQuery.toLowerCase()))
  );
  pairChannels = computed(() =>
    this.channels().filter(c => c.type === 'pair' && c.name.toLowerCase().includes(this.searchQuery.toLowerCase()))
  );
  isMobile = signal(window.innerWidth < 1024);

  langInfo = computed(() => {
    const lang = this.user()?.preferredLanguage;
    return lang ? LANGUAGE_MAP[lang] : null;
  });

  statusColor = computed(() => {
    const s = this.user()?.status;
    return s === 'active' ? 'bg-accent-green' : s === 'agentic' ? 'bg-accent-violet animate-pulse' : 'bg-gray-500';
  });
  statusTextColor = computed(() => {
    const s = this.user()?.status;
    return s === 'active' ? 'text-accent-green' : s === 'agentic' ? 'text-accent-violet' : 'text-gray-500';
  });
  statusLabel = computed(() => {
    const s = this.user()?.status;
    return s === 'active' ? '● Active' : s === 'agentic' ? '◆ Agentic (AI)' : '○ Inactive';
  });

  ngOnInit() {
    this.channelSvc.loadChannels().subscribe();
    this.userSvc.loadNotifications().subscribe();
    this.aiSvc.checkHealth().subscribe({ next: r => this.aiAvailable.set(r.available), error: () => {} });
    window.addEventListener('resize', () => this.isMobile.set(window.innerWidth < 1024));
  }

  onSearch(q: string) { this.searchQuery = q; }

  onChannelCreated(ch: Channel) {
    this.showCreateModal.set(false);
    this.showCreateDM.set(false);
    this.router.navigate(['/chat', ch.id]);
  }

  logout() { this.authSvc.logout(); }
}

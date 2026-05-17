import {
  Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { ChannelService } from '../../../core/services/channel.service';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { AgentService } from '../../../core/services/agent.service';
import { Channel, ChannelMember, UserStatus, LANGUAGE_MAP, getUserColor, getInitials } from '../../../core/models';

@Component({
  selector: 'wb-chat-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterOutlet],
  template: `
    <!-- Root: dark/light toggle applied on <html>, body inherits -->
    <div class="h-screen flex overflow-hidden transition-colors duration-300
                dark:bg-brand-darkBg bg-brand-lightBg
                dark:text-zinc-200 text-zinc-800">

      <!-- ═══════════════ SIDEBAR GAUCHE ═══════════════ -->
      <aside class="w-64 flex flex-col flex-shrink-0
                    dark:bg-brand-darkSidebar bg-brand-lightSidebar
                    border-r dark:border-brand-darkBorder border-brand-lightBorder z-30">

        <!-- Header: Logo + thème -->
        <div class="h-16 flex items-center px-5 gap-2
                    border-b dark:border-brand-darkBorder border-brand-lightBorder">
          <span class="font-bold text-sm tracking-wide dark:text-white text-zinc-900 uppercase">
            WithoutBorder
          </span>
          <button (click)="toggleTheme()"
                  class="p-1.5 rounded-lg dark:hover:bg-brand-orange/10 hover:bg-teal-400/16 dark:text-brand-orange text-teal-400 transition-ui ml-auto"
                  title="Basculer le thème">
            <!-- Soleil — affiché en mode dark pour passer en light -->
            <svg *ngIf="isDark()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <!-- Lune — affiché en mode light pour passer en dark -->
            <svg *ngIf="!isDark()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>
        </div>

        <!-- Recherche -->
        <div class="px-4 py-4">
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
            <input [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)"
              type="text" placeholder="Rechercher..."
              class="w-full dark:bg-brand-darkPanel bg-white border dark:border-brand-darkBorder
                     border-zinc-300 rounded-lg py-2 pl-9 pr-3 text-xs
                     focus:outline-none focus:border-brand-orange/50 transition-ui
                     dark:text-zinc-200 text-zinc-800 dark:placeholder-zinc-600 placeholder-zinc-400"/>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">

          <!-- ── Équipes ── -->
          <div>
            <div class="px-5 mb-2">
              <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Équipes</span>
            </div>
            <ul class="space-y-0.5">
              <li *ngFor="let ch of teamChannels(); let i = index">
                <button (click)="navigate(ch.id)"
                  class="w-full flex items-center justify-between px-4 py-2 text-xs font-medium transition-ui"
                  [class]="activeChannelId() === ch.id
                    ? 'nav-item-active'
                    : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200'">
                  <div class="flex items-center gap-3 truncate">
                    <span class="opacity-40 font-bold text-[10px] w-4 text-right flex-shrink-0">
                      #{{ i + 1 }}
                    </span>
                    <span class="truncate">{{ ch.name }}</span>
                  </div>
                  <span *ngIf="ch.unreadCount"
                    class="bg-brand-orange text-white text-[9px] px-1.5 py-0.5 rounded-full
                           font-bold shadow-sm min-w-[18px] text-center flex-shrink-0">
                    {{ ch.unreadCount }}
                  </span>
                </button>
              </li>
              <li *ngIf="teamChannels().length === 0"
                  class="px-5 py-2 text-[10px] text-zinc-500 italic">
                Aucune équipe
              </li>
            </ul>
          </div>

          <!-- ── Binômes (DMs) ── -->
          <div>
            <div class="px-5 mb-2">
              <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Binômes</span>
            </div>
            <ul class="space-y-0.5">
              <li *ngFor="let ch of pairChannels()">
                <button (click)="navigate(ch.id)"
                  class="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition-ui"
                  [class]="activeChannelId() === ch.id
                    ? 'nav-item-active'
                    : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200'">

                  <!-- Avatar + status dot -->
                  <div class="relative flex-shrink-0">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold"
                         [ngClass]="dmAvatarClass(ch.id)">
                      {{ getInitials(dmDisplayName(ch.id)) }}
                    </div>
                    <div class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2
                                dark:border-brand-darkSidebar border-white"
                         [ngClass]="dmStatusDot(ch.id)"></div>
                  </div>

                  <!-- Name + role / Agentic badge -->
                  <div class="flex flex-col items-start min-w-0 flex-1">
                    <span class="font-bold text-[11px] truncate w-full text-left"
                          [class]="activeChannelId() === ch.id ? 'text-brand-orange' : 'dark:text-zinc-200 text-zinc-800'">
                      {{ dmDisplayName(ch.id) }}
                    </span>
                    <ng-container *ngIf="dmPartnerStatus(ch.id) === 'agentic'; else dmRole">
                      <span class="text-[8px] px-1 py-0.5 bg-brand-orange/20 text-brand-orange
                                   rounded font-bold uppercase tracking-tight">Agentic</span>
                    </ng-container>
                    <ng-template #dmRole>
                      <span class="text-[9px] opacity-60 font-medium">{{ dmPartnerRole(ch.id) }}</span>
                    </ng-template>
                  </div>
                </button>
              </li>
              <li *ngIf="pairChannels().length === 0"
                  class="px-5 py-2 text-[10px] text-zinc-500 italic">
                Aucun binôme
              </li>
            </ul>
          </div>

          <!-- ── Agents IA ── -->
          <div>
            <div class="px-5 mb-2 flex items-center justify-between">
              <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Agents IA</span>
            </div>
            <ul class="space-y-0.5">
              <li *ngFor="let agent of agents()">
                <button (click)="navigate('agent-' + agent.id)"
                  class="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition-ui"
                  [class]="activeChannelId() === 'agent-' + agent.id
                    ? 'nav-item-active'
                    : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200'">
                  <!-- Avatar agent avec dot statut -->
                  <div class="relative flex-shrink-0">
                    <div class="agent-avatar w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold border
                                dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30
                                bg-teal-500/10 text-teal-600 border-teal-500/30">
                      {{ getInitials(agent.name) }}
                    </div>
                    <div class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2
                                dark:border-brand-darkSidebar border-white"
                         [class]="agent.isActive ? 'bg-green-500' : 'bg-amber-400'"></div>
                  </div>
                  <!-- Nom + badge IA -->
                  <div class="flex flex-col items-start min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 w-full">
                      <span class="font-bold text-[11px] truncate text-left
                                   dark:text-zinc-200 text-zinc-800">{{ agent.name }}</span>
                      <span class="text-[8px] px-1 py-0.5 rounded font-bold uppercase tracking-tight
                                   dark:bg-blue-500/18 dark:text-blue-400
                                   bg-teal-500/15 text-teal-600">IA</span>
                    </div>
                    <span class="text-[9px] opacity-60 font-medium truncate w-full text-left">{{ agent.description }}</span>
                  </div>
                </button>
              </li>
              <li *ngIf="agents().length === 0"
                  class="px-5 py-2 text-[10px] text-zinc-500 italic">
                Aucun agent
              </li>
            </ul>
          </div>

        </nav>

        <!-- User profile card with status menu -->
        <div class="p-4 border-t dark:border-brand-darkBorder border-brand-lightBorder relative" id="user-card-wrap">

          <!-- Status dropdown -->
          <div *ngIf="statusMenuOpen()"
               class="absolute bottom-full left-4 right-4 mb-2 rounded-[14px] border z-50
                      dark:bg-[#1C1C20] dark:border-white/9 bg-white border-slate-200
                      shadow-[0_12px_40px_rgba(0,0,0,0.22)]
                      animate-[statusFadeUp_0.15s_ease-out]">
            <div class="px-3.5 py-2.5 text-[9.5px] font-bold uppercase tracking-[.09em]
                        dark:text-zinc-500 text-slate-400
                        border-b dark:border-white/7 border-slate-100">Mon statut</div>
            <div class="p-1.5 space-y-0.5">
              <button (click)="setStatus('active')"
                class="status-opt w-full flex items-center gap-2.5 px-3 py-2 rounded-[9px] text-[12.5px] font-medium
                       dark:text-zinc-300 text-slate-700 dark:hover:bg-white/6 hover:bg-slate-50 transition-all">
                <div class="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-green-500"></div>
                <span>Actif</span>
                <svg *ngIf="user()?.status === 'active'" class="ml-auto w-3 h-3 text-green-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button (click)="setStatus('absent')"
                class="w-full flex items-center gap-2.5 px-3 py-2 rounded-[9px] text-[12.5px] font-medium
                       dark:text-zinc-300 text-slate-700 dark:hover:bg-white/6 hover:bg-slate-50 transition-all">
                <div class="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-amber-400"></div>
                <span>Absent</span>
                <svg *ngIf="user()?.status === 'absent'" class="ml-auto w-3 h-3 text-amber-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button (click)="setStatus('communication')"
                class="w-full flex items-center gap-2.5 px-3 py-2 rounded-[9px] text-[12.5px] font-medium
                       dark:text-zinc-300 text-slate-700 dark:hover:bg-white/6 hover:bg-slate-50 transition-all">
                <div class="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-blue-500"></div>
                <span>En communication</span>
                <svg *ngIf="user()?.status === 'communication'" class="ml-auto w-3 h-3 text-blue-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button (click)="setStatus('agentic')"
                class="w-full flex items-center gap-2.5 px-3 py-2 rounded-[9px] text-[12.5px] font-medium
                       dark:text-zinc-300 text-slate-700 dark:hover:bg-white/6 hover:bg-slate-50 transition-all">
                <div class="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-brand-orange dot-agentic"></div>
                <div class="flex flex-col items-start flex-1">
                  <span>Mode Agent</span>
                  <span class="text-[9px] opacity-60">Déléguer à un agent IA</span>
                </div>
                <svg *ngIf="user()?.status === 'agentic'" class="w-3 h-3 text-brand-orange" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
          </div>

          <!-- Clickable user card -->
          <div (click)="toggleStatusMenu($event)"
               class="flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:opacity-80 transition-ui select-none
                      dark:bg-brand-darkPanel bg-white border dark:border-brand-darkBorder border-zinc-200">
            <!-- Avatar with agentic ring -->
            <div class="relative flex-shrink-0">
              <img [src]="userAvatarUrl()"
                   class="w-8 h-8 rounded-lg shadow-sm transition-all"
                   [class]="user()?.status === 'agentic' ? 'avatar-agentic' : ''"
                   alt="Avatar">
              <!-- Bot badge — visible in agentic mode only -->
              <div *ngIf="user()?.status === 'agentic'"
                   class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-brand-orange
                          border-2 dark:border-brand-darkSidebar border-white
                          flex items-center justify-center">
                <svg viewBox="0 0 20 20" fill="white" style="width:8px;height:8px">
                  <path d="M10 2a1.5 1.5 0 011.5 1.5c0 .45-.2.86-.5 1.14V6h1A5 5 0 0117 11h.5a.5.5 0 010 1H17v.5A4 4 0 0113 16.5v.5a.5.5 0 01-1 0v-.5H8v.5a.5.5 0 01-1 0v-.5A4 4 0 013 12.5V12h-.5a.5.5 0 010-1H3A5 5 0 018 6h1V4.64c-.3-.28-.5-.69-.5-1.14A1.5 1.5 0 0110 2zM7.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm5 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
                </svg>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold truncate dark:text-white text-zinc-900">{{ user()?.username }}</p>
              <p class="text-[9px] text-zinc-500 font-medium">{{ userStatusLabel() }}</p>
            </div>
            <!-- Status dot -->
            <div class="w-2 h-2 rounded-full flex-shrink-0"
                 [class]="currentUserDot()"
                 [class.dot-agentic]="user()?.status === 'agentic'"></div>
          </div>
        </div>
      </aside>

      <!-- ═══════════════ ZONE PRINCIPALE ═══════════════ -->
      <main class="flex-1 flex flex-col relative min-w-0">
        <router-outlet />
      </main>

    </div>
  `,
})
export class ChatLayoutComponent implements OnInit, OnDestroy {
  private channelSvc = inject(ChannelService);
  private userSvc    = inject(UserService);
  private authSvc    = inject(AuthService);
  private agentSvc   = inject(AgentService);
  private router     = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private routerSub!: Subscription;

  // Click-outside handler reference for proper cleanup
  private clickOutsideHandler = () => this.statusMenuOpen.set(false);

  // Expose helpers to template
  getInitials = getInitials;

  isDark      = signal(true);
  searchQuery = signal('');
  user        = this.authSvc.user;
  channels    = this.channelSvc.channels;
  agents      = this.agentSvc.agents;

  /** Status menu open/closed state */
  statusMenuOpen = signal(false);

  /** Map of channel ID → partner ChannelMember info (populated after loading channels). */
  dmPartnersMap = signal<Map<string, ChannelMember>>(new Map());

  /** Reactive active channel ID — updated on every NavigationEnd event. */
  activeChannelId = signal<string | null>(null);

  teamChannels = computed(() =>
    this.channels().filter(c =>
      c.type === 'team' &&
      !c.isArchived &&
      c.name.toLowerCase().includes(this.searchQuery().toLowerCase())
    )
  );

  pairChannels = computed(() =>
    this.channels().filter(c =>
      c.type === 'pair' &&
      !c.isArchived &&
      c.name.toLowerCase().includes(this.searchQuery().toLowerCase())
    )
  );

  langBadge = computed(() => {
    const lang = this.user()?.preferredLanguage;
    return lang ? (LANGUAGE_MAP[lang]?.badge ?? lang.toUpperCase()) : '??';
  });

  userRoleLabel = computed(() => {
    const s = this.user()?.status;
    if (s === 'agentic') return 'Agentic';
    return 'Membre';
  });

  userStatusLabel = computed(() => {
    const s = this.user()?.status;
    if (s === 'agentic') return 'Mode Agent';
    if (s === 'absent') return 'Absent';
    if (s === 'communication') return 'En communication';
    return `${this.langBadge()} · Membre`;
  });

  currentUserDot = computed(() => {
    const s = this.user()?.status;
    if (s === 'agentic') return 'bg-brand-orange';
    if (s === 'absent') return 'bg-amber-400';
    if (s === 'communication') return 'bg-blue-500';
    if (s === 'inactive') return 'bg-zinc-400';
    return 'bg-green-500';
  });

  userAvatarUrl = computed(() => {
    const u = this.user();
    if (u?.avatarUrl) return u.avatarUrl;
    const name = encodeURIComponent(u?.username ?? 'U');
    return `https://ui-avatars.com/api/?name=${name}&background=f97316&color=fff`;
  });

  ngOnInit() {
    this.initTheme();
    this.syncActiveChannelFromUrl();
    this.routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.syncActiveChannelFromUrl());
    this.channelSvc.loadChannels().subscribe(() => {
      this.loadDmPartners();
      this.autoNavigateToFirstChannel();
    });
    this.agentSvc.loadAgents().subscribe();
    this.userSvc.loadNotifications().subscribe();
    document.addEventListener('click', this.clickOutsideHandler);
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
    document.removeEventListener('click', this.clickOutsideHandler);
  }

  toggleStatusMenu(event: Event) {
    event.stopPropagation();
    this.statusMenuOpen.update(v => !v);
  }

  setStatus(status: UserStatus) {
    this.userSvc.updateStatus(status).subscribe();
    this.statusMenuOpen.set(false);
  }

  private syncActiveChannelFromUrl() {
    const match = this.router.url.match(/\/chat\/([^/?]+)/);
    this.activeChannelId.set(match ? match[1] : null);
  }

  private autoNavigateToFirstChannel() {
    if (!this.activeChannelId()) {
      const first = this.teamChannels()[0] ?? this.pairChannels()[0];
      if (first) this.router.navigate(['/chat', first.id], { replaceUrl: true });
    }
  }

  /** Restore theme from localStorage and apply to <html>. */
  private initTheme() {
    if (!isPlatformBrowser(this.platformId)) return;
    const stored = localStorage.getItem('wb-theme');
    const dark = stored !== 'light';
    this.isDark.set(dark);
    this.applyTheme(dark);
  }

  toggleTheme() {
    const next = !this.isDark();
    this.isDark.set(next);
    this.applyTheme(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('wb-theme', next ? 'dark' : 'light');
    }
  }

  private applyTheme(dark: boolean) {
    const html = document.documentElement;
    if (dark) {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
    }
  }

  navigate(channelId: string) {
    this.router.navigate(['/chat', channelId]);
  }

  /** Fetch members for every pair channel to get partner info (name, status, role). */
  private loadDmPartners() {
    const pairs = this.channels().filter(c => c.type === 'pair');
    const currentUserId = this.user()?.id;
    pairs.forEach(ch => {
      this.channelSvc.getMembers(ch.id).subscribe({
        next: (rawMembers: unknown[]) => {
          const partner = rawMembers
            .map(r => this.mapMember(r as Record<string, unknown>))
            .find(m => m.userId !== currentUserId);
          if (partner) {
            this.dmPartnersMap.update(map => {
              const next = new Map(map);
              next.set(ch.id, partner);
              return next;
            });
          }
        },
        error: () => {},
      });
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

  dmPartner(channelId: string): ChannelMember | undefined {
    return this.dmPartnersMap().get(channelId);
  }

  dmDisplayName(channelId: string): string {
    return this.dmPartner(channelId)?.username ?? '...';
  }

  dmPartnerStatus(channelId: string): string {
    return this.dmPartner(channelId)?.status ?? 'active';
  }

  dmPartnerRole(channelId: string): string {
    const lang = this.dmPartner(channelId)?.preferredLanguage;
    const badge = lang ? (LANGUAGE_MAP[lang]?.badge ?? lang.toUpperCase()) : '??';
    return badge;
  }

  dmStatusDot(channelId: string): string {
    const s = this.dmPartnerStatus(channelId);
    return s === 'agentic' ? 'bg-brand-orange' : s === 'inactive' ? 'bg-zinc-400' : 'bg-green-500';
  }

  dmAvatarClass(channelId: string): string {
    const partner = this.dmPartner(channelId);
    const color = partner ? getUserColor(partner.userId) : 'orange';
    return `bg-${color}-500/10 text-${color}-500 border border-${color}-500/30`;
  }

  logout() { this.authSvc.logout(); }
}

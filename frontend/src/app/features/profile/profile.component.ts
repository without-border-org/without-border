import { Component, inject, signal, computed, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { AgentService } from '../../core/services/agent.service';
import { ChannelService } from '../../core/services/channel.service';
import { Agent, LANGUAGE_MAP, UserStatus, getInitials } from '../../core/models';

@Component({
  selector: 'wb-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="h-full overflow-y-auto bg-surface-900">
      <div class="min-h-full p-4 sm:p-8">
        <div class="max-w-4xl mx-auto pb-8">

          <a routerLink="/chat" class="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
            ← Retour au chat
          </a>

          <div class="bg-gradient-to-br from-primary-500/20 to-accent-pink/10 border border-primary-500/20 rounded-3xl p-8 mb-6 relative overflow-hidden">
            <div class="absolute top-0 right-0 w-48 h-48 bg-primary-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>

            <div class="flex flex-col sm:flex-row sm:items-center gap-6 relative z-10">
              <div class="relative flex-shrink-0">
                <div class="w-24 h-24 rounded-3xl overflow-hidden bg-gradient-to-br from-primary-500 to-accent-pink flex items-center justify-center shadow-glow-primary">
                  <img *ngIf="user()?.avatarUrl" [src]="user()?.avatarUrl" class="w-full h-full object-cover" />
                  <span *ngIf="!user()?.avatarUrl" class="text-4xl font-bold text-white">
                    {{ user()?.username?.[0]?.toUpperCase() }}
                  </span>
                </div>
                <div class="absolute -bottom-2 -right-2 flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold"
                     [class]="statusStyle()">
                  {{ statusLabelWithIcon() }}
                </div>
              </div>

              <div>
                <h1 class="text-2xl font-bold text-white">{{ user()?.username }}</h1>
                <p class="text-gray-400 text-sm mt-1">{{ user()?.email }}</p>
                <div class="flex items-center gap-2 mt-2">
                  <span class="text-lg">{{ langInfo()?.flag }}</span>
                  <span class="text-sm text-gray-300">{{ langInfo()?.name }}</span>
                </div>
              </div>
            </div>
          </div>

          <div *ngIf="feedback() as message"
               class="mb-5 rounded-2xl border px-4 py-3 text-sm"
               [class]="message.type === 'success'
                 ? 'bg-accent-green/10 border-accent-green/20 text-accent-green'
                 : 'bg-red-500/10 border-red-500/20 text-red-300'">
            {{ message.text }}
          </div>

          <div class="bg-surface-850 border border-white/5 rounded-2xl p-5 mb-5">
            <div class="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 class="text-sm font-semibold text-white">Statut</h2>
                <p class="text-xs text-gray-500 mt-1">Choisissez comment les autres vous voient dans WithoutBorder.</p>
              </div>
            </div>
            <div class="grid grid-cols-2 xl:grid-cols-5 gap-3">
              <button *ngFor="let status of statusOptions"
                type="button"
                (click)="changeStatus(status.value)"
                [disabled]="saving()"
                class="flex flex-col items-center text-center gap-2 py-3 px-3 rounded-xl border transition-all disabled:opacity-60"
                [class]="user()?.status === status.value
                  ? status.activeClass
                  : 'bg-white/3 border-white/5 text-gray-500 hover:bg-white/5 hover:text-gray-300'">
                <span class="text-2xl">{{ status.icon }}</span>
                <span class="text-xs font-medium">{{ status.label }}</span>
                <span class="text-xs opacity-60">{{ status.desc }}</span>
              </button>
            </div>
          </div>

          <div class="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div class="bg-surface-850 border border-white/5 rounded-2xl p-5">
              <h2 class="text-sm font-semibold text-white mb-4">Profil</h2>
              <div class="space-y-4">
                <div>
                  <label class="block text-xs font-medium text-gray-400 mb-2">Nom d'utilisateur</label>
                  <input [(ngModel)]="editUsername" class="wb-input" placeholder="username" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-400 mb-2">Langue préférée</label>
                  <select [(ngModel)]="editLanguage" class="wb-input">
                    <option *ngFor="let lang of languages" [value]="lang.code">{{ lang.flag }} {{ lang.name }}</option>
                  </select>
                </div>
                <button (click)="saveProfile()" [disabled]="saving()"
                  class="w-full py-2.5 bg-primary-500 hover:bg-primary-400 text-white text-sm font-medium rounded-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none">
                  {{ saving() ? 'Enregistrement...' : 'Enregistrer le profil' }}
                </button>
              </div>
            </div>

            <div class="bg-surface-850 border border-white/5 rounded-2xl p-5">
              <div class="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 class="text-sm font-semibold text-white">Réponses agentiques</h2>
                  <p class="text-xs text-gray-500 mt-1">Activez votre agent pour répondre à votre place quand vous passez en mode agent.</p>
                </div>
                <button type="button" (click)="toggleAgentic()" [disabled]="saving()"
                  class="relative w-12 h-6 rounded-full transition-all duration-200 disabled:opacity-50"
                  [class]="user()?.agenticEnabled ? 'bg-accent-violet' : 'bg-white/10'">
                  <div class="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
                       [class]="user()?.agenticEnabled ? 'left-7' : 'left-1'"></div>
                </button>
              </div>

              <div class="space-y-4">
                <div class="rounded-xl border p-3 text-xs"
                     [class]="user()?.agenticEnabled
                       ? 'bg-accent-violet/10 border-accent-violet/20 text-accent-violet'
                       : 'bg-white/5 border-white/10 text-gray-300'">
                  {{ user()?.agenticEnabled
                    ? 'Votre agent peut répondre automatiquement dès que votre statut est en mode agent.'
                    : 'Activez cette option pour permettre à votre agent de répondre quand votre statut est en mode agent.' }}
                </div>

                <div>
                  <label class="block text-xs font-medium text-gray-400 mb-2">
                    Persona de l'agent
                    <span class="text-gray-600 font-normal ml-1">— décrivez le ton et les consignes</span>
                  </label>
                  <textarea [(ngModel)]="editPersona" rows="5"
                    placeholder="Ex. : Je suis développeur frontend. Réponds de façon professionnelle, concise et indique quand un suivi humain est nécessaire."
                    class="wb-input resize-none"></textarea>
                </div>

                <button (click)="savePersona()" [disabled]="saving()"
                  class="w-full py-2 bg-accent-violet/20 hover:bg-accent-violet/30 border border-accent-violet/20 text-accent-violet text-sm font-medium rounded-xl transition-all disabled:opacity-50">
                  {{ saving() ? 'Enregistrement...' : 'Enregistrer la configuration agentique' }}
                </button>
              </div>
            </div>
          </div>

          <div *ngIf="showAgentConfig()" class="bg-surface-850 border border-white/5 rounded-2xl p-5 mt-5">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
              <div>
                <h2 class="text-sm font-semibold text-white">Configurer l'agent</h2>
                <p class="text-xs text-gray-500 mt-1">Accédez rapidement à un agent IA pour finaliser son contexte ou démarrer une conversation.</p>
              </div>
              <a routerLink="/chat"
                 class="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-sm text-gray-300 hover:bg-white/5 transition-all">
                Retourner aux conversations
              </a>
            </div>

            <div *ngIf="user()?.status === 'agentic' && !user()?.agenticEnabled"
                 class="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
              Le statut <strong>Mode agent</strong> est actif, mais les réponses automatiques sont désactivées. Activez le bouton ci-dessus pour déléguer vos réponses.
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <button *ngFor="let agent of agents()"
                type="button"
                (click)="openAgentWorkspace(agent.id)"
                class="text-left rounded-2xl border border-white/8 bg-white/4 hover:bg-white/7 transition-all p-4">
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold border flex-shrink-0
                              dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30
                              bg-teal-500/10 text-teal-300 border-teal-500/30">
                    {{ getInitials(agent.name) }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <p class="text-sm font-semibold text-white truncate">{{ agent.name }}</p>
                      <span class="w-2 h-2 rounded-full"
                            [class]="agent.isActive ? 'bg-accent-green' : 'bg-amber-400'"></span>
                    </div>
                    <p class="text-xs text-gray-400 mt-1 line-clamp-2">{{ agent.description || 'Agent IA WithoutBorder' }}</p>
                    <span class="inline-flex items-center gap-1 text-xs text-primary-300 mt-3">
                      Configurer dans le chat →
                    </span>
                  </div>
                </div>
              </button>
            </div>

            <div *ngIf="agents().length === 0" class="rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-gray-400">
              Aucun agent n'est disponible pour le moment.
            </div>
          </div>

          <div class="bg-red-500/5 border border-red-500/10 rounded-2xl p-5 mt-5">
            <h2 class="text-sm font-semibold text-red-400 mb-3">Déconnexion</h2>
            <button (click)="logout()"
              class="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors">
              ⏏ Se déconnecter de WithoutBorder
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ProfileComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private userSvc = inject(UserService);
  private agentSvc = inject(AgentService);
  private channelSvc = inject(ChannelService);
  private router = inject(Router);
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private hasHydratedForm = false;

  user = this.auth.user;
  agents = this.agentSvc.agents;
  channels = this.channelSvc.channels;
  saving = signal(false);
  feedback = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  editUsername = '';
  editLanguage = 'en';
  editPersona = '';

  languages = Object.entries(LANGUAGE_MAP).map(([code, val]) => ({ code, ...val }));
  getInitials = getInitials;

  statusOptions: { value: UserStatus; label: string; icon: string; desc: string; activeClass: string }[] = [
    { value: 'active', label: 'Actif', icon: '🟢', desc: 'Disponible', activeClass: 'bg-accent-green/15 border-accent-green/30 text-accent-green' },
    { value: 'absent', label: 'Absent', icon: '🟠', desc: 'Temporairement absent', activeClass: 'bg-amber-400/15 border-amber-400/30 text-amber-300' },
    { value: 'communication', label: 'En communication', icon: '🔵', desc: 'Occupé en échange', activeClass: 'bg-blue-500/15 border-blue-500/30 text-blue-300' },
    { value: 'agentic', label: 'Mode agent', icon: '🤖', desc: 'L’IA peut répondre', activeClass: 'bg-accent-violet/15 border-accent-violet/30 text-accent-violet' },
    { value: 'inactive', label: 'Inactif', icon: '⚫', desc: 'Hors ligne', activeClass: 'bg-gray-500/15 border-gray-500/30 text-gray-400' },
  ];

  langInfo = computed(() => {
    const lang = this.user()?.preferredLanguage;
    return lang ? LANGUAGE_MAP[lang] : null;
  });

  statusStyle = computed(() => this.getStatusOption(this.user()?.status)?.activeClass ?? 'bg-gray-500/20 border-gray-500/30 text-gray-400');

  statusLabelWithIcon = computed(() => {
    const status = this.getStatusOption(this.user()?.status);
    return status ? `${status.icon} ${status.label}` : '⚫ Inactif';
  });

  // Always show agent config so users can configure it regardless of their current status
  showAgentConfig = computed(() => true);

  constructor() {
    effect(() => {
      const currentUser = this.user();
      if (!currentUser || this.hasHydratedForm) return;
      this.editUsername = currentUser.username;
      this.editLanguage = currentUser.preferredLanguage;
      this.editPersona = currentUser.agenticPersona || '';
      this.hasHydratedForm = true;
    });
  }

  ngOnInit() {
    if (this.agents().length === 0) {
      this.agentSvc.loadAgents().subscribe();
    }
  }

  ngOnDestroy() {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }
  }

  changeStatus(status: UserStatus) {
    const shouldEnableAgentic = status === 'agentic' && !this.user()?.agenticEnabled;
    this.saving.set(true);
    this.feedback.set(null);

    this.userSvc.updateStatus(status).pipe(
      switchMap(() => shouldEnableAgentic ? this.userSvc.updateMe({ agenticEnabled: true }) : of(null)),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: () => {
        this.setFeedback('success', status === 'agentic'
          ? 'Mode agent activé. Vous pouvez maintenant configurer votre agent ci-dessous.'
          : 'Statut mis à jour.');
      },
      error: () => this.setFeedback('error', 'Impossible de mettre à jour le statut.'),
    });
  }

  toggleAgentic() {
    const current = !!this.user()?.agenticEnabled;
    this.saving.set(true);
    this.feedback.set(null);

    this.userSvc.updateMe({ agenticEnabled: !current }).pipe(
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: () => {
        this.setFeedback('success', !current
          ? 'Réponses agentiques activées.'
          : 'Réponses agentiques désactivées.');
      },
      error: () => this.setFeedback('error', 'Impossible de mettre à jour la configuration agentique.'),
    });
  }

  saveProfile() {
    const username = this.editUsername.trim();
    if (username.length < 3) {
      this.setFeedback('error', 'Le nom d’utilisateur doit contenir au moins 3 caractères.');
      return;
    }

    this.saving.set(true);
    this.feedback.set(null);
    this.userSvc.updateMe({ username, preferredLanguage: this.editLanguage }).pipe(
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: () => {
        this.editUsername = username;
        this.setFeedback('success', 'Profil mis à jour.');
      },
      error: () => this.setFeedback('error', 'Impossible d’enregistrer le profil.'),
    });
  }

  savePersona() {
    this.saving.set(true);
    this.feedback.set(null);
    this.userSvc.updateMe({ agenticPersona: this.editPersona }).pipe(
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: () => this.setFeedback('success', 'Configuration agentique enregistrée.'),
      error: () => this.setFeedback('error', 'Impossible d’enregistrer la configuration agentique.'),
    });
  }

  openAgentWorkspace(agentId: string) {
    const agent = this.agents().find(candidate => candidate.id === agentId);
    if (!agent) {
      this.setFeedback('error', 'Agent introuvable.');
      return;
    }

    const existingChannel = this.agentSvc.findChannelForAgent(agent, this.channels());
    if (existingChannel) {
      this.agentSvc.linkChannelToAgent(existingChannel.id, agent.id);
      this.router.navigate(['/chat', existingChannel.id]);
      return;
    }

    this.channelSvc.loadChannels().subscribe({
      next: () => {
        const refreshedChannel = this.agentSvc.findChannelForAgent(agent, this.channels());
        if (!refreshedChannel) {
          this.setFeedback('error', 'Aucun salon associé à cet agent n’a été trouvé.');
          return;
        }

        this.agentSvc.linkChannelToAgent(refreshedChannel.id, agent.id);
        this.router.navigate(['/chat', refreshedChannel.id]);
      },
      error: () => this.setFeedback('error', 'Impossible de charger les conversations de l’agent.'),
    });
  }

  logout() {
    this.auth.logout();
  }

  private getStatusOption(status: UserStatus | undefined) {
    return status ? this.statusOptions.find(option => option.value === status) : undefined;
  }

  private setFeedback(type: 'success' | 'error', text: string) {
    this.feedback.set({ type, text });
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }
    this.feedbackTimer = setTimeout(() => this.feedback.set(null), 3000);
  }
}

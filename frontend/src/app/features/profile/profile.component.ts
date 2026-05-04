import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { LANGUAGE_MAP } from '../../core/models';

@Component({
  selector: 'wb-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-surface-900 p-4 sm:p-8">
      <div class="max-w-2xl mx-auto">

        <!-- Back -->
        <a routerLink="/chat" class="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
          ← Back to chat
        </a>

        <!-- Header card -->
        <div class="bg-gradient-to-br from-primary-500/20 to-accent-pink/10 border border-primary-500/20 rounded-3xl p-8 mb-6 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-48 h-48 bg-primary-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>

          <div class="flex items-center gap-6 relative z-10">
            <!-- Avatar -->
            <div class="relative flex-shrink-0">
              <div class="w-24 h-24 rounded-3xl overflow-hidden bg-gradient-to-br from-primary-500 to-accent-pink flex items-center justify-center shadow-glow-primary">
                <img *ngIf="user()?.avatarUrl" [src]="user()?.avatarUrl" class="w-full h-full object-cover" />
                <span *ngIf="!user()?.avatarUrl" class="text-4xl font-bold text-white">
                  {{ user()?.username?.[0]?.toUpperCase() }}
                </span>
              </div>
              <!-- Status badge -->
              <div class="absolute -bottom-2 -right-2 flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold"
                   [class]="statusStyle()">
                {{ statusEmoji() }}
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

        <!-- Status quick switch -->
        <div class="bg-surface-850 border border-white/5 rounded-2xl p-5 mb-5">
          <h2 class="text-sm font-semibold text-white mb-4">Status</h2>
          <div class="grid grid-cols-3 gap-3">
            <button *ngFor="let s of statusOptions" (click)="changeStatus(s.value)"
              class="flex flex-col items-center gap-2 py-3 px-2 rounded-xl border transition-all"
              [class]="user()?.status === s.value
                ? s.activeClass
                : 'bg-white/3 border-white/5 text-gray-500 hover:bg-white/5 hover:text-gray-300'">
              <span class="text-2xl">{{ s.icon }}</span>
              <span class="text-xs font-medium">{{ s.label }}</span>
              <span class="text-xs opacity-60">{{ s.desc }}</span>
            </button>
          </div>
        </div>

        <!-- Edit profile -->
        <div class="bg-surface-850 border border-white/5 rounded-2xl p-5 mb-5">
          <h2 class="text-sm font-semibold text-white mb-4">Profile Settings</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-2">Username</label>
              <input [(ngModel)]="editUsername" class="wb-input" placeholder="username" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-2">Preferred Language</label>
              <select [(ngModel)]="editLanguage" class="wb-input">
                <option *ngFor="let lang of languages" [value]="lang.code">{{ lang.flag }} {{ lang.name }}</option>
              </select>
            </div>
            <button (click)="saveProfile()" [disabled]="saving()"
              class="w-full py-2.5 bg-primary-500 hover:bg-primary-400 text-white text-sm font-medium rounded-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-50">
              {{ saving() ? 'Saving...' : 'Save Changes' }}
            </button>
            <div *ngIf="saveSuccess()" class="text-center text-xs text-accent-green">✓ Profile updated</div>
          </div>
        </div>

        <!-- AI Backup Agent -->
        <div class="bg-surface-850 border border-white/5 rounded-2xl p-5 mb-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-sm font-semibold text-white">🤖 Backup AI Agent</h2>
              <p class="text-xs text-gray-500 mt-1">Your AI replies when you're away</p>
            </div>
            <!-- Toggle -->
            <button (click)="toggleAgentic()"
              class="relative w-12 h-6 rounded-full transition-all duration-200"
              [class]="user()?.agenticEnabled ? 'bg-accent-violet' : 'bg-white/10'">
              <div class="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
                   [class]="user()?.agenticEnabled ? 'left-7' : 'left-1'"></div>
            </button>
          </div>

          <div *ngIf="user()?.agenticEnabled" class="space-y-3 animate-fade-in">
            <div class="bg-accent-violet/10 border border-accent-violet/20 rounded-xl p-3 text-xs text-accent-violet">
              ◆ Agent active — it will reply on your behalf when your status is "Agentic"
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-2">
                Agent Persona
                <span class="text-gray-600 font-normal ml-1">— describe how your agent should behave</span>
              </label>
              <textarea [(ngModel)]="editPersona" rows="3"
                placeholder="e.g. I'm a frontend developer. Reply professionally and concisely. If unsure, say you'll check when back."
                class="wb-input resize-none"></textarea>
            </div>
            <button (click)="savePersona()" [disabled]="saving()"
              class="w-full py-2 bg-accent-violet/20 hover:bg-accent-violet/30 border border-accent-violet/20 text-accent-violet text-sm font-medium rounded-xl transition-all">
              Save Agent Settings
            </button>
          </div>
        </div>

        <!-- Danger zone -->
        <div class="bg-red-500/5 border border-red-500/10 rounded-2xl p-5">
          <h2 class="text-sm font-semibold text-red-400 mb-3">Sign Out</h2>
          <button (click)="logout()"
            class="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors">
            ⏏ Sign out of WithoutBorder
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ProfileComponent implements OnInit {
  private auth = inject(AuthService);
  private userSvc = inject(UserService);
  private router = inject(Router);

  user = this.auth.user;
  saving = signal(false);
  saveSuccess = signal(false);

  editUsername = '';
  editLanguage = 'en';
  editPersona = '';

  languages = Object.entries(LANGUAGE_MAP).map(([code, val]) => ({ code, ...val }));

  statusOptions = [
    { value: 'active', label: 'Active', icon: '🟢', desc: 'Available', activeClass: 'bg-accent-green/15 border-accent-green/30 text-accent-green' },
    { value: 'agentic', label: 'Agentic', icon: '🤖', desc: 'AI replies', activeClass: 'bg-accent-violet/15 border-accent-violet/30 text-accent-violet' },
    { value: 'inactive', label: 'Inactive', icon: '⚫', desc: 'Away', activeClass: 'bg-gray-500/15 border-gray-500/30 text-gray-400' },
  ];

  langInfo = computed(() => {
    const lang = this.user()?.preferredLanguage;
    return lang ? LANGUAGE_MAP[lang] : null;
  });

  statusStyle = computed(() => {
    const s = this.user()?.status;
    return s === 'active' ? 'bg-accent-green/20 border-accent-green/30 text-accent-green'
         : s === 'agentic' ? 'bg-accent-violet/20 border-accent-violet/30 text-accent-violet'
         : 'bg-gray-500/20 border-gray-500/30 text-gray-400';
  });

  statusEmoji = computed(() => {
    const s = this.user()?.status;
    return s === 'active' ? '🟢 Active' : s === 'agentic' ? '🤖 Agentic' : '⚫ Inactive';
  });

  ngOnInit() {
    const u = this.user();
    if (u) {
      this.editUsername = u.username;
      this.editLanguage = u.preferredLanguage;
      this.editPersona = u.agenticPersona || '';
    }
  }

  changeStatus(status: 'active' | 'agentic' | 'inactive') {
    this.userSvc.updateStatus(status).subscribe();
  }

  toggleAgentic() {
    const current = this.user()?.agenticEnabled;
    this.userSvc.updateMe({ agenticEnabled: !current }).subscribe();
  }

  saveProfile() {
    this.saving.set(true);
    this.userSvc.updateMe({ username: this.editUsername, preferredLanguage: this.editLanguage }).subscribe({
      next: () => { this.saving.set(false); this.saveSuccess.set(true); setTimeout(() => this.saveSuccess.set(false), 2000); },
      error: () => this.saving.set(false),
    });
  }

  savePersona() {
    this.saving.set(true);
    this.userSvc.updateMe({ agenticPersona: this.editPersona }).subscribe({
      next: () => { this.saving.set(false); this.saveSuccess.set(true); setTimeout(() => this.saveSuccess.set(false), 2000); },
      error: () => this.saving.set(false),
    });
  }

  logout() { this.auth.logout(); }
}

import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ChannelService } from '../../../core/services/channel.service';
import { LANGUAGE_MAP } from '../../../core/models';

@Component({
  selector: 'wb-welcome',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      <!-- BG orbs brand -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 left-1/4 w-64 h-64 bg-brand-orange/5 rounded-full blur-3xl animate-pulse-slow"></div>
        <div class="absolute bottom-1/4 right-1/4 w-64 h-64 bg-brand-orange/3 rounded-full blur-3xl animate-pulse-slow" style="animation-delay:2s"></div>
      </div>

      <div class="relative z-10 max-w-md animate-fade-in">
        <!-- Logo -->
        <div class="w-20 h-20 bg-brand-orange/10 border border-brand-orange/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg class="w-10 h-10 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>

        <h1 class="text-2xl font-bold dark:text-white text-zinc-900 mb-2">
          Bonjour, {{ user()?.username }} !
        </h1>
        <p class="dark:text-zinc-500 text-zinc-500 text-sm leading-relaxed mb-8">
          Chaque message est automatiquement traduit dans la langue de chaque membre — sans barrières linguistiques.
        </p>

        <!-- Language badge -->
        <div class="inline-flex items-center gap-3 bg-brand-orange/10 border border-brand-orange/20 rounded-xl px-4 py-2.5 mb-8">
          <span class="text-xl">{{ langInfo()?.flag }}</span>
          <div class="text-left">
            <p class="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">Votre langue</p>
            <p class="text-sm font-semibold text-brand-orange">{{ langInfo()?.name }}</p>
          </div>
        </div>

        <!-- Features -->
        <div class="grid grid-cols-3 gap-3 mb-8 text-left">
          <div class="dark:bg-brand-darkPanel bg-white border dark:border-brand-darkBorder border-zinc-200 rounded-xl p-3">
            <div class="text-xl mb-2">🌍</div>
            <h3 class="text-xs font-semibold dark:text-white text-zinc-900 mb-1">Traduction temps réel</h3>
            <p class="text-[10px] dark:text-zinc-500 text-zinc-500 leading-relaxed">Messages traduits instantanément</p>
          </div>
          <div class="dark:bg-brand-darkPanel bg-white border dark:border-brand-darkBorder border-zinc-200 rounded-xl p-3">
            <div class="text-xl mb-2">🤖</div>
            <h3 class="text-xs font-semibold dark:text-white text-zinc-900 mb-1">Agent IA</h3>
            <p class="text-[10px] dark:text-zinc-500 text-zinc-500 leading-relaxed">Répond en votre absence</p>
          </div>
          <div class="dark:bg-brand-darkPanel bg-white border dark:border-brand-darkBorder border-zinc-200 rounded-xl p-3">
            <div class="text-xl mb-2">✨</div>
            <h3 class="text-xs font-semibold dark:text-white text-zinc-900 mb-1">Résumés auto</h3>
            <p class="text-[10px] dark:text-zinc-500 text-zinc-500 leading-relaxed">Synthèse et plans d'action</p>
          </div>
        </div>

        <p class="text-sm dark:text-zinc-500 text-zinc-400">
          Sélectionnez un canal dans la barre latérale pour commencer.
        </p>
      </div>
    </div>
  `,
})
export class WelcomeComponent {
  private auth = inject(AuthService);
  private channelSvc = inject(ChannelService);

  user = this.auth.user;
  channels = this.channelSvc.channels;
  langInfo = computed(() => {
    const lang = this.user()?.preferredLanguage;
    return lang ? LANGUAGE_MAP[lang] : null;
  });
}

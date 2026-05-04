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
      <!-- BG orbs -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 left-1/4 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl animate-pulse-slow"></div>
        <div class="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent-pink/8 rounded-full blur-3xl animate-pulse-slow" style="animation-delay:2s"></div>
      </div>

      <div class="relative z-10 max-w-md animate-fade-in">
        <!-- Logo big -->
        <div class="w-24 h-24 bg-gradient-to-br from-primary-500 to-accent-pink rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-glow-primary">
          <span class="text-5xl">🌍</span>
        </div>

        <h1 class="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-3">
          Welcome, {{ user()?.username }}!
        </h1>
        <p class="text-gray-400 leading-relaxed mb-8">
          Break language barriers with AI-powered translation. Every message reaches your teammates in their language — powered by <span class="text-primary-400 font-medium">Gemma 4</span>.
        </p>

        <!-- Language badge -->
        <div class="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 rounded-2xl px-5 py-3 mb-8">
          <span class="text-2xl">{{ langInfo()?.flag }}</span>
          <div class="text-left">
            <p class="text-xs text-gray-500">Your language</p>
            <p class="text-sm font-semibold text-primary-300">{{ langInfo()?.name }}</p>
          </div>
        </div>

        <!-- Features -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-left">
          <div class="bg-surface-850/60 border border-white/5 rounded-2xl p-4">
            <div class="text-2xl mb-2">🗣️</div>
            <h3 class="text-sm font-semibold text-white mb-1">Real-time Translation</h3>
            <p class="text-xs text-gray-500 leading-relaxed">Messages translated instantly for every member</p>
          </div>
          <div class="bg-surface-850/60 border border-white/5 rounded-2xl p-4">
            <div class="text-2xl mb-2">🤖</div>
            <h3 class="text-sm font-semibold text-white mb-1">AI Backup Agent</h3>
            <p class="text-xs text-gray-500 leading-relaxed">Your AI replies when you're away</p>
          </div>
          <div class="bg-surface-850/60 border border-white/5 rounded-2xl p-4">
            <div class="text-2xl mb-2">✨</div>
            <h3 class="text-sm font-semibold text-white mb-1">Smart Summaries</h3>
            <p class="text-xs text-gray-500 leading-relaxed">Auto-generated summaries and action plans</p>
          </div>
        </div>

        <!-- CTA -->
        <div class="flex items-center gap-3 justify-center">
          <p class="text-sm text-gray-500">
            {{ channels().length > 0 ? 'Select a channel from the sidebar or' : 'Get started by' }}
          </p>
          <button class="flex items-center gap-2 bg-primary-500 hover:bg-primary-400 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all transform hover:-translate-y-0.5 shadow-glow-primary">
            <span>+</span> New Channel
          </button>
        </div>
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

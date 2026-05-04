import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiService } from '../../../core/services/ai.service';

type AiTab = 'summary' | 'action-plan' | 'report';

@Component({
  selector: 'wb-ai-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-80 flex-shrink-0 flex flex-col bg-surface-850/95 border-l border-white/5 h-full animate-slide-in-right">

      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 bg-gradient-to-br from-primary-500 to-accent-pink rounded-lg flex items-center justify-center text-sm">
            ✨
          </div>
          <h3 class="text-sm font-semibold text-white">AI Tools</h3>
          <span class="text-xs bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded-full">Gemma 4</span>
        </div>
        <button (click)="close.emit()" class="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all">✕</button>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-white/5">
        <button *ngFor="let tab of tabs" (click)="activeTab.set(tab.id)"
          class="flex-1 py-3 text-xs font-medium transition-all"
          [class]="activeTab() === tab.id ? 'text-primary-400 border-b-2 border-primary-500' : 'text-gray-500 hover:text-gray-300'">
          {{ tab.icon }} {{ tab.label }}
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4 scrollbar-thin">

        <!-- Summary Tab -->
        <div *ngIf="activeTab() === 'summary'">
          <p class="text-xs text-gray-400 mb-4 leading-relaxed">
            Generate a structured summary of the recent conversation including key points, decisions, and next steps.
          </p>
          <button (click)="generate('summary')" [disabled]="loading()"
            class="w-full py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500
                   text-white text-sm font-medium rounded-xl transition-all transform hover:-translate-y-0.5 shadow-glow-primary
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2">
            <span *ngIf="loading() && activeTab() === 'summary'" class="flex items-center gap-2">
              <svg class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg> Generating...
            </span>
            <span *ngIf="!loading() || activeTab() !== 'summary'">📋 Generate Summary</span>
          </button>
        </div>

        <!-- Action Plan Tab -->
        <div *ngIf="activeTab() === 'action-plan'">
          <p class="text-xs text-gray-400 mb-4 leading-relaxed">
            Extract concrete action items, tasks and assignees from the conversation.
          </p>
          <button (click)="generate('action-plan')" [disabled]="loading()"
            class="w-full py-2.5 bg-gradient-to-r from-accent-teal/70 to-primary-600 hover:opacity-90
                   text-white text-sm font-medium rounded-xl transition-all transform hover:-translate-y-0.5
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2">
            <span *ngIf="loading() && activeTab() === 'action-plan'" class="flex items-center gap-2">
              <svg class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg> Extracting...
            </span>
            <span *ngIf="!loading() || activeTab() !== 'action-plan'">✅ Extract Action Items</span>
          </button>
        </div>

        <!-- Report Tab -->
        <div *ngIf="activeTab() === 'report'">
          <p class="text-xs text-gray-400 mb-4 leading-relaxed">
            Generate a complete meeting report with participants, decisions, and action items table.
          </p>
          <button (click)="generate('report')" [disabled]="loading()"
            class="w-full py-2.5 bg-gradient-to-r from-accent-pink/70 to-primary-600 hover:opacity-90
                   text-white text-sm font-medium rounded-xl transition-all transform hover:-translate-y-0.5
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2">
            <span *ngIf="loading() && activeTab() === 'report'" class="flex items-center gap-2">
              <svg class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg> Writing...
            </span>
            <span *ngIf="!loading() || activeTab() !== 'report'">📄 Generate Report</span>
          </button>
        </div>

        <!-- Result -->
        <div *ngIf="result()" class="mt-5 animate-fade-in">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-semibold text-gray-400">Result</p>
            <button (click)="copyResult()" class="text-xs text-primary-400 hover:text-primary-300 transition-colors">
              {{ copied() ? '✓ Copied!' : 'Copy' }}
            </button>
          </div>
          <div class="bg-surface-800 border border-white/5 rounded-xl p-4 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto scrollbar-thin">
            {{ result() }}
          </div>
          <p class="mt-2 text-xs text-gray-600 text-right">Generated at {{ generatedAt() | date:'HH:mm' }}</p>
        </div>

        <!-- Error -->
        <div *ngIf="error()" class="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
          {{ error() }}
        </div>
      </div>

      <!-- Info footer -->
      <div class="border-t border-white/5 px-4 py-3">
        <p class="text-xs text-gray-600 text-center">
          Powered by <span class="text-primary-500">Gemma 4</span> · Results in your language
        </p>
      </div>
    </div>
  `,
})
export class AiPanelComponent {
  @Input() channelId!: string;
  @Output() close = new EventEmitter<void>();

  private aiSvc = inject(AiService);

  activeTab = signal<AiTab>('summary');
  loading = signal(false);
  result = signal('');
  error = signal('');
  generatedAt = signal<Date | null>(null);
  copied = signal(false);

  tabs = [
    { id: 'summary' as AiTab, label: 'Summary', icon: '📋' },
    { id: 'action-plan' as AiTab, label: 'Actions', icon: '✅' },
    { id: 'report' as AiTab, label: 'Report', icon: '📄' },
  ];

  generate(type: AiTab) {
    this.loading.set(true);
    this.result.set('');
    this.error.set('');

    const obs = type === 'summary'
      ? this.aiSvc.generateSummary(this.channelId)
      : type === 'action-plan'
        ? this.aiSvc.generateActionPlan(this.channelId)
        : this.aiSvc.generateReport(this.channelId);

    obs.subscribe({
      next: (res: Record<string, unknown>) => {
        this.result.set((res['summary'] || res['action_plan'] || res['report']) as string);
        this.generatedAt.set(new Date());
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e.error?.detail || 'Generation failed. Is Gemma 4 running?');
        this.loading.set(false);
      },
    });
  }

  copyResult() {
    navigator.clipboard.writeText(this.result()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}

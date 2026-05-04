import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'wb-notifications-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-16 left-2 w-80 bg-surface-850/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-glass z-50 animate-scale-in overflow-hidden">

      <div class="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h3 class="text-sm font-semibold text-white">Notifications</h3>
        <div class="flex items-center gap-2">
          <button (click)="markAllRead()" class="text-xs text-primary-400 hover:text-primary-300 transition-colors">Mark all read</button>
          <button (click)="close.emit()" class="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all text-sm">✕</button>
        </div>
      </div>

      <div class="max-h-80 overflow-y-auto scrollbar-thin">
        <div *ngFor="let n of notifications()"
          class="flex items-start gap-3 px-4 py-3 hover:bg-white/3 transition-all border-b border-white/3 last:border-0"
          [class.opacity-50]="n.isRead">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm"
               [class]="iconBg(n.type)">
            {{ icon(n.type) }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-gray-300 leading-relaxed">{{ n.content || typeLabel(n.type) }}</p>
            <p class="text-xs text-gray-600 mt-0.5">{{ n.createdAt | date:'MMM d, HH:mm' }}</p>
          </div>
          <div *ngIf="!n.isRead" class="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-1"></div>
        </div>

        <div *ngIf="notifications().length === 0" class="text-center py-8">
          <p class="text-3xl mb-2">🔔</p>
          <p class="text-sm text-gray-500">No notifications yet</p>
        </div>
      </div>
    </div>
  `,
})
export class NotificationsPanelComponent {
  @Output() close = new EventEmitter<void>();
  private userSvc = inject(UserService);
  notifications = this.userSvc.notifications;

  icon(type: string) {
    const map: Record<string, string> = {
      mention: '@', reply: '↩', agentic_reply: '🤖', summary_ready: '📋', new_member: '👋',
    };
    return map[type] || '🔔';
  }

  iconBg(type: string) {
    const map: Record<string, string> = {
      mention: 'bg-primary-500/20 text-primary-400',
      reply: 'bg-white/5 text-gray-400',
      agentic_reply: 'bg-accent-violet/20 text-accent-violet',
      summary_ready: 'bg-accent-teal/20 text-accent-teal',
      new_member: 'bg-accent-green/20 text-accent-green',
    };
    return map[type] || 'bg-white/5 text-gray-400';
  }

  typeLabel(type: string) {
    const map: Record<string, string> = {
      mention: 'You were mentioned', reply: 'New reply', agentic_reply: 'Your AI agent replied',
      summary_ready: 'Summary generated', new_member: 'New member joined',
    };
    return map[type] || 'New notification';
  }

  markAllRead() {
    this.userSvc.markAllRead().subscribe();
  }
}

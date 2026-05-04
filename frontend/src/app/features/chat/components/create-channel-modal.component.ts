import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChannelService } from '../../../core/services/channel.service';
import { UserService } from '../../../core/services/user.service';
import { Channel } from '../../../core/models';

@Component({
  selector: 'wb-create-channel-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div class="bg-surface-850 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-glass animate-scale-in">

        <div class="flex items-center justify-between mb-5">
          <h2 class="text-lg font-semibold text-white">
            {{ type === 'team' ? '🏢 New Team Channel' : '💬 New Direct Message' }}
          </h2>
          <button (click)="close.emit()" class="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all">✕</button>
        </div>

        <div class="space-y-4">
          <!-- Name -->
          <div>
            <label class="block text-sm font-medium text-gray-400 mb-2">
              {{ type === 'team' ? 'Channel name' : 'Conversation name' }}
            </label>
            <input [(ngModel)]="name" [placeholder]="type === 'team' ? 'e.g. frontend-dev' : 'e.g. John & Maria'"
              class="wb-input" />
          </div>

          <!-- Description (teams only) -->
          <div *ngIf="type === 'team'">
            <label class="block text-sm font-medium text-gray-400 mb-2">Description <span class="text-gray-600">(optional)</span></label>
            <input [(ngModel)]="description" placeholder="What is this channel for?"
              class="wb-input" />
          </div>

          <!-- Member search -->
          <div>
            <label class="block text-sm font-medium text-gray-400 mb-2">Add members</label>
            <input [(ngModel)]="memberSearch" (ngModelChange)="onSearch($event)"
              placeholder="Search by username..."
              class="wb-input" />

            <!-- Search results -->
            <div *ngIf="searchResults().length > 0" class="mt-2 bg-surface-800 border border-white/5 rounded-xl overflow-hidden">
              <button *ngFor="let user of searchResults()"
                (click)="addMember(user)"
                class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-all text-left">
                <div class="w-7 h-7 rounded-full bg-gradient-to-br from-primary-600/40 to-accent-pink/30 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {{ user.username[0].toUpperCase() }}
                </div>
                <div>
                  <p class="text-sm text-white">{{ user.username }}</p>
                  <p class="text-xs text-gray-500">{{ user.preferredLanguage }}</p>
                </div>
                <span class="ml-auto text-xs text-primary-400">+ Add</span>
              </button>
            </div>

            <!-- Selected members -->
            <div *ngIf="selectedMembers().length > 0" class="flex flex-wrap gap-2 mt-3">
              <div *ngFor="let m of selectedMembers()"
                class="flex items-center gap-1.5 bg-primary-500/15 border border-primary-500/20 text-primary-300 text-xs px-3 py-1.5 rounded-full">
                <span>{{ m.username }}</span>
                <button (click)="removeMember(m.id)" class="hover:text-white transition-colors">✕</button>
              </div>
            </div>
          </div>

          <!-- Error -->
          <div *ngIf="error()" class="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">{{ error() }}</div>
        </div>

        <div class="flex gap-3 mt-6">
          <button (click)="close.emit()" class="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-sm font-medium rounded-xl transition-all">
            Cancel
          </button>
          <button (click)="onCreate()" [disabled]="!name.trim() || loading()"
            class="flex-1 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500
                   text-white text-sm font-medium rounded-xl transition-all transform hover:-translate-y-0.5
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
            {{ loading() ? 'Creating...' : 'Create' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class CreateChannelModalComponent {
  @Input() type: 'team' | 'pair' = 'team';
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<Channel>();

  private channelSvc = inject(ChannelService);
  private userSvc = inject(UserService);

  name = '';
  description = '';
  memberSearch = '';
  loading = signal(false);
  error = signal('');
  searchResults = signal<{ id: string; username: string; preferredLanguage: string }[]>([]);
  selectedMembers = signal<{ id: string; username: string }[]>([]);

  onSearch(q: string) {
    if (q.length < 2) { this.searchResults.set([]); return; }
    this.userSvc.searchUsers(q).subscribe((users: unknown) => {
      const arr = users as { id: string; username: string; preferred_language: string }[];
      const selected = this.selectedMembers().map(m => m.id);
      this.searchResults.set(
        arr.filter(u => !selected.includes(u.id))
           .map(u => ({ id: u.id, username: u.username, preferredLanguage: u.preferred_language }))
      );
    });
  }

  addMember(user: { id: string; username: string }) {
    this.selectedMembers.update(list => [...list, user]);
    this.searchResults.set([]);
    this.memberSearch = '';
  }

  removeMember(id: string) {
    this.selectedMembers.update(list => list.filter(m => m.id !== id));
  }

  onCreate() {
    if (!this.name.trim()) return;
    this.loading.set(true);
    this.channelSvc.createChannel({
      name: this.name.trim(),
      description: this.description || undefined,
      type: this.type,
      memberIds: this.selectedMembers().map(m => m.id),
    }).subscribe({
      next: (ch: unknown) => { this.loading.set(false); this.created.emit(ch as Channel); },
      error: (e) => { this.loading.set(false); this.error.set(e.error?.detail || 'Failed to create channel'); },
    });
  }
}

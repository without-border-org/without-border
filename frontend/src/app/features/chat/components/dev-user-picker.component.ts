import {
  Component, inject, signal, computed, OnInit, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DevUserService, DevUser } from '../../../core/services/dev-user.service';
import { AuthService } from '../../../core/services/auth.service';
import { ChatWebSocketService } from '../../../core/services/chat-ws.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { User } from '../../../core/models';

/**
 * Floating picker that lets you impersonate any seeded user in AUTH_DISABLED mode.
 * Only rendered when environment.authDisabled === true.
 */
@Component({
  selector: 'wb-dev-user-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-4 right-4 z-50">
      <!-- Toggle button -->
      <button
        (click)="toggle()"
        class="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold shadow-lg
               bg-amber-500 hover:bg-amber-400 text-white transition-all">
        <svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
          <path d="M10 2a1.5 1.5 0 011.5 1.5c0 .45-.2.86-.5 1.14V6h1A5 5 0 0117 11h.5a.5.5
                   0 010 1H17v.5A4 4 0 0113 16.5v.5a.5.5 0 01-1 0v-.5H8v.5a.5.5 0 01-1
                   0v-.5A4 4 0 013 12.5V12h-.5a.5.5 0 010-1H3A5 5 0 018 6h1V4.64c-.3-.28-.5-.69-.5-1.14A1.5
                   1.5 0 0110 2zM7.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm5 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
        </svg>
        DEV: {{ currentLabel() }}
      </button>

      <!-- User list panel -->
      <div *ngIf="open()"
           class="absolute bottom-10 right-0 w-56 rounded-xl shadow-2xl overflow-hidden
                  dark:bg-brand-darkPanel bg-white border dark:border-brand-darkBorder border-zinc-200">
        <div class="px-3 py-2 border-b dark:border-brand-darkBorder border-zinc-200">
          <p class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Changer d'utilisateur</p>
        </div>
        <ul>
          <li *ngFor="let u of users()"
              (click)="switchUser(u)"
              class="flex items-center gap-3 px-3 py-2 cursor-pointer transition-ui text-xs
                     hover:dark:bg-white/5 hover:bg-zinc-100"
              [class.font-bold]="u.id === selectedId()">
            <span class="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                  [style.background]="langColor(u.preferred_language)">
              {{ u.preferred_language.toUpperCase() }}
            </span>
            <span class="truncate dark:text-zinc-200 text-zinc-800">{{ u.username }}</span>
            <svg *ngIf="u.id === selectedId()" viewBox="0 0 20 20" fill="currentColor" class="w-3 h-3 ml-auto text-amber-400 flex-shrink-0">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </li>
        </ul>
      </div>
    </div>
  `,
})
export class DevUserPickerComponent implements OnInit {
  private devUserSvc = inject(DevUserService);
  private authSvc    = inject(AuthService);
  private wsSvc      = inject(ChatWebSocketService);
  private http       = inject(HttpClient);

  open = signal(false);
  users = this.devUserSvc.users;
  selectedId = this.devUserSvc.selectedId;

  currentLabel = computed(() => {
    const u = this.devUserSvc.selectedUser;
    return u ? u.username : '…';
  });

  async ngOnInit(): Promise<void> {
    await this.devUserSvc.loadUsers();
  }

  toggle(): void {
    this.open.update(v => !v);
  }

  @HostListener('document:click', ['$event.target'])
  onDocClick(target: EventTarget | null): void {
    if (!target) return;
    if (!(target as HTMLElement).closest?.('wb-dev-user-picker')) {
      this.open.set(false);
    }
  }

  async switchUser(user: DevUser): Promise<void> {
    this.devUserSvc.select(user.id);
    this.open.set(false);
    // Reload the /me endpoint — interceptor will now send X-Dev-User-Id
    try {
      const me = await firstValueFrom(
        this.http.get<User>(`${environment.apiUrl}/api/v1/users/me`)
      );
      this.authSvc.setUser(me);
    } catch { /* keep previous user */ }
    // Reconnect WebSocket with new user
    this.wsSvc.disconnect();
  }

  langColor(lang: string): string {
    const MAP: Record<string, string> = {
      fr: '#6366f1', en: '#10b981', es: '#f59e0b',
      ko: '#ec4899', de: '#3b82f6', pt: '#14b8a6',
    };
    return MAP[lang] ?? '#64748b';
  }
}

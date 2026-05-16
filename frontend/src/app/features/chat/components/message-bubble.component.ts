import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Message, LANGUAGE_MAP, getUserColor, getInitials } from '../../../core/models';

@Component({
  selector: 'wb-message-bubble',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex gap-4 group">

      <!-- Avatar -->
      <div class="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold
                  flex-shrink-0 shadow-sm"
           [ngClass]="avatarClass()">
        {{ initials() }}
      </div>

      <!-- Contenu -->
      <div class="flex-1 min-w-0">

        <!-- Ligne métadonnées : nom · heure · langue · traduit · agentic -->
        <div class="flex items-center gap-2 mb-1.5 flex-wrap">
          <span class="text-xs font-bold dark:text-zinc-100 text-zinc-900">
            {{ message.senderUsername }}
          </span>
          <span class="text-[10px] text-zinc-400 font-medium">
            {{ message.createdAt | date:'HH:mm' }}
          </span>
          <span class="text-[9px] px-1.5 py-0.5 rounded font-bold text-zinc-500 dark:text-zinc-400
                       dark:bg-white/10 bg-zinc-100 border dark:border-white/5 border-zinc-200">
            {{ langBadge() }}
          </span>
          <span *ngIf="isTranslated()"
                class="text-[9px] flex items-center text-brand-orange font-bold px-1.5 py-0.5
                       rounded-full bg-brand-orange/10">
            文 traduit
          </span>
          <span *ngIf="message.isAgentic"
                class="text-[8px] px-1.5 py-0.5 bg-brand-orange/20 text-brand-orange
                       rounded-full font-bold uppercase tracking-tighter">
            Agentic
          </span>
          <span *ngIf="message.isPinned" class="text-[9px] text-amber-400">📌</span>
        </div>

        <!-- Bulle de message -->
        <div class="relative" (mouseenter)="hover.set(true)" (mouseleave)="hover.set(false)">
          <div class="p-3.5 rounded-2xl rounded-tl-sm text-sm block shadow-sm leading-relaxed break-words"
               [ngClass]="bubbleClass()">

            <!-- Fichier joint -->
            <div *ngIf="message.fileUrl" class="mb-2">
              <img *ngIf="isImage()" [src]="message.fileUrl" class="max-w-xs rounded-lg" />
              <a *ngIf="!isImage()" [href]="message.fileUrl" target="_blank"
                 class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                <span>📎</span>
                <span class="text-xs underline">{{ message.fileName }}</span>
              </a>
            </div>

            <!-- Contenu texte -->
            <p *ngIf="!showOriginal()">{{ displayContent() }}</p>
            <p *ngIf="showOriginal()" class="italic opacity-75">{{ message.originalContent }}</p>

            <!-- Toggle original / traduction -->
            <button *ngIf="message.translatedContent && message.translatedContent !== message.originalContent"
                    (click)="showOriginal.update(v => !v)"
                    class="mt-1.5 text-[10px] opacity-60 hover:opacity-100 transition-opacity block">
              {{ showOriginal() ? '🌍 Voir la traduction' : '📝 Voir l\'original (' + langBadge() + ')' }}
            </button>
          </div>

          <!-- Toolbar de réactions (hover) -->
          <div *ngIf="hover()"
               class="absolute -top-9 left-0 flex items-center gap-1
                      dark:bg-brand-darkPanel bg-white border dark:border-brand-darkBorder border-zinc-200
                      rounded-xl px-2 py-1 shadow-glass z-10 animate-scale-in">
            <button *ngFor="let emoji of quickEmojis"
                    (click)="react.emit(emoji)"
                    class="hover:scale-125 transition-transform text-base leading-none p-0.5">
              {{ emoji }}
            </button>
          </div>
        </div>

        <!-- Réactions -->
        <div *ngIf="message.reactions && message.reactions.length" class="flex gap-1.5 mt-2 flex-wrap">
          <button *ngFor="let r of message.reactions"
                  (click)="react.emit(r.emoji)"
                  class="reaction-pill"
                  [class.ring-1]="r.reactedByMe"
                  [class.ring-brand-orange]="r.reactedByMe">
            <span>{{ r.emoji }}</span>
            <span>{{ r.count }}</span>
          </button>
        </div>

      </div>
    </div>
  `,
})
export class MessageBubbleComponent {
  @Input() message!: Message;
  @Input() currentUserLang = 'fr';
  @Output() react = new EventEmitter<string>();

  hover       = signal(false);
  showOriginal = signal(false);

  quickEmojis = ['👍', '❤️', '😂', '🔥', '👏', '🚀'];

  initials() { return getInitials(this.message.senderUsername); }

  avatarClass(): string {
    const c = getUserColor(this.message.senderId);
    return `bg-${c}-500/10 text-${c}-500 border border-${c}-500/10`;
  }

  bubbleClass(): string {
    if (this.message.isAgentic) {
      return 'bg-brand-orange text-white shadow-lg shadow-orange-500/20';
    }
    return 'dark:bg-brand-darkPanel bg-white border dark:border-brand-darkBorder border-zinc-200 dark:text-zinc-200 text-zinc-800';
  }

  langBadge(): string {
    const lang = this.message.originalLanguage;
    if (!lang) return '??';
    return LANGUAGE_MAP[lang]?.badge ?? lang.toUpperCase();
  }

  isTranslated(): boolean {
    const originalLang = this.message.originalLanguage;
    return !!originalLang && originalLang !== this.currentUserLang;
  }

  displayContent(): string {
    return this.message.translatedContent || this.message.originalContent;
  }

  isImage(): boolean {
    return !!this.message.fileType?.startsWith('image/');
  }
}

import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Message } from '../../../core/models';

const EMOJI_QUICK = ['👍', '❤️', '😂', '🔥', '👏', '🚀'];

@Component({
  selector: 'wb-message-bubble',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="group flex items-start gap-3 py-1 px-2 rounded-xl hover:bg-white/3 transition-all"
         [class]="isOwn ? 'flex-row-reverse' : 'flex-row'">

      <!-- Avatar -->
      <div class="flex-shrink-0 mt-0.5" *ngIf="!isOwn">
        <div class="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs
                    bg-gradient-to-br"
             [class]="message.isAgentic ? 'from-accent-violet/40 to-primary-600/40' : 'from-primary-600/40 to-accent-pink/30'">
          <img *ngIf="message.senderAvatar" [src]="message.senderAvatar" class="w-full h-full object-cover" />
          <span *ngIf="!message.senderAvatar" class="text-white">
            {{ message.isAgentic ? '🤖' : message.senderUsername[0].toUpperCase() }}
          </span>
        </div>
      </div>

      <!-- Bubble content -->
      <div class="max-w-[70%] min-w-0" [class]="isOwn ? 'items-end flex flex-col' : 'items-start flex flex-col'">

        <!-- Header -->
        <div class="flex items-center gap-2 mb-1 px-1" [class]="isOwn ? 'flex-row-reverse' : 'flex-row'">
          <span class="text-xs font-semibold"
                [class]="message.isAgentic ? 'text-accent-violet' : isOwn ? 'text-primary-400' : 'text-gray-300'">
            {{ message.senderUsername }}
          </span>
          <span *ngIf="message.isAgentic"
            class="text-xs bg-accent-violet/15 text-accent-violet border border-accent-violet/20 px-1.5 py-0.5 rounded-full font-medium">
            🤖 AI Agent
          </span>
          <span *ngIf="message.isPinned" class="text-xs text-amber-500">📌</span>
          <span class="text-xs text-gray-600">{{ message.createdAt | date:'HH:mm' }}</span>
        </div>

        <!-- Reply preview -->
        <div *ngIf="message.parentId"
             class="px-3 py-1.5 mb-1 bg-white/5 border-l-2 border-primary-500/50 rounded-r-lg text-xs text-gray-400 max-w-full truncate">
          ↩ Replying to a message
        </div>

        <!-- Message bubble -->
        <div class="relative" (mouseenter)="hover.set(true)" (mouseleave)="hover.set(false)">
          <div class="px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words"
               [class]="bubbleClass()">

            <!-- File attachment -->
            <div *ngIf="message.fileUrl" class="mb-2">
              <img *ngIf="isImage()" [src]="message.fileUrl" class="max-w-xs rounded-lg" />
              <a *ngIf="!isImage()" [href]="message.fileUrl" target="_blank"
                 class="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg hover:bg-white/15 transition-colors">
                <span>📎</span>
                <span class="text-xs underline">{{ message.fileName }}</span>
              </a>
            </div>

            <!-- Text content -->
            <p *ngIf="!showOriginal()" class="text-white">
              {{ message.translatedContent || message.originalContent }}
            </p>
            <p *ngIf="showOriginal()" class="text-gray-300 italic">
              {{ message.originalContent }}
            </p>

            <!-- Translation toggle -->
            <button *ngIf="message.translatedContent && message.translatedContent !== message.originalContent"
              (click)="showOriginal.update(v => !v)"
              class="mt-1 text-xs text-gray-500 hover:text-primary-400 transition-colors block">
              {{ showOriginal() ? '🌍 Show translation' : '📝 See original (' + message.originalLanguage + ')' }}
            </button>
          </div>

          <!-- Quick reactions hover toolbar -->
          <div *ngIf="hover()"
               class="absolute -top-9 flex items-center gap-1 bg-surface-800 border border-white/10 rounded-xl px-2 py-1 shadow-glass z-10 animate-scale-in"
               [class]="isOwn ? 'right-0' : 'left-0'">
            <button *ngFor="let emoji of quickEmojis"
              (click)="react.emit(emoji)"
              class="hover:scale-125 transition-transform text-base leading-none p-0.5">{{ emoji }}</button>
            <div class="w-px h-4 bg-white/10 mx-0.5"></div>
            <button (click)="reply.emit()" class="text-gray-400 hover:text-white p-0.5 text-xs transition-colors" title="Reply">↩</button>
            <button *ngIf="isOwn" (click)="pin.emit()" class="text-gray-400 hover:text-amber-400 p-0.5 text-xs transition-colors" title="Pin">📌</button>
            <button *ngIf="isOwn" (click)="delete.emit()" class="text-gray-400 hover:text-red-400 p-0.5 text-xs transition-colors" title="Delete">🗑</button>
          </div>
        </div>

        <!-- Reactions display -->
        <div *ngIf="message.reactions.length" class="flex flex-wrap gap-1 mt-1.5 px-1"
             [class]="isOwn ? 'justify-end' : 'justify-start'">
          <button *ngFor="let r of message.reactions"
            (click)="react.emit(r.emoji)"
            class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all border"
            [class]="r.reactedByMe
              ? 'bg-primary-500/20 border-primary-500/40 text-primary-300'
              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'">
            {{ r.emoji }} {{ r.count }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class MessageBubbleComponent {
  @Input() message!: Message;
  @Input() isOwn = false;
  @Output() react = new EventEmitter<string>();
  @Output() pin = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() reply = new EventEmitter<void>();

  hover = signal(false);
  showOriginal = signal(false);
  quickEmojis = EMOJI_QUICK;

  isImage() {
    return this.message.fileType?.startsWith('image/');
  }

  bubbleClass() {
    if (this.message.isAgentic) {
      return 'bg-accent-violet/15 border border-accent-violet/20';
    }
    if (this.isOwn) {
      return 'bg-primary-500/20 border border-primary-500/20';
    }
    return 'bg-surface-800 border border-white/5';
  }
}

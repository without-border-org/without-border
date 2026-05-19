import {
  Component, inject, signal, computed, effect, OnInit, OnDestroy, OnChanges, SimpleChanges,
  ViewChild, ElementRef, AfterViewChecked, Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChannelService, MessageService } from '../../../core/services/channel.service';
import { ChatWebSocketService } from '../../../core/services/chat-ws.service';
import { AuthService } from '../../../core/services/auth.service';
import { Message, Channel, ChannelMember, LANGUAGE_MAP, getUserColor, getInitials } from '../../../core/models';
import { MessageBubbleComponent } from '../components/message-bubble.component';
import { AgentService } from '../../../core/services/agent.service';

@Component({
  selector: 'wb-conversation',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageBubbleComponent],
  template: `
    <div class="flex flex-1 min-h-0 overflow-hidden relative">

      <!-- ═══════════════ ZONE CHAT ═══════════════ -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">

        <!-- ── Header (glassmorphism) ── -->
        <header class="h-16 glass-header absolute top-0 left-0 right-0 z-20
                       flex items-center justify-between px-6">
          <!-- Icône + titre + sous-titre -->
          <div class="flex items-center gap-3">
            <div class="p-2 bg-brand-orange/10 rounded-lg text-brand-orange">
              <!-- Icône groupe (team) ou initiales (DM) -->
              <ng-container *ngIf="channel()?.type === 'team'; else dmIcon">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857
                       M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857
                       m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </ng-container>
              <ng-template #dmIcon>
                <span class="w-5 h-5 flex items-center justify-center font-bold text-[10px]">
                  {{ getInitials(channel()?.name ?? '') }}
                </span>
              </ng-template>
            </div>
            <div>
              <h2 class="text-sm font-bold truncate dark:text-white text-zinc-900">
                {{ channel()?.name ?? '...' }}
              </h2>
              <p class="text-[10px] text-zinc-500 font-medium tracking-wide">
                {{ channel()?.description ?? (loading() ? 'Chargement...' : '') }}
                <span *ngIf="typingText()" class="text-brand-orange italic ml-1">{{ typingText() }}</span>
              </p>
            </div>
          </div>

          <!-- Tab bar agent : Conversation | Configuration -->
          <div *ngIf="isAgentChannel()" class="flex items-center gap-1 p-1 rounded-[10px]
                      dark:bg-white/4 bg-slate-100/80">
            <button (click)="agentTab.set('chat')"
              class="tab-btn px-3.5 py-1.5 rounded-[7px] text-[12px] font-semibold flex items-center gap-1.5 border-0 cursor-pointer transition-all"
              [class]="agentTab() === 'chat'
                ? 'bg-brand-orange text-white shadow-[0_1px_4px_rgba(249,115,22,0.3)]'
                : 'dark:text-zinc-400 text-slate-500 bg-transparent hover:opacity-80'">
              <!-- Feather message-circle icon, stroke 1.75 -->
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Conversation
            </button>
            <button (click)="agentTab.set('config')"
              class="tab-btn px-3.5 py-1.5 rounded-[7px] text-[12px] font-semibold flex items-center gap-1.5 border-0 cursor-pointer transition-all"
              [class]="agentTab() === 'config'
                ? 'bg-brand-orange text-white shadow-[0_1px_4px_rgba(249,115,22,0.3)]'
                : 'dark:text-zinc-400 text-slate-500 bg-transparent hover:opacity-80'">
              <!-- Feather settings icon, stroke 1.75 -->
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Configuration
            </button>
          </div>

          <!-- Groupe d'avatars participants → toggle sidebar droite -->
          <button (click)="toggleParticipants()"
                  class="flex -space-x-2.5 hover:opacity-80 transition-ui p-1.5 rounded-xl
                         hover:bg-zinc-100 dark:hover:bg-white/5">
            <ng-container *ngFor="let m of participantsPreview(); let idx = index">
              <div class="w-8 h-8 rounded-full border-2 dark:border-brand-darkBg border-white
                          flex items-center justify-center text-[10px] text-white font-bold shadow-sm"
                   [ngClass]="memberAvatarBg(m)"
                   [style.z-index]="30 - idx">
                {{ getInitials(m.username) }}
              </div>
            </ng-container>
            <div *ngIf="participantsOverflow() > 0"
                 class="w-8 h-8 rounded-full bg-zinc-400 border-2 dark:border-brand-darkBg border-white
                        flex items-center justify-center text-[10px] text-white font-bold shadow-sm z-0">
              +{{ participantsOverflow() }}
            </div>
          </button>
        </header>

        <!-- ── Messages (visible en mode chat uniquement) ── -->
        <ng-container *ngIf="!isAgentChannel() || agentTab() === 'chat'">
          <div #messagesEl
               class="flex-1 overflow-y-auto custom-scrollbar px-6 pt-24 pb-4"
               (scroll)="onScroll($event)">

            <!-- Load more -->
            <div *ngIf="hasMore()" class="text-center py-2">
              <button (click)="loadMore()"
                class="text-xs text-brand-orange hover:text-brand-orangeHover
                       bg-brand-orange/10 hover:bg-brand-orange/20 px-4 py-2 rounded-full transition-ui">
                Charger les messages précédents
              </button>
            </div>

            <!-- Skeleton loading -->
            <div *ngIf="loading()">
              <div *ngFor="let i of [1,2,3,4]" class="flex gap-4 animate-pulse">
                <div class="w-9 h-9 rounded-xl dark:bg-zinc-800 bg-zinc-200 flex-shrink-0"></div>
                <div class="flex-1">
                  <div class="h-3 w-24 dark:bg-zinc-800 bg-zinc-200 rounded mb-2"></div>
                  <div class="h-12 dark:bg-zinc-800 bg-zinc-200 rounded-2xl w-3/4"></div>
                </div>
              </div>
            </div>

            <!-- Empty state -->
            <div *ngIf="!loading() && messages().length === 0"
                 class="flex flex-col items-center justify-center h-full text-center py-20">
              <div class="text-5xl mb-4">💬</div>
              <h3 class="text-base font-semibold dark:text-white text-zinc-900 mb-2">
                Démarrez la conversation
              </h3>
              <p class="text-zinc-500 text-sm max-w-xs">
                Les messages seront automatiquement traduits pour chaque membre dans sa langue.
              </p>
            </div>

            <!-- Messages list -->
            <wb-message-bubble
              *ngFor="let msg of messages(); trackBy: trackById"
              [message]="msg"
              [currentUserLang]="currentUserLang()"
              [isOwn]="msg.senderId === currentUserId()"
              [id]="'msg-' + msg.id"
              (react)="onReact(msg.id, $event)" />
          </div>

          <!-- ── Compositeur (Rich Text) ── -->
          <div class="px-4 pb-4 pt-2 border-t dark:border-brand-darkBorder border-brand-lightBorder
                      dark:bg-brand-darkBg bg-brand-lightBg">
            <div class="dark:bg-brand-darkPanel bg-zinc-100 border dark:border-brand-darkBorder
                        border-zinc-200 rounded-2xl transition-ui focus-within:border-brand-orange/30 overflow-hidden">

              <!-- Toolbar formatage (haut) -->
              <div class="flex items-center gap-0.5 px-3 pt-2.5 pb-2
                          border-b dark:border-white/[0.05] border-zinc-200/80">
                <button class="editor-tool font-bold text-xs dark:text-zinc-300 text-zinc-700"
                        (click)="applyFormat('bold')" title="Gras">B</button>
                <button class="editor-tool text-xs dark:text-zinc-300 text-zinc-700 italic"
                        (click)="applyFormat('italic')" title="Italique">I</button>
                <button class="editor-tool text-xs dark:text-zinc-300 text-zinc-700 underline"
                        (click)="applyFormat('underline')" title="Souligné">U</button>
                <button class="editor-tool text-xs dark:text-zinc-300 text-zinc-700 line-through"
                        (click)="applyFormat('strikethrough')" title="Barré">S</button>
                <div class="w-px h-3.5 dark:bg-white/10 bg-zinc-300 mx-1.5 flex-shrink-0"></div>
                <button class="editor-tool dark:text-zinc-300 text-zinc-700" title="Lien">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101
                         m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                  </svg>
                </button>
                <div class="w-px h-3.5 dark:bg-white/10 bg-zinc-300 mx-1.5 flex-shrink-0"></div>
                <button class="editor-tool dark:text-zinc-300 text-zinc-700" title="Liste ordonnée">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                  </svg>
                </button>
                <button class="editor-tool dark:text-zinc-300 text-zinc-700" title="Liste à puces">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                  </svg>
                </button>
                <div class="w-px h-3.5 dark:bg-white/10 bg-zinc-300 mx-1.5 flex-shrink-0"></div>
                <button class="editor-tool dark:text-zinc-300 text-zinc-700" title="Code">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                  </svg>
                </button>
                <button class="editor-tool dark:text-zinc-300 text-zinc-700" title="Citation">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                  </svg>
                </button>
              </div>

              <!-- Zone de saisie -->
              <textarea #textareaEl [(ngModel)]="messageText"
                (input)="onInput()"
                (keydown)="onKeydown($event)"
                rows="3"
                class="w-full bg-transparent text-sm focus:outline-none resize-none px-4 py-3
                       dark:placeholder-zinc-600 placeholder-zinc-400 dark:text-zinc-200 text-zinc-800"
                placeholder="Envoyer un message..."></textarea>

              <!-- Toolbar actions (bas) -->
              <div class="flex items-center gap-0.5 px-3 pb-2.5 pt-1">
                <button class="editor-tool dark:text-zinc-400 text-zinc-500" title="Joindre un fichier">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                  </svg>
                </button>
                <button class="editor-tool text-[10px] font-semibold dark:text-zinc-400 text-zinc-500"
                        title="Format">Aa</button>
                <button class="editor-tool dark:text-zinc-400 text-zinc-500" title="Emoji">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </button>
                <button class="editor-tool text-[11px] font-bold dark:text-zinc-400 text-zinc-500"
                        title="Mentionner">@</button>
                <div class="w-px h-3.5 dark:bg-white/10 bg-zinc-300 mx-1.5 flex-shrink-0"></div>
                <button class="editor-tool dark:text-zinc-400 text-zinc-500" title="Clip vidéo">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14
                         M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                </button>
                <button class="editor-tool dark:text-zinc-400 text-zinc-500" title="Message vocal">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                  </svg>
                </button>
                <button class="editor-tool text-[11px] font-bold dark:text-zinc-400 text-zinc-500"
                        title="Commandes">/</button>
                <div class="flex-1"></div>
                <!-- Bouton envoi -->
                <button (click)="sendMessage()"
                        class="editor-tool rounded-lg"
                        [class]="messageText.trim() ? 'send-btn-active' : 'send-btn-inactive'"
                        title="Envoyer (Entrée)">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ── Vue configuration agent ── -->
        <div *ngIf="isAgentChannel() && agentTab() === 'config'"
             class="flex-1 overflow-y-auto custom-scrollbar pt-20 px-5 pb-5">
          <div class="grid gap-4" style="grid-template-columns:340px 1fr; max-width:1060px; margin:0 auto">

            <!-- ═══ Colonne gauche ═══ -->
            <div class="flex flex-col gap-4">

              <!-- Agent Setup -->
              <div class="dark:bg-brand-darkPanel bg-white rounded-[14px] border dark:border-brand-darkBorder border-zinc-200 overflow-hidden shadow-sm">
                <div class="px-[18px] py-[14px] border-b dark:border-brand-darkBorder border-zinc-200 flex items-center gap-2.5">
                  <div class="w-[30px] h-[30px] rounded-[7px] bg-brand-orange/10 text-brand-orange flex items-center justify-center flex-shrink-0">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  </div>
                  <div>
                    <div class="text-[13px] font-semibold dark:text-zinc-100 text-zinc-900 tracking-tight">Agent Setup</div>
                    <div class="text-[11px] dark:text-zinc-500 text-zinc-400 mt-px">Identity &amp; model configuration</div>
                  </div>
                </div>
                <div class="p-[18px]">
                  <!-- Status row -->
                  <div class="flex items-center gap-2.5 px-[13px] py-2.5 rounded-[9px] dark:bg-zinc-900 bg-zinc-50 border dark:border-brand-darkBorder border-zinc-200 mb-[14px]">
                    <div class="w-[30px] h-[30px] rounded-[7px] bg-brand-orange/10 text-brand-orange flex items-center justify-center flex-shrink-0">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                    </div>
                    <div class="flex-1">
                      <div class="text-[12.5px] font-semibold dark:text-zinc-200 text-zinc-700">Agent Status</div>
                      <div class="text-[11px] dark:text-zinc-500 text-zinc-400 mt-px">
                        {{ currentAgent()?.isActive ? 'Active — responding to messages' : 'Inactive' }}
                      </div>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <div class="w-2 h-2 rounded-full" [class]="currentAgent()?.isActive ? 'bg-green-500' : 'bg-zinc-400'"></div>
                      <span class="text-[11px] font-medium" [class]="currentAgent()?.isActive ? 'text-green-500' : 'dark:text-zinc-400 text-zinc-500'">
                        {{ currentAgent()?.isActive ? 'Active' : 'Off' }}
                      </span>
                    </div>
                  </div>
                  <!-- Fields -->
                  <div class="mb-[14px]">
                    <label class="block text-[10.5px] font-semibold uppercase tracking-wider dark:text-zinc-500 text-zinc-400 mb-[5px]">Agent Name</label>
                    <input
                      [ngModel]="editAgentName()"
                      (ngModelChange)="editAgentName.set($event)"
                      class="w-full px-[11px] py-[9px] dark:bg-zinc-950 bg-zinc-50 border dark:border-white/10 border-zinc-300 rounded-lg dark:text-zinc-200 text-zinc-800 text-[13.5px] focus:outline-none focus:border-brand-orange/50 transition-colors"
                      placeholder="Agent name"
                    />
                  </div>
                  <div class="mb-[14px]">
                    <label class="block text-[10.5px] font-semibold uppercase tracking-wider dark:text-zinc-500 text-zinc-400 mb-[5px]">Type</label>
                    <div class="w-full px-[11px] py-[9px] dark:bg-zinc-950 bg-zinc-50 border dark:border-white/10 border-zinc-300 rounded-lg dark:text-zinc-200 text-zinc-800 text-[13.5px] capitalize">
                      {{ currentAgent()?.agentType?.replace('_', ' ') ?? '—' }}
                    </div>
                  </div>
                  <div>
                    <label class="block text-[10.5px] font-semibold uppercase tracking-wider dark:text-zinc-500 text-zinc-400 mb-[5px]">AI Model</label>
                    <div class="w-full px-[11px] py-[9px] dark:bg-zinc-950 bg-zinc-50 border dark:border-white/10 border-zinc-300 rounded-lg dark:text-zinc-200 text-zinc-800 text-[13.5px]">
                      Gemma 4 · 27B — High Accuracy
                    </div>
                  </div>
                  <div class="mt-3 flex gap-1.5 items-start p-[8px_11px] rounded-lg dark:bg-zinc-900 bg-zinc-50 border dark:border-brand-darkBorder border-zinc-200">
                    <svg class="w-3.5 h-3.5 text-brand-orange flex-shrink-0 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span class="text-[12px] dark:text-zinc-400 text-zinc-500">Using <strong class="dark:text-zinc-200 text-zinc-700">Gemma 4 · 27B</strong> in multilingual mode. Auto-translates across 50+ languages.</span>
                  </div>
                </div>
              </div>

              <!-- Context Documents -->
              <div class="dark:bg-brand-darkPanel bg-white rounded-[14px] border dark:border-brand-darkBorder border-zinc-200 overflow-hidden shadow-sm">
                <div class="px-[18px] py-[14px] border-b dark:border-brand-darkBorder border-zinc-200 flex items-center gap-2.5">
                  <div class="w-[30px] h-[30px] rounded-[7px] bg-brand-orange/10 text-brand-orange flex items-center justify-center flex-shrink-0">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <div class="flex-1">
                    <div class="text-[13px] font-semibold dark:text-zinc-100 text-zinc-900 tracking-tight">Context Documents</div>
                    <div class="text-[11px] dark:text-zinc-500 text-zinc-400 mt-px">Agent knowledge base</div>
                  </div>
                  <span class="text-[11px] dark:text-zinc-400 text-zinc-500 dark:bg-zinc-800 bg-zinc-100 border dark:border-brand-darkBorder border-zinc-200 px-2 py-0.5 rounded-full">0 files</span>
                </div>
                <div class="p-[18px]">
                  <button class="flex items-center gap-1.5 w-full px-[13px] py-[9px] rounded-lg border-[1.5px] border-dashed dark:border-white/10 border-zinc-300 dark:text-zinc-400 text-zinc-500 text-[12.5px] hover:border-brand-orange hover:text-brand-orange transition-colors cursor-pointer bg-transparent">
                    <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    + Add context documents
                  </button>
                  <div class="mt-3 px-[10px] py-[8px] rounded-lg dark:bg-zinc-900 bg-zinc-50 border dark:border-brand-darkBorder border-zinc-200 border-l-[3px] border-l-brand-orange">
                    <div class="text-[10px] font-bold uppercase tracking-[0.07em] text-brand-orange mb-1.5">Last AI Response</div>
                    <div class="text-[12px] dark:text-zinc-300 text-zinc-600 leading-[1.65]">
                      {{ lastAgentResponse() }}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <!-- ═══ Colonne droite ═══ -->
            <div class="dark:bg-brand-darkPanel bg-white rounded-[14px] border dark:border-brand-darkBorder border-zinc-200 overflow-hidden shadow-sm flex flex-col">
              <div class="px-[18px] py-[14px] border-b dark:border-brand-darkBorder border-zinc-200 flex items-center gap-2.5 flex-shrink-0">
                <div class="w-[30px] h-[30px] rounded-[7px] bg-brand-orange/10 text-brand-orange flex items-center justify-center flex-shrink-0">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </div>
                <div class="flex-1">
                  <div class="text-[13px] font-semibold dark:text-zinc-100 text-zinc-900 tracking-tight">Behaviour Configuration</div>
                  <div class="text-[11px] dark:text-zinc-500 text-zinc-400 mt-px">Tone, response settings &amp; system prompt</div>
                </div>
              </div>

              <div class="flex-1 overflow-y-auto custom-scrollbar p-[18px]">

                <!-- Tone -->
                <div class="flex items-center gap-2 my-4">
                  <div class="flex-1 h-px dark:bg-brand-darkBorder bg-zinc-200"></div>
                  <span class="text-[10px] font-bold uppercase tracking-[0.08em] dark:text-zinc-500 text-zinc-400">Tone</span>
                  <div class="flex-1 h-px dark:bg-brand-darkBorder bg-zinc-200"></div>
                </div>
                <div class="grid grid-cols-2 gap-2 mb-[14px]">
                  <div *ngFor="let t of ['Professional','Friendly','Formal','Casual']; let i = index"
                       class="flex items-center gap-1.5 px-[11px] py-[8px] rounded-lg border text-[13px] font-medium cursor-pointer transition-colors"
                       [class]="i === 0
                         ? 'border-brand-orange bg-brand-orange/10 dark:text-zinc-100 text-zinc-900'
                         : 'dark:border-white/10 border-zinc-200 dark:bg-zinc-900 bg-zinc-50 dark:text-zinc-400 text-zinc-500'">
                    <div class="w-[13px] h-[13px] rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0"
                         [class]="i === 0 ? 'border-brand-orange' : 'dark:border-zinc-500 border-zinc-400'">
                      <div *ngIf="i === 0" class="w-[5px] h-[5px] rounded-full bg-brand-orange"></div>
                    </div>
                    {{ t }}
                  </div>
                </div>

                <!-- Response Settings -->
                <div class="flex items-center gap-2 my-4">
                  <div class="flex-1 h-px dark:bg-brand-darkBorder bg-zinc-200"></div>
                  <span class="text-[10px] font-bold uppercase tracking-[0.08em] dark:text-zinc-500 text-zinc-400">Response Settings</span>
                  <div class="flex-1 h-px dark:bg-brand-darkBorder bg-zinc-200"></div>
                </div>
                <div class="mb-[14px]">
                  <div class="flex items-center justify-between py-2.5 border-b dark:border-brand-darkBorder border-zinc-100">
                    <div>
                      <div class="text-[13px] font-medium dark:text-zinc-200 text-zinc-700">Auto-respond to @mentions</div>
                      <div class="text-[11px] dark:text-zinc-500 text-zinc-400 mt-0.5">Agent replies when tagged in any conversation</div>
                    </div>
                    <div class="relative w-[36px] h-[20px] flex-shrink-0">
                      <div class="absolute inset-0 rounded-full bg-brand-orange"></div>
                      <div class="absolute top-[3px] left-[19px] w-[13px] h-[13px] rounded-full bg-white shadow"></div>
                    </div>
                  </div>
                  <div class="flex items-center justify-between py-2.5">
                    <div>
                      <div class="text-[13px] font-medium dark:text-zinc-200 text-zinc-700">Auto-respond to direct messages</div>
                      <div class="text-[11px] dark:text-zinc-500 text-zinc-400 mt-0.5">Handles DMs automatically without supervision</div>
                    </div>
                    <div class="relative w-[36px] h-[20px] flex-shrink-0">
                      <div class="absolute inset-0 rounded-full dark:bg-zinc-700 bg-zinc-300"></div>
                      <div class="absolute top-[3px] left-[3px] w-[13px] h-[13px] rounded-full dark:bg-zinc-400 bg-zinc-500 shadow"></div>
                    </div>
                  </div>
                </div>

                <!-- System Prompt -->
                <div class="flex items-center gap-2 my-4">
                  <div class="flex-1 h-px dark:bg-brand-darkBorder bg-zinc-200"></div>
                  <span class="text-[10px] font-bold uppercase tracking-[0.08em] dark:text-zinc-500 text-zinc-400">System Prompt</span>
                  <div class="flex-1 h-px dark:bg-brand-darkBorder bg-zinc-200"></div>
                </div>
                <div>
                  <div class="flex justify-between items-center mb-1.5">
                    <label class="text-[10.5px] font-semibold uppercase tracking-wider dark:text-zinc-500 text-zinc-400">Instructions</label>
                    <span class="text-[11px] dark:text-zinc-500 text-zinc-400">
                      <span class="font-semibold text-brand-orange">{{ editAgentPersona().length }}</span> / 500
                    </span>
                  </div>
                  <textarea
                    [ngModel]="editAgentPersona()"
                    (ngModelChange)="editAgentPersona.set($event)"
                    rows="6"
                    maxlength="500"
                    class="w-full px-[11px] py-[9px] dark:bg-zinc-950 bg-zinc-50 border dark:border-white/10 border-zinc-300 rounded-lg dark:text-zinc-300 text-zinc-600 text-[13px] leading-[1.65] resize-none focus:outline-none focus:border-brand-orange/50 transition-colors"
                    placeholder="Define the agent behaviour...">
                  </textarea>
                  <div class="text-[11px] dark:text-zinc-500 text-zinc-400 text-right mt-1">Max 500 characters · Included in every AI response</div>
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>

      <!-- ═══════════════ SIDEBAR DROITE (PARTICIPANTS) ═══════════════ -->
      <aside class="flex flex-col flex-shrink-0 dark:bg-brand-darkSidebar bg-white
                    border-l dark:border-brand-darkBorder border-zinc-200 transition-ui z-40 overflow-hidden"
             [class]="showParticipants() ? 'sidebar-right-visible' : 'sidebar-right-hidden'">

        <!-- Header -->
        <div class="h-16 flex items-center justify-between px-6 flex-shrink-0
                    border-b dark:border-brand-darkBorder border-zinc-100">
          <h3 class="text-sm font-bold tracking-tight dark:text-white text-zinc-900">
            Participants
            <span class="ml-1 text-zinc-400 font-normal">({{ members().length }})</span>
          </h3>
          <button (click)="showParticipants.set(false)"
                  class="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-ui">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Participants list -->
        <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1">
          <div *ngFor="let m of members()"
               class="flex items-center gap-3 p-2.5 rounded-xl
                      hover:bg-zinc-50 dark:hover:bg-white/5 cursor-pointer transition-ui">
            <!-- Avatar + status dot -->
            <div class="relative flex-shrink-0">
              <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                   [ngClass]="memberAvatarFull(m)">
                {{ getInitials(m.username) }}
              </div>
              <div class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2
                          dark:border-brand-darkSidebar border-white"
                   [ngClass]="memberStatusDot(m.status)"></div>
            </div>
            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold truncate dark:text-zinc-100 text-zinc-900">{{ m.username }}</p>
              <p class="text-[10px] text-zinc-500 font-medium">{{ memberRoleLabel(m) }}</p>
            </div>
            <!-- Status badges -->
            <span *ngIf="m.status === 'agentic'"
                  class="text-[8px] px-1.5 py-0.5 bg-brand-orange/20 text-brand-orange
                         rounded font-bold uppercase tracking-tight flex-shrink-0 dot-agentic">
              Agentic
            </span>
            <span *ngIf="m.status === 'absent'"
                  class="text-[8px] px-1.5 py-0.5 bg-amber-400/20 text-amber-500
                         rounded font-bold uppercase tracking-tight flex-shrink-0">
              Absent
            </span>
            <span *ngIf="m.status === 'communication'"
                  class="text-[8px] px-1.5 py-0.5 bg-blue-500/20 text-blue-500
                         rounded font-bold uppercase tracking-tight flex-shrink-0">
              En com.
            </span>
          </div>
        </div>
      </aside>
    </div>
  `,
})
export class ConversationComponent implements OnInit, OnChanges, OnDestroy, AfterViewChecked {
  @Input() channelId!: string;
  @ViewChild('messagesEl')  private messagesEl!:  ElementRef<HTMLDivElement>;
  @ViewChild('textareaEl') private textareaEl!: ElementRef<HTMLTextAreaElement>;

  private channelSvc = inject(ChannelService);
  private msgSvc     = inject(MessageService);
  private wsSvc      = inject(ChatWebSocketService);
  private authSvc    = inject(AuthService);
  private agentSvc   = inject(AgentService);

  // Expose helpers to template
  getInitials = getInitials;

  messages       = signal<Message[]>([]);
  channel        = signal<Channel | null>(null);
  members        = signal<ChannelMember[]>([]);
  loading        = signal(true);
  hasMore        = signal(false);
  currentPage    = signal(1);
  showParticipants = signal(false);
  agentTab       = signal<'chat' | 'config'>('config');
  editAgentName   = signal('');
  editAgentPersona = signal('');
  messageText    = '';
  typingText     = signal('');

  currentUserLang = computed(() => this.authSvc.user()?.preferredLanguage ?? 'fr');
  currentUserId   = computed(() => this.authSvc.user()?.id);

  participantsPreview = computed(() => this.members().slice(0, 3));
  participantsOverflow = computed(() => Math.max(0, this.members().length - 3));

  isAgentChannel = computed(() => this.agentSvc.isAgentChannel(this.channel(), this.channelSvc.channels()));

  currentAgent = computed(() => this.agentSvc.getAgentForChannel(this.channel(), this.channelSvc.channels()) ?? null);

  lastAgentResponse = computed(() => {
    const agent = this.currentAgent();
    if (agent?.name === 'ProjectBot') {
      return 'Bonjour @Sophie — le jalon Q4 est prévu le 15 nov. Je peux organiser une réunion de synchronisation cette semaine si vous le souhaitez.';
    }
    return "Mode veille. Activation automatique dès qu'un message nécessite une traduction.";
  });

  private readonly syncAgentEditFields = effect(() => {
    const agent = this.currentAgent();
    this.editAgentName.set(agent?.name ?? '');
    this.editAgentPersona.set(agent?.persona ?? '');
  });

  private subs: Subscription[] = [];
  private shouldScroll = true;
  private typingTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['channelId'] && !changes['channelId'].firstChange) {
      this.subs.forEach(s => s.unsubscribe());
      this.subs = [];
      this.wsSvc.disconnect();
      if (this.typingTimer) { clearTimeout(this.typingTimer); this.typingTimer = null; }
      this.messages.set([]);
      this.channel.set(null);
      this.members.set([]);
      this.loading.set(true);
      this.shouldScroll = true;
      this.typingText.set('');
      this.agentTab.set('config');

      this.loadChannel();
      this.loadMessages();
      this.loadMembers();
      this.wsSvc.connect(this.channelId);

      this.subs.push(
        this.wsSvc.messages$.subscribe(msg => {
          this.messages.update(list => [...list, msg]);
          this.shouldScroll = true;
        }),
        this.wsSvc.typing$.subscribe(({ username }) => {
          this.typingText.set(`${username} écrit…`);
          if (this.typingTimer) clearTimeout(this.typingTimer);
          this.typingTimer = setTimeout(() => this.typingText.set(''), 2500);
        }),
      );
    }
  }

  ngOnInit() {
    this.loadChannel();
    this.loadMessages();
    this.loadMembers();
    this.wsSvc.connect(this.channelId);

    this.subs.push(
      this.wsSvc.messages$.subscribe(msg => {
        this.messages.update(list => [...list, msg]);
        this.shouldScroll = true;
      }),
      this.wsSvc.typing$.subscribe(({ username }) => {
        this.typingText.set(`${username} écrit…`);
        if (this.typingTimer) clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => this.typingText.set(''), 2500);
      }),
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    this.wsSvc.disconnect();
    if (this.typingTimer) clearTimeout(this.typingTimer);
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) { this.scrollToBottom(); this.shouldScroll = false; }
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  loadChannel() {
    this.channelSvc.getChannel(this.channelId).subscribe({
      next: (ch: unknown) => this.channel.set(ch as Channel),
    });
  }

  loadMessages() {
    this.loading.set(true);
    this.msgSvc.getMessages(this.channelId, this.currentPage()).subscribe({
      next: data => {
        this.messages.set(data.items.slice().reverse());
        this.hasMore.set(data.has_more ?? data.hasMore ?? false);
        this.loading.set(false);
        this.shouldScroll = true;
      },
      error: () => this.loading.set(false),
    });
  }

  loadMore() {
    const next = this.currentPage() + 1;
    this.msgSvc.getMessages(this.channelId, next).subscribe(data => {
      this.messages.update(list => [...data.items, ...list]);
      this.hasMore.set(data.has_more ?? data.hasMore ?? false);
      this.currentPage.set(next);
    });
  }

  loadMembers() {
    this.channelSvc.getMembers(this.channelId).subscribe({
      next: (raw: unknown[]) => {
        this.members.set(raw.map(r => this.mapMember(r as Record<string, unknown>)));
      },
      error: () => {},
    });
  }

  private mapMember(raw: Record<string, unknown>): ChannelMember {
    return {
      userId:            (raw['id'] ?? raw['user_id']) as string,
      username:          raw['username']             as string,
      status:            (raw['status'] as string ?? 'active') as ChannelMember['status'],
      role:              (raw['role'] as string)     ?? 'member',
      preferredLanguage: raw['preferred_language']   as string | undefined,
    };
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  sendMessage() {
    const text = this.messageText.trim();
    if (!text) return;
    this.wsSvc.sendMessage(text);
    this.messageText = '';
    this.shouldScroll = true;
  }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
  }

  onInput() {
    if (this.messageText.length % 5 === 0) this.wsSvc.sendTyping();
  }

  applyFormat(format: string) {
    const el = this.textareaEl?.nativeElement;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const sel   = el.value.slice(start, end);
    const marks: Record<string, [string, string]> = {
      bold:          ['**', '**'],
      italic:        ['_', '_'],
      underline:     ['<u>', '</u>'],
      strikethrough: ['~~', '~~'],
    };
    const [open, close] = marks[format] ?? ['', ''];
    if (!open) return;
    this.messageText =
      el.value.slice(0, start) + open + sel + close + el.value.slice(end);
    setTimeout(() => {
      el.selectionStart = start + open.length;
      el.selectionEnd   = start + open.length + sel.length;
      el.focus();
    });
  }

  // ── Reactions ─────────────────────────────────────────────────────────────

  onReact(messageId: string, emoji: string) {
    this.msgSvc.addReaction(messageId, emoji).subscribe(() => {
      this.messages.update(list => list.map(m => {
        if (m.id !== messageId) return m;
        const existing = m.reactions.find(r => r.emoji === emoji);
        const reactions = existing
          ? existing.reactedByMe
            ? m.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count - 1, reactedByMe: false } : r).filter(r => r.count > 0)
            : m.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r)
          : [...m.reactions, { emoji, count: 1, reactedByMe: true }];
        return { ...m, reactions };
      }));
    });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  toggleParticipants() {
    this.showParticipants.update(v => !v);
  }

  onScroll(e: Event) {
    const el = e.target as HTMLDivElement;
    if (el.scrollTop < 100 && this.hasMore()) this.loadMore();
  }

  scrollToBottom() {
    try { this.messagesEl.nativeElement.scrollTop = this.messagesEl.nativeElement.scrollHeight; } catch {}
  }

  trackById = (_: number, m: Message) => m.id;

  memberAvatarBg(m: ChannelMember): string {
    const c = getUserColor(m.userId);
    return `bg-${c}-500`;
  }

  memberAvatarFull(m: ChannelMember): string {
    const c = getUserColor(m.userId);
    return `bg-${c}-500/10 text-${c}-500 border border-${c}-500/20`;
  }

  memberStatusDot(status: string): string {
    switch (status) {
      case 'active':        return 'bg-green-500';
      case 'absent':        return 'bg-amber-400';
      case 'communication': return 'bg-blue-500';
      case 'agentic':       return 'bg-brand-orange dot-agentic';
      case 'inactive':      return 'bg-zinc-400';
      default:              return 'bg-zinc-400';
    }
  }

  memberRoleLabel(m: ChannelMember): string {
    const lang = m.preferredLanguage;
    return lang ? (LANGUAGE_MAP[lang]?.badge ?? lang.toUpperCase()) : '';
  }
}

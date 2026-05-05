import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'chat',
    pathMatch: 'full',
  },
  {
    path: 'chat',
    canActivate: [authGuard],
    loadComponent: () => import('./features/chat/layout/chat-layout.component').then(m => m.ChatLayoutComponent),
    children: [
      {
        path: ':channelId',
        loadComponent: () => import('./features/chat/conversation/conversation.component').then(m => m.ConversationComponent),
      },
      {
        path: '',
        loadComponent: () => import('./features/chat/welcome/welcome.component').then(m => m.WelcomeComponent),
      }
    ]
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent),
  },
  {
    path: '**',
    redirectTo: 'chat',
  },
];

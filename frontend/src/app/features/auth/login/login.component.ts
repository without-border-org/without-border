import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'wb-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-surface-900 flex items-center justify-center p-4 relative overflow-hidden">
      <!-- Animated background orbs -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute -top-40 -left-40 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-accent-pink/15 rounded-full blur-3xl animate-pulse-slow" style="animation-delay:1.5s"></div>
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-700/10 rounded-full blur-3xl"></div>
      </div>

      <div class="w-full max-w-md relative z-10 animate-fade-in">
        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center gap-3 mb-4">
            <div class="w-12 h-12 bg-gradient-to-br from-primary-500 to-accent-pink rounded-2xl flex items-center justify-center shadow-glow-primary">
              <span class="text-2xl">🌍</span>
            </div>
            <h1 class="text-3xl font-bold bg-gradient-to-r from-primary-300 to-accent-violet bg-clip-text text-transparent">
              WithoutBorder
            </h1>
          </div>
          <p class="text-gray-400 text-sm">Collaborate across languages, powered by Gemma 4</p>
        </div>

        <!-- Card -->
        <div class="bg-surface-850/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-glass">
          <h2 class="text-xl font-semibold text-white mb-6">Welcome back</h2>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            <!-- Email -->
            <div>
              <label class="block text-sm font-medium text-gray-400 mb-2">Email</label>
              <input formControlName="email" type="email" placeholder="you@example.com"
                class="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500
                       focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all duration-200"
                [class.border-red-500]="form.get('email')?.invalid && form.get('email')?.touched" />
              <p *ngIf="form.get('email')?.invalid && form.get('email')?.touched" class="mt-1 text-xs text-accent-red">
                Please enter a valid email
              </p>
            </div>

            <!-- Password -->
            <div>
              <label class="block text-sm font-medium text-gray-400 mb-2">Password</label>
              <div class="relative">
                <input formControlName="password" [type]="showPass() ? 'text' : 'password'" placeholder="••••••••"
                  class="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-500
                         focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all duration-200" />
                <button type="button" (click)="showPass.update(v => !v)"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors">
                  {{ showPass() ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>

            <!-- Error -->
            <div *ngIf="error()" class="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
              {{ error() }}
            </div>

            <!-- Submit -->
            <button type="submit" [disabled]="form.invalid || loading()"
              class="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500
                     text-white font-semibold py-3 rounded-xl transition-all duration-200 transform hover:-translate-y-0.5
                     shadow-glow-primary hover:shadow-glow-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
              <span *ngIf="!loading()">Sign In</span>
              <span *ngIf="loading()" class="flex items-center justify-center gap-2">
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Signing in...
              </span>
            </button>
          </form>

          <div class="mt-6 text-center">
            <p class="text-gray-500 text-sm">
              Don't have an account?
              <a routerLink="/auth/register" class="text-primary-400 hover:text-primary-300 font-medium transition-colors ml-1">
                Sign up free
              </a>
            </p>
          </div>
        </div>

        <!-- Demo hint -->
        <div class="mt-4 text-center">
          <p class="text-xs text-gray-600">
            Multilingual collaboration powered by Gemma 4
          </p>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private userSvc = inject(UserService);
  private router = inject(Router);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  loading = signal(false);
  error = signal('');
  showPass = signal(false);

  onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.value;
    this.auth.login(email!, password!).subscribe({
      next: () => this.userSvc.loadMe().subscribe(() => this.router.navigate(['/chat'])),
      error: (e: unknown) => {
        this.loading.set(false);
        this.error.set((e as any)?.error?.detail || 'Login failed. Please check your credentials.');
      },
    });
  }
}

import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { LANGUAGE_MAP } from '../../../core/models';

@Component({
  selector: 'wb-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-surface-900 flex items-center justify-center p-4 relative overflow-hidden">
      <!-- Background orbs -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute -top-40 -right-40 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-accent-teal/10 rounded-full blur-3xl animate-pulse-slow" style="animation-delay:2s"></div>
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
          <p class="text-gray-400 text-sm">Join global teams — speak any language</p>
        </div>

        <!-- Card -->
        <div class="bg-surface-850/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-glass">
          <h2 class="text-xl font-semibold text-white mb-6">Create your account</h2>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            <!-- Email -->
            <div>
              <label class="block text-sm font-medium text-gray-400 mb-2">Email</label>
              <input formControlName="email" type="email" placeholder="you@example.com"
                class="wb-input" [class.border-red-500]="touched('email') && invalid('email')" />
            </div>

            <!-- Username -->
            <div>
              <label class="block text-sm font-medium text-gray-400 mb-2">Username</label>
              <input formControlName="username" type="text" placeholder="yourname"
                class="wb-input" [class.border-red-500]="touched('username') && invalid('username')" />
              <p *ngIf="touched('username') && invalid('username')" class="mt-1 text-xs text-accent-red">
                3–30 characters, no spaces
              </p>
            </div>

            <!-- Language -->
            <div>
              <label class="block text-sm font-medium text-gray-400 mb-2">
                Preferred language
                <span class="text-gray-500 font-normal ml-1">— messages will be translated into this language</span>
              </label>
              <select formControlName="preferredLanguage" class="wb-input">
                <option *ngFor="let lang of languages" [value]="lang.code">
                  {{ lang.flag }} {{ lang.name }}
                </option>
              </select>
            </div>

            <!-- Password -->
            <div>
              <label class="block text-sm font-medium text-gray-400 mb-2">Password</label>
              <div class="relative">
                <input formControlName="password" [type]="showPass() ? 'text' : 'password'" placeholder="Min. 8 characters"
                  class="wb-input pr-12" [class.border-red-500]="touched('password') && invalid('password')" />
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
                     shadow-glow-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
              <span *ngIf="!loading()">Create Account</span>
              <span *ngIf="loading()" class="flex items-center justify-center gap-2">
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Creating account...
              </span>
            </button>
          </form>

          <div class="mt-6 text-center">
            <p class="text-gray-500 text-sm">
              Already have an account?
              <a routerLink="/auth/login" class="text-primary-400 hover:text-primary-300 font-medium ml-1 transition-colors">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private userSvc = inject(UserService);
  private router = inject(Router);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
    preferredLanguage: ['en', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  loading = signal(false);
  error = signal('');
  showPass = signal(false);

  languages = Object.entries(LANGUAGE_MAP).map(([code, val]) => ({ code, ...val }));

  touched = (f: string) => this.form.get(f)?.touched;
  invalid = (f: string) => this.form.get(f)?.invalid;

  onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, username, password, preferredLanguage } = this.form.value;
    this.auth.register(email!, username!, password!, preferredLanguage!).subscribe({
      next: () => this.userSvc.loadMe().subscribe(() => this.router.navigate(['/chat'])),
      error: (e: unknown) => {
        this.loading.set(false);
        this.error.set((e as any)?.error?.detail || 'Registration failed. Please try again.');
      },
    });
  }
}

import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { UserService } from './core/services/user.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent implements OnInit {
  private auth = inject(AuthService);
  private userSvc = inject(UserService);

  ngOnInit() {
    if (this.auth.hasToken()) {
      this.userSvc.loadMe().subscribe({ error: () => this.auth.logout() });
    }
  }
}

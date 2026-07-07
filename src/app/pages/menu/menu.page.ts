import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eyeOffOutline } from 'ionicons/icons';
import { AvatarComponent } from '../../components/ui/avatar/avatar.component';
import { AuthService } from '../../core/auth/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ROUTES } from '../../core/routes';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.page.html',
  styleUrls: ['./menu.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, AvatarComponent, TranslatePipe],
})
export class MenuPage {
  auth           = inject(AuthService);
  private router = inject(Router);

  constructor() {
    addIcons({ eyeOffOutline });
  }

  openSecurity(): void {
    void this.router.navigate([ROUTES.security]);
  }

  openPrivacy(): void {
    void this.router.navigate([ROUTES.settingsPrivacy]);
  }

  openSettings(): void {
    void this.router.navigate([ROUTES.settings]);
  }

  openAbout(): void {
    void this.router.navigate([ROUTES.about]);
  }
}

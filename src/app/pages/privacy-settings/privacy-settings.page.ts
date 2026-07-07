import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonToggle } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline } from 'ionicons/icons';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ROUTES } from '../../core/routes';
import { PrivacyPreferencesService } from '../../core/privacy/privacy-preferences.service';
import { SocketService } from '../../core/infrastructure/socket.service';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [IonContent, IonIcon, IonToggle, TranslatePipe],
  templateUrl: './privacy-settings.page.html',
  styleUrls: ['./privacy-settings.page.scss'],
})
export class PrivacySettingsPage {
  private router        = inject(Router);
  private privacyPrefs  = inject(PrivacyPreferencesService);
  private socketSvc     = inject(SocketService);

  readonly presenceStatusEnabled = computed(() => this.privacyPrefs.presenceStatusEnabled());
  readonly typingIndicatorEnabled = computed(() => this.privacyPrefs.typingIndicatorEnabled());

  constructor() {
    addIcons({ chevronBackOutline });
  }

  goBack(): void {
    void this.router.navigate([ROUTES.menu]);
  }

  togglePresence(event: any): void {
    const val = event.detail.checked;
    this.privacyPrefs.setPresenceStatusEnabled(val);
    this.socketSvc.disconnect();
    this.socketSvc.connect();
  }

  toggleTyping(event: any): void {
    this.privacyPrefs.setTypingIndicatorEnabled(event.detail.checked);
  }
}

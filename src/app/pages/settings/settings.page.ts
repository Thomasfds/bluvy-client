import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { documentTextOutline } from 'ionicons/icons';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ROUTES } from '../../core/routes';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [IonContent, IonIcon, TranslatePipe],
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage {
  private router = inject(Router);

  constructor() {
    addIcons({ documentTextOutline });
  }

  goBack(): void {
    void this.router.navigate([ROUTES.menu]);
  }

  openAppearance(): void {
    void this.router.navigate([ROUTES.settingsAppearance]);
  }

  openLanguage(): void {
    void this.router.navigate([ROUTES.settingsLanguage]);
  }

  openPrivacy(): void {
    void this.router.navigate([ROUTES.settingsPrivacy]);
  }

  openDevices(): void {
    void this.router.navigate([ROUTES.devices]);
  }

  openLogs(): void {
    void this.router.navigate([ROUTES.logs]);
  }

  confirmingDelete = false;

  confirmDeleteAccount(): void {
    this.confirmingDelete = true;
  }

  cancelDeleteAccount(): void {
    this.confirmingDelete = false;
  }
}

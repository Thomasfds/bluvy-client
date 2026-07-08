import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonSearchbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trashOutline, copyOutline, documentTextOutline } from 'ionicons/icons';
import { LogService } from '../../core/logging/log.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-logs',
  templateUrl: './logs.page.html',
  styleUrls: ['./logs.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonSearchbar,
    TranslatePipe,
  ],
})
export class LogsPage {
  logSvc               = inject(LogService);
  private toastCtrl    = inject(ToastController);
  searchText           = signal<string>('');

  // Computed signal to filter logs in real time
  filteredLogs = computed(() => {
    const text = this.searchText().toLowerCase().trim();
    const all  = this.logSvc.logs();
    if (!text) return all;
    return all.filter(l => l.message.toLowerCase().includes(text));
  });

  constructor() {
    addIcons({ trashOutline, copyOutline, documentTextOutline });
  }

  onSearchChange(event: any): void {
    this.searchText.set(event.detail.value ?? '');
  }

  async copyLogs(): Promise<void> {
    const allLogs = this.logSvc.logs();
    if (allLogs.length === 0) return;

    const textToCopy = allLogs
      .map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      const toast = await this.toastCtrl.create({
        message: 'Logs copiés dans le presse-papiers.',
        duration: 2000,
        position: 'bottom',
      });
      await toast.present();
    } catch {
      const toast = await this.toastCtrl.create({
        message: 'Impossible de copier les logs.',
        duration: 2000,
        position: 'bottom',
      });
      await toast.present();
    }
  }

  clearLogs(): void {
    this.logSvc.clearLogs();
  }
}

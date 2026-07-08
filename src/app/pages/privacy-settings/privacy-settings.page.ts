import { Component, inject, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonToggle, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline } from 'ionicons/icons';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ROUTES } from '../../core/routes';
import { PrivacyPreferencesService } from '../../core/privacy/privacy-preferences.service';
import type { ShowButtonTo } from '../../core/privacy/privacy-preferences.service';
import { SocketService } from '../../core/infrastructure/socket.service';
import { AuthService } from '../../core/auth/auth.service';
import { AtprotoRepoService } from '../../core/auth/atproto-repo.service';
import { AtprotoRepository } from '../../core/auth/atproto.repository';

type DmAllowIncoming = 'all' | 'none' | 'following';
type DmSaveStatus    = 'idle' | 'saving' | 'saved' | 'error';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [IonContent, IonIcon, IonToggle, IonSelect, IonSelectOption, TranslatePipe],
  templateUrl: './privacy-settings.page.html',
  styleUrls: ['./privacy-settings.page.scss'],
})
export class PrivacySettingsPage {
  private router        = inject(Router);
  private privacyPrefs  = inject(PrivacyPreferencesService);
  private socketSvc     = inject(SocketService);
  private authSvc       = inject(AuthService);
  private atprotoRepo   = inject(AtprotoRepoService);
  private atprotoRep    = inject(AtprotoRepository);

  readonly presenceStatusEnabled  = computed(() => this.privacyPrefs.presenceStatusEnabled());
  readonly typingIndicatorEnabled = computed(() => this.privacyPrefs.typingIndicatorEnabled());
  readonly showButtonTo           = computed(() => this.privacyPrefs.showButtonTo());

  readonly dmAllowIncoming     = signal<DmAllowIncoming | null>(null);
  readonly dmAllowGroupInvites = signal<DmAllowIncoming | null>(null);
  readonly dmSaveStatus        = signal<DmSaveStatus>('idle');
  readonly dmLoadError         = signal<boolean>(false);

  constructor() {
    addIcons({ chevronBackOutline });
  }

  async ionViewWillEnter(): Promise<void> {
    this.dmLoadError.set(false);
    this.dmAllowIncoming.set(null);
    this.dmAllowGroupInvites.set(null);

    const user = this.authSvc.currentUser();
    if (!user) { this.dmLoadError.set(true); return; }

    try {
      const pdsUrl  = await this.atprotoRep.resolveDidToPds(user.did);
      const settings = await this.atprotoRepo.getBlueskyDmSettings(user.did, pdsUrl);
      if (settings === null) {
        this.dmLoadError.set(true);
      } else {
        this.dmAllowIncoming.set(settings.allowIncoming);
        this.dmAllowGroupInvites.set(settings.allowGroupInvites);
      }
    } catch {
      this.dmLoadError.set(true);
    }
  }

  async retryLoadDmSettings(): Promise<void> {
    await this.ionViewWillEnter();
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

  setVisibility(event: any): void {
    const value = event.detail.value as ShowButtonTo;
    const userDid = this.authSvc.currentUser()?.did ?? '';
    this.privacyPrefs.setShowButtonTo(value, userDid);
  }

  async setBlueskyAllowIncoming(event: any): Promise<void> {
    const value = event.detail.value as DmAllowIncoming;
    const currentGroup = this.dmAllowGroupInvites() ?? 'following';
    this.dmSaveStatus.set('saving');
    try {
      await this.atprotoRepo.setBlueskyDmSettings(value, currentGroup);
      this.dmAllowIncoming.set(value);
      this.dmSaveStatus.set('saved');
      setTimeout(() => this.dmSaveStatus.set('idle'), 2000);
    } catch (err) {
      console.error('[PrivacySettings] setBlueskyAllowIncoming failed:', err);
      this.dmSaveStatus.set('error');
      setTimeout(() => this.dmSaveStatus.set('idle'), 3000);
    }
  }

  async setBlueskyAllowGroupInvites(event: any): Promise<void> {
    const value = event.detail.value as DmAllowIncoming;
    const currentIncoming = this.dmAllowIncoming() ?? 'following';
    this.dmSaveStatus.set('saving');
    try {
      await this.atprotoRepo.setBlueskyDmSettings(currentIncoming, value);
      this.dmAllowGroupInvites.set(value);
      this.dmSaveStatus.set('saved');
      setTimeout(() => this.dmSaveStatus.set('idle'), 2000);
    } catch (err) {
      console.error('[PrivacySettings] setBlueskyAllowGroupInvites failed:', err);
      this.dmSaveStatus.set('error');
      setTimeout(() => this.dmSaveStatus.set('idle'), 3000);
    }
  }
}

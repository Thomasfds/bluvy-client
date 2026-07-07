import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PrivacyPreferencesService {
  private static readonly KEY_TYPING = 'privacy_typing_enabled';
  private static readonly KEY_PRESENCE = 'privacy_presence_enabled';

  readonly typingIndicatorEnabled = signal<boolean>(
    localStorage.getItem(PrivacyPreferencesService.KEY_TYPING) !== 'false'
  );

  readonly presenceStatusEnabled = signal<boolean>(
    localStorage.getItem(PrivacyPreferencesService.KEY_PRESENCE) !== 'false'
  );

  setTypingIndicatorEnabled(enabled: boolean): void {
    localStorage.setItem(PrivacyPreferencesService.KEY_TYPING, enabled ? 'true' : 'false');
    this.typingIndicatorEnabled.set(enabled);
  }

  setPresenceStatusEnabled(enabled: boolean): void {
    localStorage.setItem(PrivacyPreferencesService.KEY_PRESENCE, enabled ? 'true' : 'false');
    this.presenceStatusEnabled.set(enabled);
  }
}

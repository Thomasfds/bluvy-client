import { Injectable, signal } from '@angular/core';

export type ShowButtonTo = 'none' | 'usersIFollow' | 'everyone';

@Injectable({ providedIn: 'root' })
export class PrivacyPreferencesService {
  private static readonly KEY_TYPING      = 'privacy_typing_enabled';
  private static readonly KEY_PRESENCE    = 'privacy_presence_enabled';
  private static readonly KEY_SHOW_BTN    = 'privacy_show_button_to';

  readonly typingIndicatorEnabled = signal<boolean>(
    localStorage.getItem(PrivacyPreferencesService.KEY_TYPING) !== 'false'
  );

  readonly presenceStatusEnabled = signal<boolean>(
    localStorage.getItem(PrivacyPreferencesService.KEY_PRESENCE) !== 'false'
  );

  readonly showButtonTo = signal<ShowButtonTo>(
    (localStorage.getItem(PrivacyPreferencesService.KEY_SHOW_BTN) as ShowButtonTo | null) ?? 'everyone'
  );

  setTypingIndicatorEnabled(enabled: boolean): void {
    localStorage.setItem(PrivacyPreferencesService.KEY_TYPING, enabled ? 'true' : 'false');
    this.typingIndicatorEnabled.set(enabled);
  }

  setPresenceStatusEnabled(enabled: boolean): void {
    localStorage.setItem(PrivacyPreferencesService.KEY_PRESENCE, enabled ? 'true' : 'false');
    this.presenceStatusEnabled.set(enabled);
  }

  setShowButtonTo(value: ShowButtonTo, userDid: string): void {
    localStorage.setItem(PrivacyPreferencesService.KEY_SHOW_BTN, value);
    this.showButtonTo.set(value);
    // Invalidate the declaration cache so syncDeclaration will re-publish on next startup
    localStorage.removeItem(`bluvy-declaration-checked-${userDid}`);
  }
}

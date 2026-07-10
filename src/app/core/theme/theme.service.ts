import { Injectable, effect, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type ThemePalette = 'bluesky' | 'mu';

const SURFACE_LIGHT_BSKY = '#F4F4F6';
const SURFACE_DARK_BSKY  = '#161E2E';
const SURFACE_LIGHT_MU   = '#EDEBE5';
const SURFACE_DARK_MU    = '#1F1F1F';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private static readonly KEY = 'theme';
  private static readonly PALETTE_KEY = 'palette';

  readonly preference = signal<ThemeMode>(
    (localStorage.getItem(ThemeService.KEY) as ThemeMode) ?? 'auto',
  );

  readonly palette = signal<ThemePalette>(
    (localStorage.getItem(ThemeService.PALETTE_KEY) as ThemePalette) ?? 'bluesky',
  );

  constructor() {
    effect(() => this.apply(this.preference(), this.palette()));

    // Listen to OS prefers-color-scheme change for 'auto' mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.preference() === 'auto') {
        this.apply(this.preference(), this.palette());
      }
    });
  }

  set(mode: ThemeMode): void {
    localStorage.setItem(ThemeService.KEY, mode);
    this.preference.set(mode);
  }

  setPalette(palette: ThemePalette): void {
    localStorage.setItem(ThemeService.PALETTE_KEY, palette);
    this.palette.set(palette);
  }

  private apply(mode: ThemeMode, palette: ThemePalette): void {
    const html = document.documentElement;
    html.classList.remove('theme-dark', 'theme-light');
    if (mode === 'dark')  html.classList.add('theme-dark');
    if (mode === 'light') html.classList.add('theme-light');

    html.classList.remove('palette-bluesky', 'palette-mu');
    html.classList.add(`palette-${palette}`);

    const isDark = mode === 'dark' ||
      (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    let surfaceColor = SURFACE_LIGHT_BSKY;
    if (isDark) {
      surfaceColor = palette === 'mu' ? SURFACE_DARK_MU : SURFACE_DARK_BSKY;
    } else {
      surfaceColor = palette === 'mu' ? SURFACE_LIGHT_MU : SURFACE_LIGHT_BSKY;
    }
    this.syncNativeStatusBar(surfaceColor);
  }

  private syncNativeStatusBar(color: string): void {
    if (Capacitor.getPlatform() !== 'android') return;
    void EdgeToEdge.setStatusBarColor({ color });
    void EdgeToEdge.setNavigationBarColor({ color });
  }
}

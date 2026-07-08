import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { MlsService } from '../mls.service';
import { KeyPackageRepository } from './key-package.repository';
import { AtprotoRepoService } from '../../auth/atproto-repo.service';
import { OAuthService } from '../../auth/oauth.service';
import { PrivacyPreferencesService } from '../../privacy/privacy-preferences.service';
import type { KeyPackageCountResponse, KeyPackagePoolStatus } from './key-package.types';

export type { KeyPackageCountResponse, KeyPackagePoolStatus } from './key-package.types';

const KP_TARGET    = 20;
const KP_THRESHOLD = 10;

@Injectable({ providedIn: 'root' })
export class KeyPackageService {
  private readonly kpRepo        = inject(KeyPackageRepository);
  private readonly mlsSvc        = inject(MlsService);
  private readonly atprotoRepo   = inject(AtprotoRepoService);
  private readonly oauthSvc      = inject(OAuthService);
  private readonly privacyPrefs  = inject(PrivacyPreferencesService);

  private _poolStatus:   KeyPackagePoolStatus = 'idle';
  private ensurePromise?: Promise<void>;

  get poolStatus(): KeyPackagePoolStatus { return this._poolStatus; }

  async ensureKeyPackagePool(userDid: string, deviceId: string): Promise<void> {
    if (this.ensurePromise) return this.ensurePromise;

    this.ensurePromise = this.runEnsure(userDid, deviceId).finally(() => {
      this.ensurePromise = undefined;
    });

    return this.ensurePromise;
  }

  async getServerCount(): Promise<KeyPackageCountResponse> {
    return this.kpRepo.getCount();
  }

  async refillPool(userDid: string, deviceId: string, toGenerate: number): Promise<void> {
    const count = Math.max(0, Math.min(toGenerate, KP_TARGET));
    if (count === 0) return;

    const generated = await this.mlsSvc.generateKeyPackages(userDid, deviceId, count);
    if (generated.length === 0) return;

    const uploaded = await this.kpRepo.upload(generated.map(r => r.serializedKeyPackage));

    const idsByPayload = new Map(uploaded.data.map(item => [item.keyPackage, item.id]));
    generated.forEach(r => {
      r.serverId = idsByPayload.get(r.serializedKeyPackage) ?? null;
    });

    if (!environment.production) {
      console.log(`[MLS:trace:3] refillPool  uploading ${generated.length} KP(s)`);
      generated.forEach((r, i) => {
        console.log(`[MLS:trace:3]   index=${i}  serverId=${r.serverId}  b64fp=${r.serializedKeyPackage.substring(0, 48)}`);
      });
    }

    await this.mlsSvc.appendKeyPackagesToState(userDid, deviceId, generated);
  }

  async syncDeclaration(userDid: string): Promise<void> {
    if (!this.oauthSvc.session) return;
    try {
      const showButtonTo = this.privacyPrefs.showButtonTo();
      const expectedUrl  = `https://bluvy.app/message#${userDid}`;

      const cacheKey     = `bluvy-declaration-cache-${userDid}`;
      const TTL_MS       = 24 * 60 * 60 * 1000; // 24 hours

      const cacheStr = localStorage.getItem(cacheKey);
      let cache: any = null;
      try {
        if (cacheStr) cache = JSON.parse(cacheStr);
      } catch {}

      const isCacheValid =
        cache &&
        (Date.now() - cache.timestamp < TTL_MS) &&
        cache.version === environment.version &&
        cache.showButtonTo === showButtonTo &&
        cache.messageMeUrl === expectedUrl;

      if (isCacheValid) return;

      // Read the current record from the PDS
      const existing = await this.atprotoRepo.getDeclaration();

      const needsWrite =
        !existing ||
        existing.version !== environment.version ||
        existing.messageMe?.messageMeUrl !== expectedUrl ||
        existing.messageMe?.showButtonTo  !== showButtonTo;

      if (needsWrite) {
        await this.atprotoRepo.publishDeclaration(showButtonTo);
      }

      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          timestamp: Date.now(),
          version:   environment.version,
          showButtonTo,
          messageMeUrl: expectedUrl,
        })
      );
    } catch (err) {
      if (!environment.production) console.error('[KeyPackageService] syncDeclaration failed:', err);
      // Do not write the cache on failure — next startup will retry
    }
  }

  async handleNoKeyPackages<T>(
    userDid:   string,
    deviceId:  string,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      if (
        err instanceof HttpErrorResponse &&
        (err.error as { code?: string })?.code === 'NO_KEY_PACKAGES'
      ) {
        if (!environment.production) console.warn('[KeyPackageService] NO_KEY_PACKAGES — refilling pool and retrying once');
        await this.refillPool(userDid, deviceId, KP_THRESHOLD);
        return await operation();
      }
      throw err;
    }
  }

  private async runEnsure(userDid: string, deviceId: string): Promise<void> {
    this._poolStatus = 'checking';

    let countResp: KeyPackageCountResponse;
    try {
      countResp = await this.getServerCount();
    } catch (err) {
      this._poolStatus = 'error';
      if (!environment.production) console.error('[KeyPackageService] ensureKeyPackagePool: failed to get server count', err);
      return;
    }

    if (!countResp.needsRefill) {
      this._poolStatus = 'idle';
      await this.syncDeclaration(userDid);
      return;
    }

    this._poolStatus = 'refilling';
    try {
      await this.refillPool(userDid, deviceId, KP_TARGET - countResp.count);
      this._poolStatus = 'idle';
      await this.syncDeclaration(userDid);
    } catch (err) {
      this._poolStatus = 'error';
      throw err;
    }
  }
}

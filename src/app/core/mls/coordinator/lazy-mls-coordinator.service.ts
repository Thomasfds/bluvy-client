import { Injectable, Injector, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { MlsCoordinatorBase } from './mls-coordinator.base';
import type { UserProfile } from '../../auth/auth.types';
import type { DeviceInfo } from '../../device/device.types';
import type { DecryptResult, ReplayResult, ReplayedDecryptEvent } from './mls-coordinator.types';
import type {
  ConversationReadyEvent,
  WelcomeProcessedEvent,
  CommitAppliedEvent,
  PendingDecryptQueuedEvent,
  RestoreCompletedEvent,
} from './mls-coordinator.events';

@Injectable({ providedIn: 'root' })
export class LazyMlsCoordinatorService extends MlsCoordinatorBase {
  private readonly injector = inject(Injector);
  private delegate: MlsCoordinatorBase | null = null;
  private delegatePromise: Promise<MlsCoordinatorBase> | null = null;

  private getDelegate(): Promise<MlsCoordinatorBase> {
    if (this.delegate) return Promise.resolve(this.delegate);
    if (!this.delegatePromise) {
      this.delegatePromise = import('./mls-coordinator.service').then(m => {
        this.delegate = this.injector.get(m.MlsCoordinatorService);
        return this.delegate;
      });
    }
    return this.delegatePromise;
  }

  async initializeForSession(user: UserProfile, device: DeviceInfo): Promise<void> {
    const d = await this.getDelegate();
    return d.initializeForSession(user, device);
  }

  isConversationReady(convId: string): boolean {
    return this.delegate ? this.delegate.isConversationReady(convId) : false;
  }

  canEncrypt(convId: string): boolean {
    return this.delegate ? this.delegate.canEncrypt(convId) : false;
  }

  canDecrypt(convId: string): boolean {
    return this.delegate ? this.delegate.canDecrypt(convId) : false;
  }

  async canProvision(convId: string, user: UserProfile, device: DeviceInfo): Promise<boolean> {
    const d = await this.getDelegate();
    return d.canProvision(convId, user, device);
  }

  async processWelcome(
    welcomeId:     string | null,
    welcomeBase64: string,
    convId:        string,
    user:          UserProfile,
    device:        DeviceInfo,
  ): Promise<void> {
    const d = await this.getDelegate();
    return d.processWelcome(welcomeId, welcomeBase64, convId, user, device);
  }

  async fetchAndProcessPendingWelcome(
    convId: string,
    user:   UserProfile,
    device: DeviceInfo,
  ): Promise<boolean> {
    const d = await this.getDelegate();
    return d.fetchAndProcessPendingWelcome(convId, user, device);
  }

  async ensureGroupReady(
    convId:         string,
    participantDid: string,
    user:           UserProfile,
    device:         DeviceInfo,
    signal?:        AbortSignal,
    preConsumedKeyPackage?: { keyPackage: string; deviceId: string },
  ): Promise<void> {
    const d = await this.getDelegate();
    return d.ensureGroupReady(convId, participantDid, user, device, signal, preConsumedKeyPackage);
  }

  async clearConversationGroup(convId: string, user: UserProfile, device: DeviceInfo): Promise<void> {
    const d = await this.getDelegate();
    return d.clearConversationGroup(convId, user, device);
  }

  async prepareConversation(user: UserProfile, device: DeviceInfo, participantDid: string): Promise<void> {
    const d = await this.getDelegate();
    return d.prepareConversation(user, device, participantDid);
  }

  async prepareConversationWithKeyPackage(
    user:           UserProfile,
    device:         DeviceInfo,
    participantDid: string,
    convId:         string,
    keyPackage:     { keyPackage: string; deviceId: string }
  ): Promise<void> {
    const d = await this.getDelegate();
    return d.prepareConversationWithKeyPackage(user, device, participantDid, convId, keyPackage);
  }

  async decryptMessage(
    convId:         string,
    messageId:      string,
    senderDid:      string,
    senderDeviceId: string,
    isMine:         boolean,
    createdAt:      number,
    ciphertextB64:  string,
    user:           UserProfile,
    device:         DeviceInfo,
  ): Promise<DecryptResult> {
    const d = await this.getDelegate();
    return d.decryptMessage(convId, messageId, senderDid, senderDeviceId, isMine, createdAt, ciphertextB64, user, device);
  }

  async encryptMessage(
    convId:    string,
    plaintext: string,
    user:      UserProfile,
    device:    DeviceInfo,
  ): Promise<string> {
    const d = await this.getDelegate();
    return d.encryptMessage(convId, plaintext, user, device);
  }

  async processIncomingCommit(
    convId:       string,
    commitBase64: string,
    epoch:        number,
    user:         UserProfile,
    device:       DeviceInfo,
  ): Promise<void> {
    const d = await this.getDelegate();
    return d.processIncomingCommit(convId, commitBase64, epoch, user, device);
  }

  async catchUpMissedCommits(convId: string, user: UserProfile, device: DeviceInfo): Promise<void> {
    const d = await this.getDelegate();
    return d.catchUpMissedCommits(convId, user, device);
  }

  async provisionDevice(
    newDeviceId: string,
    convId:      string,
    user:        UserProfile,
    device:      DeviceInfo,
  ): Promise<void> {
    const d = await this.getDelegate();
    return d.provisionDevice(newDeviceId, convId, user, device);
  }

  async injectRestoredGroupStates(
    groupStates: Record<string, string>,
    user:        UserProfile,
    device:      DeviceInfo,
  ): Promise<void> {
    const d = await this.getDelegate();
    return d.injectRestoredGroupStates(groupStates, user, device);
  }

  async replayPendingDecrypts(convId: string, user: UserProfile, device: DeviceInfo): Promise<ReplayResult> {
    const d = await this.getDelegate();
    return d.replayPendingDecrypts(convId, user, device);
  }

  readonly conversationReady$: Observable<ConversationReadyEvent> = from(this.getDelegate()).pipe(
    switchMap(d => d.conversationReady$)
  );
  readonly welcomeProcessed$: Observable<WelcomeProcessedEvent> = from(this.getDelegate()).pipe(
    switchMap(d => d.welcomeProcessed$)
  );
  readonly commitApplied$: Observable<CommitAppliedEvent> = from(this.getDelegate()).pipe(
    switchMap(d => d.commitApplied$)
  );
  readonly pendingDecryptQueued$: Observable<PendingDecryptQueuedEvent> = from(this.getDelegate()).pipe(
    switchMap(d => d.pendingDecryptQueued$)
  );
  readonly pendingDecryptReplayed$: Observable<ReplayedDecryptEvent> = from(this.getDelegate()).pipe(
    switchMap(d => d.pendingDecryptReplayed$)
  );
  readonly restoreCompleted$: Observable<RestoreCompletedEvent> = from(this.getDelegate()).pipe(
    switchMap(d => d.restoreCompleted$)
  );
}

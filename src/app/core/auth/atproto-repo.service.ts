import { Injectable, inject } from '@angular/core';
import { Agent } from '@atproto/api';
import { OAuthService } from './oauth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AtprotoRepoService {
  private oauth = inject(OAuthService);

  private getAgent(): Agent | null {
    const session = this.oauth.session;
    if (!session) return null;
    return new Agent(session.fetchHandler.bind(session));
  }

  /**
   * Publishes or updates the com.bluvy.declaration record in the user's ATProto repository.
   * The record signals that this DID is a Bluvy user and exposes the "message me" link.
   * No cryptographic material is stored — the DID alone is sufficient to initiate a conversation.
   */
  async publishDeclaration(
    showButtonTo: 'none' | 'usersIFollow' | 'everyone' = 'everyone'
  ): Promise<void> {
    const agent = this.getAgent();
    if (!agent || !this.oauth.session?.sub) {
      throw new Error('No active ATProto session');
    }

    const repo = this.oauth.session.sub;
    const cleanOrigin = window.location.origin.endsWith('/') ? window.location.origin.slice(0, -1) : window.location.origin;
    const baseUrl = environment.production ? 'https://bluvy.app' : cleanOrigin;
    const messageMeUrl = `${baseUrl}/message#${repo}`;

    const record = {
      version: environment.version,
      messageMe: {
        showButtonTo,
        messageMeUrl
      }
    };

    await agent.com.atproto.repo.putRecord({
      repo,
      collection: 'com.bluvy.declaration',
      rkey: 'self',
      record
    });
  }

  /**
   * Reads the current com.bluvy.declaration record from the user's PDS repo.
   * Returns null if the record does not exist (404).
   */
  async getDeclaration(): Promise<{ version: string; messageMe: { showButtonTo: string; messageMeUrl: string } } | null> {
    const agent = this.getAgent();
    if (!agent || !this.oauth.session?.sub) return null;

    try {
      const res = await agent.com.atproto.repo.getRecord({
        repo:       this.oauth.session.sub,
        collection: 'com.bluvy.declaration',
        rkey:       'self',
      });
      return res.data.value as { version: string; messageMe: { showButtonTo: string; messageMeUrl: string } };
    } catch {
      // Record absent or any network error — treat as missing
      return null;
    }
  }

  /**
   * Reads the Bluesky DM privacy setting directly from the user's PDS repo
   * via an unauthenticated public fetch — no OAuth session required.
   * Returns null only on unexpected network/server errors.
   * When the record is absent, Bluesky's effective default is 'following'.
   */
  async getBlueskyDmSettings(
    did:    string,
    pdsUrl: string,
  ): Promise<{ allowIncoming: 'all' | 'none' | 'following'; allowGroupInvites: 'all' | 'none' | 'following' } | null> {
    try {
      const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.getRecord`);
      url.searchParams.set('repo',       did);
      url.searchParams.set('collection', 'chat.bsky.actor.declaration');
      url.searchParams.set('rkey',       'self');

      const res = await fetch(url.toString());

      // Record never set → Bluesky effective default is 'following' for both
      if (res.status === 404 || res.status === 400) {
        return { allowIncoming: 'following', allowGroupInvites: 'following' };
      }
      if (!res.ok) return null;

      const data = await res.json() as { value?: { allowIncoming?: string; allowGroupInvites?: string } };
      const allowIncoming = data?.value?.allowIncoming as 'all' | 'none' | 'following' | undefined;
      const allowGroupInvites = data?.value?.allowGroupInvites as 'all' | 'none' | 'following' | undefined;
      return {
        allowIncoming: allowIncoming ?? 'following',
        allowGroupInvites: allowGroupInvites ?? 'following'
      };
    } catch {
      return null;
    }
  }

  /**
   * Writes the Bluesky DM privacy settings (chat.bsky.actor.declaration).
   * Controls who can send direct messages and group invites to this user on Bluesky.
   */
  async setBlueskyDmSettings(
    allowIncoming: 'all' | 'none' | 'following',
    allowGroupInvites: 'all' | 'none' | 'following'
  ): Promise<void> {
    const agent = this.getAgent();
    if (!agent || !this.oauth.session?.sub) {
      throw new Error('No active ATProto session');
    }

    await agent.com.atproto.repo.putRecord({
      repo:       this.oauth.session.sub,
      collection: 'chat.bsky.actor.declaration',
      rkey:       'self',
      record:     {
        $type: 'chat.bsky.actor.declaration',
        allowIncoming,
        allowGroupInvites
      },
    });
  }

  async deleteDeclaration(): Promise<void> {
    const agent = this.getAgent();
    if (!agent || !this.oauth.session?.sub) {
      return; // No active session to delete from
    }

    const repo = this.oauth.session.sub;
    try {
      await agent.com.atproto.repo.deleteRecord({
        repo,
        collection: 'com.bluvy.declaration',
        rkey: 'self'
      });
    } catch (err) {
      // Ignore if record already deleted or doesn't exist
    }
  }

  /**
   * Programmatically sends a direct message to a Bluesky user.
   */
  async sendBlueskyDM(recipientDid: string, text: string): Promise<void> {
    const agent = this.getAgent();
    if (!agent) {
      throw new Error('No active ATProto session');
    }

    // 1. Get or create the conversation ID for the recipient
    const convoRes = await agent.call(
      'chat.bsky.convo.getConvoForMembers',
      { members: [recipientDid] },
      undefined,
      {
        headers: {
          'atproto-proxy': 'did:web:api.bsky.chat'
        }
      }
    );

    const convoId = (convoRes.data as any)?.convo?.id;
    if (!convoId) {
      throw new Error('Could not establish Bluesky DM channel');
    }

    // 2. Send the invitation message to the conversation
    await agent.call(
      'chat.bsky.convo.sendMessage',
      undefined,
      {
        convoId,
        message: { text }
      },
      {
        headers: {
          'atproto-proxy': 'did:web:api.bsky.chat'
        }
      }
    );
  }
}

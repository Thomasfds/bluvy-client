import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { ApiClientService } from '../infrastructure/api-client.service';
import { ROUTES } from '../routes';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly apiClient = inject(ApiClientService);
  private readonly router    = inject(Router);

  initialize(): void {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // 1. Request permission and register
    this.registerPush();

    // 2. Listeners
    PushNotifications.addListener('registration', async (token) => {
      // Send token to backend
      try {
        await this.apiClient.post('/v1/devices/push-token', {
          token: token.value,
          platform: 'fcm', // Capacitor push notifications plugin uses FCM on Android and APNs on iOS (wrapped by FCM usually)
        });
      } catch (err) {
        console.error('[PushNotificationService] Failed to upload push token to backend:', err);
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushNotificationService] Registration error:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // Foreground notification received.
      // Usually, Socket.IO updates the UI faster, so we just log or do nothing.
      console.log('[PushNotificationService] Foreground notification received:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      // User tapped the notification
      const data = notification.notification.data;
      const conversationId = data['conversationId'] as string | undefined;
      if (conversationId) {
        void this.router.navigate([ROUTES.conversation(conversationId)]);
      }
    });
  }

  private registerPush(): void {
    PushNotifications.requestPermissions().then((result) => {
      if (result.receive === 'granted') {
        // Register with Apple / Google to receive push tokens
        void PushNotifications.register();
      }
    });
  }
}

export interface MobileNotification {
  userId: string;
  title: string;
  body: string;
  action?: string;
}

export class MobilePushService {
  private endpoints: Map<string, string> = new Map();

  registerDevice(userId: string, endpoint: string): void {
    this.endpoints.set(userId, endpoint);
  }

  async sendNotification(notification: MobileNotification): Promise<boolean> {
    const endpoint = this.endpoints.get(notification.userId);
    if (!endpoint) {
      console.warn(`No device registered for user ${notification.userId}`);
      return false;
    }

    try {
      const payload = {
        title: notification.title,
        body: notification.body,
        action: notification.action || 'open',
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      console.error(`Failed to send notification to ${notification.userId}:`, error);
      return false;
    }
  }

  async notifyProfileInteraction(userId: string, interactorName: string): Promise<void> {
    await this.sendNotification({
      userId,
      title: 'New Interaction',
      body: `${interactorName} interacted with your profile`,
      action: 'view_profile',
    });
  }

  async notifyPostInteraction(userId: string, postId: string): Promise<void> {
    await this.sendNotification({
      userId,
      title: 'Post Activity',
      body: 'Someone interacted with your post',
      action: `view_post_${postId}`,
    });
  }
}

import { Test } from '@nestjs/testing';

import { DECISION_NOTIFIER } from './decision-notifier.js';
import { NOTIFICATION_REPOSITORY } from './notification.repository.js';
import { NotificationService } from './notification.service.js';
import { NotificationsModule } from './notifications.module.js';
import { fakeNotificationRepository } from './testing.js';

describe('NotificationsModule', () => {
  it('provides the real notification service as the decision notifier', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [NotificationsModule],
    })
      .overrideProvider(NOTIFICATION_REPOSITORY)
      .useValue(fakeNotificationRepository())
      .compile();

    expect(moduleRef.get(DECISION_NOTIFIER)).toBeInstanceOf(
      NotificationService,
    );
    expect(moduleRef.get(DECISION_NOTIFIER)).toBe(
      moduleRef.get(NotificationService),
    );
  });
});

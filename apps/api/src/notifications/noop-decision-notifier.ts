import { Injectable } from '@nestjs/common';

import type { DecisionNotifier } from './decision-notifier.js';

/** Placeholder until T6 provides the real notifier backed by stored notifications. */
@Injectable()
export class NoopDecisionNotifier implements DecisionNotifier {
  async notifyDecision(): Promise<void> {}
}

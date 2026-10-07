import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CHANNEL_LABELS, type ChannelKind } from '@repo/types';

import type { Env } from '../../config/env.js';

export class ChannelUnavailableError extends Error {
  constructor(kind: ChannelKind) {
    super(`${CHANNEL_LABELS[kind]} gateway is unavailable`);
    this.name = 'ChannelUnavailableError';
  }
}

/**
 * The SMS and siren gateways are simulated. SIMULATE_CHANNEL_FAILURE makes a
 * gateway refuse, so partial dissemination and retry can be demonstrated.
 */
@Injectable()
export class ChannelFailureSwitch {
  private readonly failing: ReadonlySet<ChannelKind>;

  constructor(config: ConfigService<Env, true>) {
    this.failing = new Set(
      config.get('SIMULATE_CHANNEL_FAILURE', { infer: true }),
    );
  }

  check(kind: ChannelKind): void {
    if (this.failing.has(kind)) throw new ChannelUnavailableError(kind);
  }
}

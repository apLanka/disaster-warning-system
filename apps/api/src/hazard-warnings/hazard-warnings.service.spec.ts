import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import type { CreateWarningInput } from '@repo/types';

import type { WarningDisseminator } from './dissemination/warning-disseminator.js';
import { HazardWarningsService } from './hazard-warnings.service.js';
import {
  channel,
  CLIENT_REQUEST_ID,
  fakeDirectory,
  fakeWarningRepository,
  hoursFromNow,
  issuedWarning,
  NOW,
  OFFICER,
  OTHER_WARNING_ID,
  WARNING_ID,
  warningEntity,
} from './testing/fixtures.js';

const fields = {
  hazardType: 'FLOOD' as const,
  level: 'HIGH' as const,
  districts: ['COLOMBO' as const, 'GAMPAHA' as const],
  description: 'Heavy rainfall expected. Evacuate low-lying areas.',
  safetyInstructions: ['Move to higher ground immediately'],
  validUntil: hoursFromNow(12).toISOString(),
};
const issueInput: CreateWarningInput = {
  ...fields,
  clientRequestId: CLIENT_REQUEST_ID,
  action: 'ISSUE',
};

function fakeDisseminator() {
  return {
    send: vi
      .fn<WarningDisseminator['send']>()
      .mockImplementation(async (_w, kinds) =>
        kinds.map((kind) => channel(kind)),
      ),
    announceAllClear: vi
      .fn<WarningDisseminator['announceAllClear']>()
      .mockResolvedValue(undefined),
  };
}

describe('HazardWarningsService', () => {
  let warnings: ReturnType<typeof fakeWarningRepository>;
  let directory: ReturnType<typeof fakeDirectory>;
  let disseminator: ReturnType<typeof fakeDisseminator>;
  let service: HazardWarningsService;

  beforeEach(() => {
    warnings = fakeWarningRepository();
    directory = fakeDirectory();
    disseminator = fakeDisseminator();
    warnings.findByClientRequestId.mockResolvedValue(null);
    warnings.findActiveOverlapping.mockResolvedValue([]);
    warnings.create.mockImplementation(async (input) => ({
      warning: warningEntity({
        ...input,
        status: input.status,
        channels: input.channels,
      }),
      created: true,
    }));
    warnings.recordDissemination.mockImplementation(
      async (_id, channels, status) => issuedWarning({ channels, status }),
    );
    service = new HazardWarningsService(
      warnings,
      directory,
      disseminator as unknown as WarningDisseminator,
    );
  });

  describe('preview', () => {
    it('returns the recipient count and any overlapping active warning', async () => {
      const count = {
        total: 5,
        withPhone: 3,
        byDistrict: { COLOMBO: 5, GAMPAHA: 0 },
      };
      directory.countInDistricts.mockResolvedValue(count);
      warnings.findActiveOverlapping.mockResolvedValue([
        issuedWarning({ id: OTHER_WARNING_ID }),
      ]);

      const preview = await service.preview(fields, NOW);

      expect(preview.recipients).toEqual(count);
      expect(preview.duplicates).toHaveLength(1);
      expect(warnings.findActiveOverlapping).toHaveBeenCalledWith({
        hazardType: 'FLOOD',
        districts: ['COLOMBO', 'GAMPAHA'],
        now: NOW,
      });
    });

    it('rejects details that could not be issued', async () => {
      await expect(
        service.preview({ ...fields, description: undefined }, NOW),
      ).rejects.toThrow(
        new BadRequestException('description is required to issue a warning'),
      );
    });
  });

  describe('create', () => {
    it('saves a draft without sending anything', async () => {
      const result = await service.create(
        {
          hazardType: 'FLOOD',
          level: 'LOW',
          districts: ['KANDY'],
          clientRequestId: CLIENT_REQUEST_ID,
          action: 'DRAFT',
        },
        OFFICER,
        NOW,
      );

      expect(result.created).toBe(true);
      expect(warnings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DRAFT',
          channels: [],
          createdBy: OFFICER,
          safetyInstructions: [],
        }),
      );
      expect(disseminator.send).not.toHaveBeenCalled();
    });

    it('rejects a draft whose period ends before it starts', async () => {
      await expect(
        service.create(
          {
            ...issueInput,
            action: 'DRAFT',
            validFrom: hoursFromNow(5).toISOString(),
            validUntil: hoursFromNow(1).toISOString(),
          },
          OFFICER,
          NOW,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('issues: stores as disseminating, sends on every channel, records the result', async () => {
      const result = await service.create(issueInput, OFFICER, NOW);

      expect(warnings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DISSEMINATING',
          issuedBy: OFFICER,
          issuedAt: NOW,
          validFrom: NOW,
          channels: expect.arrayContaining([
            expect.objectContaining({ state: 'PENDING' }),
          ]),
        }),
      );
      expect(disseminator.send).toHaveBeenCalledWith(
        expect.any(Object),
        ['PUSH', 'SMS', 'AUDIBLE'],
        NOW,
      );
      expect(warnings.recordDissemination).toHaveBeenCalledWith(
        WARNING_ID,
        [channel('PUSH'), channel('SMS'), channel('AUDIBLE')],
        'DISSEMINATED',
      );
      expect(result).toEqual({
        warning: expect.objectContaining({ status: 'DISSEMINATED' }),
        created: true,
      });
    });

    it('records PARTIALLY_DISSEMINATED when a channel failed', async () => {
      disseminator.send.mockResolvedValue([
        channel('PUSH'),
        channel('SMS', { state: 'FAILED' }),
        channel('AUDIBLE'),
      ]);

      await service.create(issueInput, OFFICER, NOW);

      expect(warnings.recordDissemination).toHaveBeenCalledWith(
        WARNING_ID,
        expect.any(Array),
        'PARTIALLY_DISSEMINATED',
      );
    });

    it('lists every missing detail before issuing', async () => {
      await expect(
        service.create(
          { ...issueInput, description: undefined, safetyInstructions: [] },
          OFFICER,
          NOW,
        ),
      ).rejects.toThrow(
        'description is required to issue a warning; add at least one safety instruction',
      );
      expect(warnings.create).not.toHaveBeenCalled();
    });

    it('refuses a duplicate active warning unless forced', async () => {
      warnings.findActiveOverlapping.mockResolvedValue([
        issuedWarning({ id: OTHER_WARNING_ID, reference: 'HW-2026-0009' }),
      ]);

      await expect(service.create(issueInput, OFFICER, NOW)).rejects.toThrow(
        new ConflictException(
          'An active HIGH Flood warning (HW-2026-0009) already covers Colombo, Gampaha. Review it, or confirm to issue anyway.',
        ),
      );

      await service.create({ ...issueInput, force: true }, OFFICER, NOW);
      expect(warnings.create).toHaveBeenCalledTimes(1);
    });

    it('replays a create with the same clientRequestId without sending again', async () => {
      warnings.findByClientRequestId.mockResolvedValue(issuedWarning());

      const result = await service.create(issueInput, OFFICER, NOW);

      expect(result).toEqual({ warning: issuedWarning(), created: false });
      expect(warnings.create).not.toHaveBeenCalled();
      expect(disseminator.send).not.toHaveBeenCalled();
    });

    it('does not send when it lost a create race to an identical request', async () => {
      warnings.create.mockResolvedValue({
        warning: issuedWarning(),
        created: false,
      });

      await service.create(issueInput, OFFICER, NOW);

      expect(disseminator.send).not.toHaveBeenCalled();
    });
  });

  describe('drafts', () => {
    it('updates a draft', async () => {
      warnings.updateDraft.mockResolvedValue({
        outcome: 'UPDATED',
        warning: warningEntity(),
      });

      await expect(service.updateDraft(WARNING_ID, fields)).resolves.toEqual(
        warningEntity(),
      );
      expect(warnings.updateDraft).toHaveBeenCalledWith(
        WARNING_ID,
        expect.objectContaining({ validUntil: hoursFromNow(12) }),
      );
    });

    it('refuses to edit an issued warning, and 404s an unknown one', async () => {
      warnings.updateDraft.mockResolvedValueOnce({
        outcome: 'WRONG_STATE',
        warning: issuedWarning(),
      });
      await expect(service.updateDraft(WARNING_ID, fields)).rejects.toThrow(
        new ConflictException('Only a draft can be edited'),
      );

      warnings.updateDraft.mockResolvedValueOnce({ outcome: 'NOT_FOUND' });
      await expect(service.updateDraft(WARNING_ID, fields)).rejects.toThrow(
        NotFoundException,
      );
    });

    it.each([
      ['DELETED', undefined],
      ['NOT_DRAFT', ConflictException],
      ['NOT_FOUND', NotFoundException],
    ] as const)('maps delete outcome %s', async (outcome, error) => {
      warnings.deleteDraft.mockResolvedValue(outcome);
      const run = service.deleteDraft(WARNING_ID);
      if (error) await expect(run).rejects.toThrow(error);
      else await expect(run).resolves.toBeUndefined();
    });
  });

  describe('issue a draft', () => {
    beforeEach(() => {
      warnings.findById.mockResolvedValue(
        warningEntity({ validFrom: undefined }),
      );
      warnings.startDissemination.mockResolvedValue({
        outcome: 'UPDATED',
        warning: warningEntity({ status: 'DISSEMINATING' }),
      });
    });

    it('starts dissemination from DRAFT and sends', async () => {
      await service.issue(WARNING_ID, OFFICER, false, NOW);

      expect(warnings.startDissemination).toHaveBeenCalledWith(
        WARNING_ID,
        ['DRAFT'],
        {
          issuedBy: OFFICER,
          issuedAt: NOW,
          validFrom: NOW,
          channels: expect.any(Array),
        },
      );
      expect(disseminator.send).toHaveBeenCalled();
    });

    it('refuses a draft that is incomplete', async () => {
      warnings.findById.mockResolvedValue(
        warningEntity({ safetyInstructions: [] }),
      );
      await expect(
        service.issue(WARNING_ID, OFFICER, false, NOW),
      ).rejects.toThrow('add at least one safety instruction');
    });

    it('checks duplicates excluding itself', async () => {
      await service.issue(WARNING_ID, OFFICER, false, NOW);
      expect(warnings.findActiveOverlapping).toHaveBeenCalledWith(
        expect.objectContaining({ excludeId: WARNING_ID }),
      );
    });

    it('refuses something that is not a draft, and a second concurrent issue', async () => {
      warnings.findById.mockResolvedValueOnce(issuedWarning());
      await expect(
        service.issue(WARNING_ID, OFFICER, false, NOW),
      ).rejects.toThrow(new ConflictException('Only a draft can be issued'));

      warnings.startDissemination.mockResolvedValueOnce({
        outcome: 'WRONG_STATE',
        warning: issuedWarning(),
      });
      await expect(
        service.issue(WARNING_ID, OFFICER, false, NOW),
      ).rejects.toThrow(ConflictException);
      expect(disseminator.send).not.toHaveBeenCalled();
    });

    it('404s an unknown warning', async () => {
      warnings.findById.mockResolvedValue(null);
      await expect(
        service.issue(WARNING_ID, OFFICER, false, NOW),
      ).rejects.toThrow(new NotFoundException('Warning not found'));
    });
  });

  describe('retry', () => {
    const partial = issuedWarning({
      status: 'PARTIALLY_DISSEMINATED',
      channels: [
        channel('PUSH'),
        channel('SMS', { state: 'FAILED' }),
        channel('AUDIBLE'),
      ],
    });

    it('re-sends only the failed channels and merges the result', async () => {
      warnings.findById.mockResolvedValue(partial);
      warnings.startDissemination.mockResolvedValue({
        outcome: 'UPDATED',
        warning: { ...partial, status: 'DISSEMINATING' },
      });

      await service.retry(WARNING_ID, NOW);

      expect(warnings.startDissemination).toHaveBeenCalledWith(
        WARNING_ID,
        ['PARTIALLY_DISSEMINATED', 'PENDING_DISSEMINATION'],
        {},
      );
      expect(disseminator.send).toHaveBeenCalledWith(
        expect.any(Object),
        ['SMS'],
        NOW,
      );
      expect(warnings.recordDissemination).toHaveBeenCalledWith(
        WARNING_ID,
        [channel('PUSH'), channel('SMS'), channel('AUDIBLE')],
        'DISSEMINATED',
      );
    });

    it('refuses when nothing failed', async () => {
      warnings.findById.mockResolvedValue(issuedWarning());
      await expect(service.retry(WARNING_ID, NOW)).rejects.toThrow(
        new ConflictException('There is nothing to retry for this warning'),
      );
    });

    it('refuses when another officer already started a retry', async () => {
      warnings.findById.mockResolvedValue(partial);
      warnings.startDissemination.mockResolvedValue({
        outcome: 'WRONG_STATE',
        warning: partial,
      });
      await expect(service.retry(WARNING_ID, NOW)).rejects.toThrow(
        ConflictException,
      );
    });
    it('refuses to re-send a warning that has expired', async () => {
      warnings.findById.mockResolvedValue({
        ...partial,
        validUntil: hoursFromNow(-1),
      });
      await expect(service.retry(WARNING_ID, NOW)).rejects.toThrow(
        new ConflictException(
          'This warning has expired, so it cannot be sent again',
        ),
      );
      expect(warnings.startDissemination).not.toHaveBeenCalled();
    });

    it('recovers a warning stuck in DISSEMINATING after the send was interrupted', async () => {
      const stuck = issuedWarning({
        status: 'DISSEMINATING',
        channels: [
          channel('PUSH', { state: 'PENDING', attempts: 0 }),
          channel('SMS', { state: 'PENDING', attempts: 0 }),
          channel('AUDIBLE', { state: 'PENDING', attempts: 0 }),
        ],
        updatedAt: new Date(NOW.getTime() - 3 * 60_000),
      });
      warnings.findById.mockResolvedValue(stuck);
      warnings.startDissemination.mockResolvedValue({
        outcome: 'UPDATED',
        warning: stuck,
      });

      await service.retry(WARNING_ID, NOW);

      expect(warnings.startDissemination).toHaveBeenCalledWith(
        WARNING_ID,
        ['PARTIALLY_DISSEMINATED', 'PENDING_DISSEMINATION', 'DISSEMINATING'],
        {},
      );
      expect(disseminator.send).toHaveBeenCalledWith(
        expect.any(Object),
        ['PUSH', 'SMS', 'AUDIBLE'],
        NOW,
      );
    });

    it('does not interrupt a send that is still running', async () => {
      warnings.findById.mockResolvedValue(
        issuedWarning({
          status: 'DISSEMINATING',
          channels: [channel('PUSH', { state: 'PENDING' })],
          updatedAt: new Date(NOW.getTime() - 30_000),
        }),
      );
      await expect(service.retry(WARNING_ID, NOW)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('cancel', () => {
    beforeEach(() => {
      warnings.findById.mockResolvedValue(issuedWarning());
    });

    it('refuses to cancel a warning that has already expired', async () => {
      warnings.findById.mockResolvedValue(
        issuedWarning({ validUntil: hoursFromNow(-1) }),
      );
      await expect(
        service.cancel(WARNING_ID, OFFICER, 'Water receded', NOW),
      ).rejects.toThrow(
        new ConflictException(
          'This warning has already expired; there is nothing to cancel',
        ),
      );
      expect(warnings.cancel).not.toHaveBeenCalled();
    });

    it('cancels and announces the All Clear', async () => {
      const cancelled = issuedWarning({ status: 'CANCELLED' });
      warnings.cancel.mockResolvedValue({
        outcome: 'UPDATED',
        warning: cancelled,
      });

      await expect(
        service.cancel(WARNING_ID, OFFICER, 'Water receded', NOW),
      ).resolves.toBe(cancelled);
      expect(warnings.cancel).toHaveBeenCalledWith(WARNING_ID, {
        cancelledBy: OFFICER,
        reason: 'Water receded',
        cancelledAt: NOW,
      });
      expect(disseminator.announceAllClear).toHaveBeenCalledWith(cancelled);
    });

    it('cancel lost race returns 409 and sends no second All Clear', async () => {
      warnings.cancel.mockResolvedValue({
        outcome: 'WRONG_STATE',
        warning: issuedWarning({ status: 'CANCELLED' }),
      });

      await expect(
        service.cancel(WARNING_ID, OFFICER, 'Water receded', NOW),
      ).rejects.toThrow(
        new ConflictException(
          'This warning is not active, so it cannot be cancelled',
        ),
      );
      expect(disseminator.announceAllClear).not.toHaveBeenCalled();
    });
  });
});

import { ConflictException, Logger, NotFoundException } from '@nestjs/common';

import { DisasterAnalysisService } from './disaster-analysis.service.js';
import { InMemoryAnalysisDataRepository } from './testing/in-memory-analysis-data.repository.js';
import { ReportGenerationError } from './report-generation.error.js';

const repository = new InMemoryAnalysisDataRepository();
const service = new DisasterAnalysisService(repository);

async function idOf(search: string) {
  const { items } = await repository.findCompletedEvents({
    search,
    page: 1,
    limit: 5,
  });
  return items[0]!.id;
}

describe('DisasterAnalysisService', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it('lists with default paging when none is given', async () => {
    const result = await service.listCompletedEvents({});
    expect(result).toMatchObject({ total: 6, page: 1, limit: 10 });
    expect(result.items).toHaveLength(6);
  });

  it('turns an unexpected error while gathering data into the single failure', async () => {
    const failing = new InMemoryAnalysisDataRepository();
    const id = await idOfIn(failing, 'kelani');
    vi.spyOn(failing, 'findShelterOccupancyByEvent').mockRejectedValue(
      new Error('connection reset'),
    );
    await expect(
      new DisasterAnalysisService(failing).generateDisasterReport(id),
    ).rejects.toBeInstanceOf(ReportGenerationError);
  });

  it('turns a non-Error failure into the single failure as well', async () => {
    const failing = new InMemoryAnalysisDataRepository();
    const id = await idOfIn(failing, 'kelani');
    vi.spyOn(failing, 'findWarningsByEvent').mockRejectedValue('boom');
    await expect(
      new DisasterAnalysisService(failing).generateDisasterReport(id),
    ).rejects.toBeInstanceOf(ReportGenerationError);
  });

  it('does not hide the request errors behind the generic failure', async () => {
    await expect(
      service.generateDisasterReport('000000000000000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
    const active = (await repository.findEventById(await idOf('kelani')))!;
    vi.spyOn(repository, 'findEventById').mockResolvedValueOnce({
      ...active,
      status: 'ACTIVE',
    });
    await expect(
      service.generateDisasterReport(active.id),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

async function idOfIn(repo: InMemoryAnalysisDataRepository, search: string) {
  const { items } = await repo.findCompletedEvents({
    search,
    page: 1,
    limit: 5,
  });
  return items[0]!.id;
}

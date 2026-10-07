/**
 * Writes the sample dataset to the database: `bun run seed:analysis`
 * (add `--test` to target DATABASE_URL_TEST). Safe to run again: it removes the
 * demo data it wrote before. It refuses databases without "dev" or "test" in the name.
 */
import { PrismaClient } from '@prisma/client';

import { buildFakeDataset } from '../fake-data/build-fake-dataset.js';
import { assertSafeDatabase } from './seed-guard.js';

const useTest = process.argv.includes('--test');
const url = useTest ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
const databaseName = assertSafeDatabase(url);

const prisma = new PrismaClient({ datasourceUrl: url });

async function main(): Promise<void> {
  const data = buildFakeDataset();

  const earlier = await prisma.disasterEvent.findMany({
    where: { isDemoData: true },
    select: { id: true },
  });
  const eventIds = earlier.map((e) => e.id);
  const byEvent = { where: { eventId: { in: eventIds } } };

  await prisma.eventWarning.deleteMany(byEvent);
  await prisma.shelter.deleteMany(byEvent);
  await prisma.shelterOccupancyRecord.deleteMany(byEvent);
  await prisma.resourceDistribution.deleteMany(byEvent);
  await prisma.disasterEvent.deleteMany({ where: { id: { in: eventIds } } });
  await prisma.resource.deleteMany({
    where: { id: { in: data.resources.map((r) => r.id) } },
  });
  await prisma.organisation.deleteMany({
    where: { id: { in: data.organisations.map((o) => o.id) } },
  });

  await prisma.resource.createMany({ data: data.resources });
  await prisma.organisation.createMany({ data: data.organisations });
  await prisma.disasterEvent.createMany({ data: data.events });
  await prisma.eventWarning.createMany({ data: data.warnings });
  await prisma.shelter.createMany({ data: data.shelters });
  await prisma.shelterOccupancyRecord.createMany({
    data: data.occupancyRecords,
  });
  await prisma.resourceDistribution.createMany({ data: data.distributions });

  console.log(
    `Seeded "${databaseName}": ${data.events.length} events, ${data.warnings.length} warnings, ` +
      `${data.shelters.length} shelters, ${data.occupancyRecords.length} occupancy records, ` +
      `${data.distributions.length} resource distributions.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

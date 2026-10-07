import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Rescue Teams and Active Disaster Events...');

  // 1. Ensure Active Flood Disaster Event exists
  const existingEvent = await prisma.disasterEvent.findFirst({
    where: { eventId: 'EV-2026-FLOOD-01' },
  });

  if (!existingEvent) {
    await prisma.disasterEvent.create({
      data: {
        eventId: 'EV-2026-FLOOD-01',
        name: 'Flood Warning',
        hazardType: 'FLOOD',
        districtCodes: ['LK-12', 'LK-11', 'LK-13'], // Gampaha, Colombo, Kalutara
        startedAt: new Date(Date.now() - 3600 * 1000 * 4),
        status: 'ACTIVE',
        isDemoData: true,
      },
    });
    console.log('Created Active Event: Flood Warning (EV-2026-FLOOD-01)');
  }

  // 2. Ensure Rescue Teams exist
  const teamsData = [
    {
      teamCode: 'TEAM-A',
      name: 'Team A',
      organization: 'DMC',
      districtCode: 'Gampaha',
      status: 'AVAILABLE' as const,
      allowsCrossDistrict: false,
      contactNumber: '+94 77 123 4567',
      leaderName: 'Capt. Nimal Perera',
    },
    {
      teamCode: 'TEAM-B',
      name: 'Team B',
      organization: 'Armed Forces',
      districtCode: 'Gampaha',
      status: 'ASSIGNED' as const,
      allowsCrossDistrict: false,
      contactNumber: '+94 71 987 6543',
      leaderName: 'Lt. Sunil Fernando',
    },
    {
      teamCode: 'TEAM-C',
      name: 'Team C',
      organization: 'NGO',
      districtCode: 'Colombo',
      status: 'AVAILABLE' as const,
      allowsCrossDistrict: true,
      contactNumber: '+94 76 555 1212',
      leaderName: 'Sarah De Silva',
    },
    {
      teamCode: 'TEAM-D',
      name: 'Team D',
      organization: 'Police Special Task Force',
      districtCode: 'Kalutara',
      status: 'AVAILABLE' as const,
      allowsCrossDistrict: true,
      contactNumber: '+94 70 333 4444',
      leaderName: 'Insp. Kamal Jayawardena',
    },
  ];

  for (const team of teamsData) {
    const existing = await prisma.rescueTeam.findUnique({
      where: { teamCode: team.teamCode },
    });
    if (!existing) {
      await prisma.rescueTeam.create({ data: team });
      console.log(
        `Created team: ${team.name} (${team.organization} - ${team.districtCode})`,
      );
    }
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

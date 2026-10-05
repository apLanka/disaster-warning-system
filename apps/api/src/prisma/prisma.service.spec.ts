import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  it('connects when the module initialises', async () => {
    const service = new PrismaService();
    const connect = vi.spyOn(service, '$connect').mockResolvedValue();

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledOnce();
  });

  it('disconnects when the module is destroyed', async () => {
    const service = new PrismaService();
    const disconnect = vi.spyOn(service, '$disconnect').mockResolvedValue();

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('does not swallow a failed connection', async () => {
    const service = new PrismaService();
    vi.spyOn(service, '$connect').mockRejectedValue(
      new Error('atlas unreachable'),
    );

    await expect(service.onModuleInit()).rejects.toThrow('atlas unreachable');
  });
});

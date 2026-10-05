import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { HttpExceptionFilter } from './http-exception.filter.js';

function createHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shapes an HttpException as { statusCode, error, message }', () => {
    const { host, status, json } = createHost();

    filter.catch(new ConflictException('Already reviewed'), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      error: 'Conflict',
      message: 'Already reviewed',
    });
  });

  it('joins validation messages into one string', () => {
    const { host, json } = createHost();

    filter.catch(
      new BadRequestException([
        'type must be valid',
        'description is too short',
      ]),
      host,
    );

    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'Bad Request',
      message: 'type must be valid; description is too short',
    });
  });

  it('uses the default message of a bare exception', () => {
    const { host, json } = createHost();

    filter.catch(new NotFoundException(), host);

    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      error: 'Not Found',
      message: 'Not Found',
    });
  });

  it('hides the details of an unknown error and logs it', () => {
    const { host, status, json } = createHost();
    const log = vi.spyOn(Logger.prototype, 'error');

    filter.catch(
      new Error('connection string leaked: mongodb+srv://secret'),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
    expect(log).toHaveBeenCalledOnce();
  });

  it('copes with a thrown non-error value', () => {
    const { host, json } = createHost();

    filter.catch('boom', host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    );
  });
});

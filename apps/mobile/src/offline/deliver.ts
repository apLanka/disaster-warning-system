import { ApiError, describeError, NetworkError } from '../api/client';
import { submitHazardReport } from '../api/hazardReports';
import type { Deliver, QueuedReport } from './reportQueue';

/** Statuses that mean "not now" rather than "never". */
const TRANSIENT_CLIENT_ERRORS = new Set([408, 429]);

/**
 * Sends one queued report and says what to do next. The same clientRequestId
 * is used every time, so a retry after a lost response is harmless: the
 * server answers with the report it already stored.
 */
export const deliverQueuedReport: Deliver = async (report: QueuedReport) => {
  try {
    const { report: stored } = await submitHazardReport({
      clientRequestId: report.id,
      type: report.type,
      description: report.description,
      location: report.location,
      photos: report.photos,
    });
    return { kind: 'delivered', report: stored };
  } catch (error) {
    if (error instanceof NetworkError) return { kind: 'retry' };
    if (error instanceof ApiError) {
      const permanent =
        error.status >= 400 &&
        error.status < 500 &&
        !TRANSIENT_CLIENT_ERRORS.has(error.status);
      return permanent
        ? { kind: 'rejected', message: describeError(error) }
        : { kind: 'retry' };
    }
    return { kind: 'retry' };
  }
};

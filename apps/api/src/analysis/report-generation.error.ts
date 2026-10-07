import { ServiceUnavailableException } from '@nestjs/common';

export const REPORT_FAILED_MESSAGE =
  'Report generation failed. Please try again.';

/** The one failure the officer sees, whatever went wrong: never a partial report. */
export class ReportGenerationError extends ServiceUnavailableException {
  constructor() {
    super(REPORT_FAILED_MESSAGE);
  }
}

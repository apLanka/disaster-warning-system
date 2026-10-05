import type { HazardReportEntity } from '../hazard-reports/domain/hazard-report.entity.js';

export const DECISION_NOTIFIER = Symbol('DECISION_NOTIFIER');

/** Tells the reporter the outcome of their report. The report is already decided when this runs. */
export interface DecisionNotifier {
  notifyDecision(report: HazardReportEntity): Promise<void>;
}

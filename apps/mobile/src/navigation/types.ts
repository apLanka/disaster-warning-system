import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type SubmittedStatus = 'PENDING_VERIFICATION' | 'PENDING_SYNC';

export type RootStackParamList = {
  Home: undefined;
  ReportHazard: undefined;
  ReviewReport: undefined;
  ReportSubmitted: { status: SubmittedStatus; reference?: string };
  MyReports: undefined;
  ReportDetail: { id: string };
  /** The outcome of a decided report: verified, or rejected with the reason. */
  ReportResult: { id: string };
};

export type ScreenProps<Name extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, Name>;

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type SubmittedStatus = 'PENDING_VERIFICATION' | 'PENDING_SYNC';

export type RootStackParamList = {
  Home: undefined;
  ReportHazard: undefined;
  ReviewReport: undefined;
  ReportSubmitted: { status: SubmittedStatus; reference?: string };
};

export type ScreenProps<Name extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, Name>;

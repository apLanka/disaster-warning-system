import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type SubmittedStatus = 'PENDING_VERIFICATION' | 'PENDING_SYNC';

/** The bottom tab bar from the wireframe: Home, Reports, Alerts, Profile. */
export type TabParamList = {
  Home: undefined;
  /** Where a citizen follows their own reports (change C5). */
  Reports: undefined;
  Alerts: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined;
  ReportHazard: undefined;
  ReviewReport: undefined;
  ReportSubmitted: { status: SubmittedStatus; reference?: string };
  ReportDetail: { id: string };
  /** The outcome of a decided report: verified, or rejected with the reason. */
  ReportResult: { id: string };
  /** One warning: details, safety instructions, acknowledge (wireframe screen 5). */
  HazardAlert: { id: string };
  /** After acknowledging: emergency contacts and what to do (wireframe screen 6). */
  SafetyInfo: { id: string };
};

export type ScreenProps<Name extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, Name>;

/** A screen inside the tab bar, which can also open the stack screens above it. */
export type TabScreenProps<Name extends keyof TabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<TabParamList, Name>,
    NativeStackScreenProps<RootStackParamList>
  >;

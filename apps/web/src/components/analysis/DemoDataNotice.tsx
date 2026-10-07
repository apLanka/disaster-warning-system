import { Banner } from '../ui/Banner';

/** Generated data is always labelled, so nobody mistakes it for a real disaster. */
export function DemoDataNotice() {
  return (
    <Banner tone="warning">
      Sample data for demonstration. These events and figures are generated, not
      real.
    </Banner>
  );
}

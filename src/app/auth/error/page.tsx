import Link from 'next/link';
import { InterfaceIcon, Shell } from '@/components/AppShell';

export default function AuthenticationError() {
  return (
    <Shell>
      <section className="error-panel" aria-labelledby="verification-heading">
        <span className="error-symbol"><InterfaceIcon icon="lucide:shield-alert" large /></span>
        <h2 id="verification-heading">Account verification did not finish</h2>
        <p>The link may have expired, or your save could not be initialized. Return to the dashboard and retry.</p>
        <Link className="return-link" href="/">Return to Meat Tycoon<InterfaceIcon icon="lucide:arrow-right" /></Link>
      </section>
    </Shell>
  );
}

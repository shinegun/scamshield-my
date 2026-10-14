import { Link } from 'react-router-dom';

export function DashboardPage() {
  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px' }}>
      <h1 style={{ margin: '0 0 8px' }}>Fraud dashboard — coming in #15</h1>
      <p style={{ margin: '0 0 24px', color: '#4b5568' }}>
        This will show live sessions, risk history and held transfers.
      </p>
      <Link to="/">← Back to the phone</Link>
    </main>
  );
}

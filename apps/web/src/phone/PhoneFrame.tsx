import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './phone.css';

// The phone: a status bar, then whatever screen is current. Centred on a
// neutral page on desktop; fills the viewport on narrow screens.
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="stage">
      <div className="phone">
        <StatusBar />
        <div className="phone__screen">{children}</div>
      </div>
      <Link className="stage__link" to="/dashboard">
        Fraud dashboard
      </Link>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="statusbar" aria-hidden="true">
      <span className="statusbar__time">9:41</span>
      <span className="statusbar__notch" />
      <span className="statusbar__icons">5G ▂▄▆█</span>
    </div>
  );
}

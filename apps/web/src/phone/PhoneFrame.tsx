import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './phone.css';

// The phone: a plain frame around whatever screen is current. Centred on a
// neutral page on desktop; fills the viewport on narrow screens.
export function PhoneFrame({ children, link = true }: { children: ReactNode; link?: boolean }) {
  return (
    <div className="stage">
      <div className="phone">
        <div className="phone__screen">{children}</div>
      </div>
      {link && (
        <Link className="stage__link" to="/dashboard">
          Fraud dashboard
        </Link>
      )}
    </div>
  );
}

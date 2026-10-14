import './bank.css';

// Bottom action bar of the call screen (#11). For now a disabled "Open bank
// app" button; #11 wires it to the bank screen and the transfer flow.
export function BankActionBar() {
  return (
    <div className="bank-bar">
      <button type="button" className="bank-bar__open" disabled title="Coming in #11">
        Open bank app
      </button>
    </div>
  );
}

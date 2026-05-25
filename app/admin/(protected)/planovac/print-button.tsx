'use client';

export default function PrintButton() {
  return (
    <button className="admin-primary-link" type="button" onClick={() => window.print()}>
      🖨 Tlačiť zoznam
    </button>
  );
}

'use client';

export default function PrintButton({ label = 'Tlačiť zoznam' }: { label?: string }) {
  return (
    <button className="admin-primary-link" type="button" onClick={() => window.print()}>
      🖨 {label}
    </button>
  );
}

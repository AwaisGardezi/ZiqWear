import { ReactNode } from 'react';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="heading-1">{title}</h1>
        {subtitle && <p className="text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-gold-600 border-t-transparent" />
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return <div className="p-4 bg-sale/10 border border-sale text-[#8f2b24] text-sm">{message}</div>;
}

export function Notice({ message }: { message: string }) {
  if (!message) return null;
  return <div className="p-4 bg-ok/10 border border-ok text-[#2f5f39] text-sm">{message}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function EmptyState({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-8 text-muted">
        {children}
      </td>
    </tr>
  );
}

export function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "short", day: "numeric" }).format(d);
}

export function formatMonth(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "long" }).format(d);
}

export const ticketStatusLabel: Record<string, string> = {
  new: "Nytt",
  in_progress: "Pågår",
  awaiting_tenant: "Väntar hyresgäst",
  done: "Klart",
};

export const ticketCategoryLabel: Record<string, string> = {
  damage: "Skada",
  maintenance: "Underhåll",
  report: "Felanmälan",
  other: "Övrigt",
};

export const ticketPriorityLabel: Record<string, string> = {
  low: "Låg",
  normal: "Normal",
  high: "Hög",
  urgent: "Akut",
};

export const rentStatusLabel: Record<string, string> = {
  paid: "Betald",
  unpaid: "Obetald",
  overdue: "Försenad",
};
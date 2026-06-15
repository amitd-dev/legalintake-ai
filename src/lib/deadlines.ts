// Shared deadline helpers: alert-level computation from a due date.
export type AlertLevel = "normal" | "upcoming" | "urgent" | "overdue";

export function daysUntil(due: string | Date): number {
  const d = new Date(due);
  const today = new Date();
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function alertLevelFor(due: string | Date): AlertLevel {
  const n = daysUntil(due);
  if (n < 0) return "overdue";
  if (n <= 14) return "urgent";
  if (n <= 45) return "upcoming";
  return "normal";
}

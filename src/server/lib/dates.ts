import { RecurrenceRule } from "@prisma/client";

/**
 * Convert Date -> YYYY-MM-DD
 */
export function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Convert Date -> YYYY-MM-DDTHH:mm (for inputs/UI)
 */
export function formatDateTime(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 16) : null;
}

/**
 * Convert YYYY-MM-DD -> Date (safe midday to avoid timezone shift)
 */
export function toDateOnly(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

/**
 * Convert string -> Date (nullable safe)
 */
export function toDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(value);
}

/**
 * Get start/end bounds for a given day (UTC-safe)
 */
export function getDayBounds(target: Date) {
  const day = formatDate(target);
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(`${day}T23:59:59.999Z`);
  return { start, end };
}

/**
 * Add N days to a date (immutable)
 */
export function addDays(target: Date, days: number): Date {
  const copy = new Date(target);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/**
 * Determine if a recurring task should occur on a given date
 */
export function recursOnDate(
  task: { dueDate: Date; recurrenceRule: RecurrenceRule | null },
  target: Date,
): boolean {
  if (!task.recurrenceRule) return false;

  const anchor = task.dueDate;

  // Do not allow recurrence before original due date
  if (getDayBounds(target).start < getDayBounds(anchor).start) {
    return false;
  }

  switch (task.recurrenceRule) {
    case RecurrenceRule.DAILY:
      return true;

    case RecurrenceRule.WEEKDAYS:
      return ![0, 6].includes(target.getUTCDay()); // skip Sat/Sun

    case RecurrenceRule.WEEKLY:
      return target.getUTCDay() === anchor.getUTCDay();

    case RecurrenceRule.MONTHLY:
      return target.getUTCDate() === anchor.getUTCDate();

    default:
      return false;
  }
}
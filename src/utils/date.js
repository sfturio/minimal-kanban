import { normalizeSpaces } from "./helpers.js";

export function isValidDateParts(day, month, year) {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return false;
  }
  if (year < 1900 || year > 2100) {
    return false;
  }
  if (month < 1 || month > 12) {
    return false;
  }
  if (day < 1 || day > 31) {
    return false;
  }

  const dt = new Date(year, month - 1, day);
  return (
    dt.getFullYear() === year &&
    dt.getMonth() === month - 1 &&
    dt.getDate() === day
  );
}

export function formatDateParts(day, month, year) {
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const yyyy = String(year).padStart(4, "0");
  return `${dd}-${mm}-${yyyy}`;
}

export function normalizeDeadline(value) {
  const raw = normalizeSpaces(value);
  if (!raw) {
    return null;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (isValidDateParts(day, month, year)) {
      return formatDateParts(day, month, year);
    }
    return null;
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) {
    const day = Number(digits.slice(0, 2));
    const month = Number(digits.slice(2, 4));
    const year = Number(digits.slice(4, 8));
    if (isValidDateParts(day, month, year)) {
      return formatDateParts(day, month, year);
    }
    return null;
  }

  const text = raw.replace(/[\.\/]/g, "-");
  const match = text.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) {
    year += 2000;
  }

  if (!isValidDateParts(day, month, year)) {
    return null;
  }

  return formatDateParts(day, month, year);
}

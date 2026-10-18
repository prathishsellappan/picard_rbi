// All times in the app are shown in Indian Standard Time (UTC+5:30), e.g. "18 Oct 2026, 11:45:44 IST".
// Stored and indexed times stay in UTC; this only formats them for display.
const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatIST(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    IST.formatToParts(date).find((p) => p.type === type)?.value ?? "";
  return `${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")}:${part("second")} IST`;
}

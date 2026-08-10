export const GENDERS = ["Male", "Female", "Other"] as const;
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"] as const;
export const EMPLOYEE_TYPES = ["Full Time", "Part Time", "Contract", "Internship", "Probation"] as const;
export const SHIFT_TIMINGS = [
  "Morning (09:00 - 18:00)",
  "Evening (14:00 - 23:00)",
  "Night (22:00 - 07:00)",
  "Night (21:00 - 06:00)",
  "Flexible",
] as const;
export const AGENT_STATUSES = ["active", "inactive", "suspended", "resigned"] as const;
export const ATTENDANCE_STATUSES = ["present", "absent", "late", "half_day", "leave", "holiday", "weekly_off"] as const;

// ── Attendance Request Types ──────────────────────────────────────────────────
export const ATTENDANCE_REQUEST_TYPES = [
  { value: "leave", label: "Leave" },
  { value: "sick_leave", label: "Sick Leave" },
  { value: "fever_illness", label: "Fever / Illness" },
  { value: "emergency_leave", label: "Emergency Leave" },
  { value: "late_arrival", label: "Late Arrival" },
  { value: "early_departure", label: "Early Departure" },
  { value: "missing_check_in", label: "Missing Check-In" },
  { value: "missing_check_out", label: "Missing Check-Out" },
  { value: "attendance_adjustment", label: "Attendance Adjustment" },
  { value: "wrong_attendance", label: "Wrong Attendance" },
  { value: "day_off", label: "Day Off" },
  { value: "other", label: "Other" },
] as const;

export const ATTENDANCE_REQUEST_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;

/** Human-readable label for a request type value. */
export const requestTypeLabel = (v: string): string =>
  ATTENDANCE_REQUEST_TYPES.find((t) => t.value === v)?.label ?? labelize(v);

/** Request types that involve adjustment to the attendance record. */
export const ADJUSTMENT_REQUEST_TYPES = new Set([
  "missing_check_in",
  "missing_check_out",
  "attendance_adjustment",
  "wrong_attendance",
  "late_arrival",
  "early_departure",
]);

/** Request types that are leave-like (update attendance status on approval). */
export const LEAVE_REQUEST_TYPES = new Set([
  "leave",
  "sick_leave",
  "fever_illness",
  "emergency_leave",
  "day_off",
]);
export const PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Gilgit-Baltistan",
  "Azad Jammu & Kashmir",
  "Islamabad Capital Territory",
] as const;

export const DOCUMENT_CATEGORIES = [
  { value: "profile_picture", label: "Profile Picture" },
  { value: "cnic_front", label: "CNIC Front" },
  { value: "cnic_back", label: "CNIC Back" },
  { value: "passport", label: "Passport" },
  { value: "certificate", label: "Certificate" },
  { value: "resume", label: "Resume" },
  { value: "other", label: "Other Document" },
] as const;

export type AgentStatus = (typeof AGENT_STATUSES)[number];
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const labelize = (value?: string | null) =>
  (value ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const formatPKR = (value?: number | null) =>
  value == null ? "—" : `₨ ${Number(value).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;

export const formatTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true })
    : "—";

export const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "2-digit" }) : "—";

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const initials = (name?: string | null) =>
  (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export const hoursLabel = (h?: number | null) => {
  if (h == null) return "—";
  const n = Number(h);
  // Safety net: never show a negative value. If a legacy record slipped
  // through with negative hours, fall back to absolute value so the UI
  // doesn't display "-15.00 h".
  const safe = n < 0 ? Math.abs(n) : n;
  return `${safe.toFixed(2)} h`;
};

/** Returns true if the given date string (YYYY-MM-DD) is a Sunday. */
export const isSunday = (dateStr: string): boolean => {
  const d = new Date(dateStr + "T00:00:00");
  return d.getDay() === 0;
};

/** Returns true if the attendance record is a system-generated Sunday weekly off. */
export const isWeeklyOff = (record: { status?: string | null; system_generated?: boolean | null }): boolean => {
  return record.status === "weekly_off" || (Boolean(record.system_generated) && record.status === "weekly_off");
};
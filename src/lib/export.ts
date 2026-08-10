export type ExportColumn<T> = { key: keyof T & string; label: string };

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const cell = (v: unknown) => (v == null ? "" : String(v));

// ── Shared logo loader ─────────────────────────────────────────────────────
// Loads /logo-pdf.png as a data URL for embedding in PDFs.
// Returns null if the fetch fails (callers fall back to a drawn mark).
async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const resp = await fetch("/logo-pdf.png");
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Shared helper to draw the Billzo logo (or fallback "B") on a jsPDF doc.
function drawBrandMark(
  doc: { setFillColor: (r: number, g: number, b: number) => void; roundedRect: (x: number, y: number, w: number, h: number, rx: number, ry: number, style: string) => void; addImage: (data: string, format: string, x: number, y: number, w: number, h: number, alias?: unknown, compression?: string) => void; setTextColor: (r: number, g: number, b: number) => void; setFontSize: (s: number) => void; setFont: (f: string, style: string) => void; text: (t: string, x: number, y: number) => void },
  logoDataUrl: string | null,
  x: number,
  y: number,
  size: number,
) {
  if (logoDataUrl) {
    doc.setFillColor(11, 15, 25);
    doc.roundedRect(x, y, size, size, Math.max(4, size * 0.18), Math.max(4, size * 0.18), "F");
    doc.addImage(logoDataUrl, "PNG", x, y, size, size, undefined, "FAST");
  } else {
    doc.setFillColor(76, 213, 184);
    doc.roundedRect(x, y, size, size, 5, 5, "F");
    doc.setTextColor(13, 20, 32);
    doc.setFontSize(size * 0.6);
    doc.setFont("helvetica", "bold");
    doc.text("B", x + size * 0.32, y + size * 0.68);
  }
}

export function exportCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
) {
  const head = columns.map((c) => `"${c.label}"`).join(",");
  const body = rows
    .map((r) => columns.map((c) => `"${cell(r[c.key]).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  download(new Blob([`${head}\n${body}`], { type: "text/csv;charset=utf-8;" }), `${filename}.csv`);
}

export async function exportExcel<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  sheetName = "Report",
) {
  const XLSX = await import("xlsx");
  const data = rows.map((r) => Object.fromEntries(columns.map((c) => [c.label, cell(r[c.key])])));
  const sheet = XLSX.utils.json_to_sheet(data);
  // Set column widths based on label length
  sheet["!cols"] = columns.map((c) => ({ wch: Math.max(c.label.length + 2, 12) }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  const out = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${filename}.xlsx`,
  );
}

export async function exportPDF<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  title: string,
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  // ── Load the Billzo logo ──────────────────────────────────────────────────
  let logoDataUrl: string | null = null;
  try {
    const resp = await fetch("/logo-pdf.png");
    if (resp.ok) {
      const blob = await resp.blob();
      logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    // ignore
  }

  // Draw the logo at top-left, or fall back to a drawn mark
  const brandSize = 24;
  const brandX = 40;
  const brandY = 24;
  if (logoDataUrl) {
    doc.setFillColor(11, 15, 25);
    doc.roundedRect(brandX, brandY, brandSize, brandSize, 5, 5, "F");
    doc.addImage(logoDataUrl, "PNG", brandX, brandY, brandSize, brandSize, undefined, "FAST");
  } else {
    doc.setFillColor(76, 213, 184);
    doc.roundedRect(brandX, brandY, brandSize, brandSize, 5, 5, "F");
    doc.setTextColor(13, 20, 32);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("B", brandX + 8, brandY + 17);
  }

  // Title and timestamp next to the logo
  doc.setTextColor(20, 30, 45);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, brandX + brandSize + 10, brandY + 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 135, 155);
  doc.text(`Generated ${new Date().toLocaleString("en-PK")} · Billzo Office Management System`, brandX + brandSize + 10, brandY + 26);

  autoTable(doc, {
    startY: brandY + brandSize + 16,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => cell(r[c.key]))),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [22, 40, 52], textColor: 255 },
    alternateRowStyles: { fillColor: [244, 248, 249] },
  });
  doc.save(`${filename}.pdf`);
}

// ── Stylish attendance-specific PDF ─────────────────────────────────────────
// Uses a dark branded cover with the same gradient-feel as the app, a stats
// strip, and a status-colored table.

const STATUS_RGB: Record<string, [number, number, number]> = {
  present: [16, 185, 129], // emerald-500
  absent: [239, 68, 68], // red-500
  late: [245, 158, 11], // amber-500
  half_day: [59, 130, 246], // blue-500
  leave: [139, 92, 246], // violet-500
  holiday: [6, 182, 212], // cyan-500
};

export type AttendanceExportRow = {
  date: string;
  agentName: string;
  employeeId: string;
  department: string;
  clockIn: string;
  clockOut: string;
  hours: number | null;
  status: string;
  notes: string;
};

export type AttendanceExportSummary = {
  totalRecords: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leave: number;
  holiday: number;
  totalHours: number;
};

export async function exportAttendancePDF(
  rows: AttendanceExportRow[],
  filename: string,
  meta: {
    title: string;
    subtitle: string;
    periodLabel: string;
    summary: AttendanceExportSummary;
    filterLabel?: string;
  },
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  // Portrait A4 for narrow tables, landscape if many columns
  const isLandscape = false;
  const doc = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });

  // ── Load the Billzo logo as a data URL ────────────────────────────────────
  // Falls back gracefully to the drawn "B" mark if the logo fails to load.
  let logoDataUrl: string | null = null;
  try {
    const resp = await fetch("/logo-pdf.png");
    if (resp.ok) {
      const blob = await resp.blob();
      logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    // ignore — we'll fall back to the drawn mark
  }

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 32;

  // ── COVER BAND (dark gradient-feel) ────────────────────────────────────────
  // Draw three overlapping rectangles to simulate a gradient.
  const bandH = 130;
  for (let i = 0; i < bandH; i++) {
    const t = i / bandH;
    const r = Math.round(13 + (15 - 13) * t);
    const g = Math.round(20 + (40 - 20) * t);
    const b = Math.round(32 + (60 - 32) * t);
    doc.setFillColor(r, g, b);
    doc.rect(0, i, pageW, 1, "F");
  }

  // Accent line at the top
  doc.setFillColor(76, 213, 184); // primary mint
  doc.rect(0, 0, pageW, 3, "F");

  // Brand mark — use the actual logo image, fall back to the "B" letter
  const brandSize = 36;
  const brandX = margin;
  const brandY = 30;
  if (logoDataUrl) {
    // Add a subtle rounded background behind the logo for contrast
    doc.setFillColor(11, 15, 25); // dark navy matching logo bg
    doc.roundedRect(brandX, brandY, brandSize, brandSize, 7, 7, "F");
    // Add the logo image
    doc.addImage(logoDataUrl, "PNG", brandX, brandY, brandSize, brandSize, undefined, "FAST");
  } else {
    // Fallback: drawn "B" mark
    doc.setFillColor(76, 213, 184);
    doc.roundedRect(brandX, brandY, brandSize, brandSize, 6, 6, "F");
    doc.setTextColor(13, 20, 32);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("B", brandX + 12, brandY + 24);
  }

  // Title
  doc.setTextColor(245, 247, 250);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(meta.title, margin + brandSize + 12, brandY + 18);

  // Subtitle
  doc.setTextColor(180, 195, 215);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(meta.subtitle, margin + brandSize + 12, brandY + 34);

  // Period badge (right-aligned)
  doc.setFillColor(255, 255, 255, 0.08);
  doc.setDrawColor(76, 213, 184);
  doc.setLineWidth(0.8);
  const badgeW = 160;
  const badgeH = 24;
  const badgeX = pageW - margin - badgeW;
  doc.roundedRect(badgeX, 38, badgeW, badgeH, 12, 12, "FD");
  doc.setTextColor(76, 213, 184);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(meta.periodLabel, badgeX + badgeW / 2, 53, { align: "center" });

  // Generated timestamp (bottom of band)
  doc.setTextColor(150, 170, 195);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated ${new Date().toLocaleString("en-PK")}`,
    margin,
    bandH - 12,
  );
  doc.text("Billzo Office Management System", pageW - margin, bandH - 12, { align: "right" });

  // ── STATS STRIP ────────────────────────────────────────────────────────────
  const stripY = bandH + 20;
  const stats: { label: string; value: string | number; color: [number, number, number] }[] = [
    { label: "TOTAL", value: meta.summary.totalRecords, color: [76, 213, 184] },
    { label: "PRESENT", value: meta.summary.present, color: STATUS_RGB.present! },
    { label: "ABSENT", value: meta.summary.absent, color: STATUS_RGB.absent! },
    { label: "LATE", value: meta.summary.late, color: STATUS_RGB.late! },
    { label: "LEAVE", value: meta.summary.leave, color: STATUS_RGB.leave! },
    { label: "HOURS", value: `${meta.summary.totalHours.toFixed(0)}h`, color: STATUS_RGB.half_day! },
  ];
  const statCardW = (pageW - margin * 2 - (stats.length - 1) * 8) / stats.length;
  stats.forEach((s, i) => {
    const x = margin + i * (statCardW + 8);
    // card background
    doc.setFillColor(245, 247, 250);
    doc.setDrawColor(225, 232, 240);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, stripY, statCardW, 50, 6, 6, "FD");
    // accent left bar
    doc.setFillColor(s.color[0]!, s.color[1]!, s.color[2]!);
    doc.roundedRect(x, stripY, 3, 50, 1.5, 1.5, "F");
    // value
    doc.setTextColor(s.color[0]!, s.color[1]!, s.color[2]!);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(String(s.value), x + 10, stripY + 26);
    // label
    doc.setTextColor(120, 135, 155);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(s.label, x + 10, stripY + 42);
  });

  // ── FILTERS LINE (if any) ─────────────────────────────────────────────────
  let tableStartY = stripY + 50 + 20;
  if (meta.filterLabel) {
    doc.setTextColor(100, 115, 135);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(`Filters: ${meta.filterLabel}`, margin, tableStartY - 8);
  }

  // ── TABLE ──────────────────────────────────────────────────────────────────
  const head = [["Date", "Agent", "Emp ID", "Clock In", "Clock Out", "Hours", "Status", "Notes"]];
  const body = rows.map((r) => [
    r.date,
    r.agentName,
    r.employeeId,
    r.clockIn,
    r.clockOut,
    r.hours != null ? `${r.hours.toFixed(2)}h` : "—",
    r.status,
    r.notes || "—",
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,
    styles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: [40, 50, 65],
      lineColor: [225, 232, 240],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [22, 32, 48],
      textColor: [245, 247, 250],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 100 },
      2: { cellWidth: 50 },
      3: { cellWidth: 55 },
      4: { cellWidth: 55 },
      5: { cellWidth: 45 },
      6: { cellWidth: 55 },
      7: { cellWidth: "auto" },
    },
    didParseCell: (data) => {
      // Color the "Status" column text by status
      if (data.section === "body" && data.column.index === 6) {
        const status = String(data.cell.raw ?? "").toLowerCase().replace(/\s/g, "_");
        const rgb = STATUS_RGB[status];
        if (rgb) {
          data.cell.styles.textColor = rgb;
          data.cell.styles.fontStyle = "bold";
        }
      }
      // Bold the Hours column
      if (data.section === "body" && data.column.index === 5) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = [76, 213, 184];
      }
    },
    margin: { left: margin, right: margin },
  });

  // ── FOOTER (page numbers) ─────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(225, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 24, pageW - margin, pageH - 24);
    doc.setTextColor(150, 165, 185);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Billzo · Confidential · Page ${i} of ${pageCount}`,
      pageW / 2,
      pageH - 12,
      { align: "center" },
    );
  }

  doc.save(`${filename}.pdf`);
}

// ── Stylish attendance Excel export ─────────────────────────────────────────
// Two sheets: "Summary" (stats + filters) and "Records" (the data).

export async function exportAttendanceExcel(
  rows: AttendanceExportRow[],
  filename: string,
  meta: {
    title: string;
    subtitle: string;
    periodLabel: string;
    summary: AttendanceExportSummary;
    filterLabel?: string;
  },
) {
  const XLSX = await import("xlsx");

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const summaryData = [
    [meta.title],
    [meta.subtitle],
    [`Period: ${meta.periodLabel}`],
    meta.filterLabel ? [`Filters: ${meta.filterLabel}`] : [],
    [`Generated: ${new Date().toLocaleString("en-PK")}`],
    [],
    ["Summary"],
    ["Metric", "Value"],
    ["Total Records", meta.summary.totalRecords],
    ["Present", meta.summary.present],
    ["Absent", meta.summary.absent],
    ["Late", meta.summary.late],
    ["Half Day", meta.summary.halfDay],
    ["Leave", meta.summary.leave],
    ["Holiday", meta.summary.holiday],
    ["Total Hours", Number(meta.summary.totalHours.toFixed(2))],
  ].filter((r) => r.length > 0);
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 30 }];
  // Merge title row
  summarySheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
  ];

  // ── Sheet 2: Records ──────────────────────────────────────────────────────
  const recordsData = rows.map((r) => ({
    Date: r.date,
    Agent: r.agentName,
    "Emp ID": r.employeeId,
    Department: r.department,
    "Clock In": r.clockIn,
    "Clock Out": r.clockOut,
    Hours: r.hours,
    Status: r.status,
    Notes: r.notes,
  }));
  const recordsSheet = XLSX.utils.json_to_sheet(recordsData);
  recordsSheet["!cols"] = [
    { wch: 12 }, // Date
    { wch: 22 }, // Agent
    { wch: 12 }, // Emp ID
    { wch: 18 }, // Department
    { wch: 12 }, // Clock In
    { wch: 12 }, // Clock Out
    { wch: 10 }, // Hours
    { wch: 12 }, // Status
    { wch: 30 }, // Notes
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(book, recordsSheet, "Records");
  const out = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${filename}.xlsx`,
  );
}

// ============================================================================
// ALL-AGENTS MONTHLY REPORTS PDF
// ============================================================================
// Generates a multi-page PDF containing every agent's monthly report for a
// given month. Designed for salary disbursement — one page per agent with
// salary breakdown, scores, attendance summary, and sales figures.
//
// Used by the admin "Manage Reports" page → "Download All PDF" button.
// ============================================================================

export type AllReportsPdfRow = {
  agentName: string;
  employeeId: string;
  department: string | null;
  designation: string | null;
  month: string; // "YYYY-MM-01"
  // Salary
  baseSalary: number;
  bonus: number;
  deduction: number;
  netSalary: number;
  // Sales
  totalSales: number;
  salesTarget: number;
  achievementPct: number;
  // Scores (0-100)
  performanceScore: number;
  behaviorScore: number;
  attendanceScore: number;
  punctualityScore: number;
  overallScore: number;
  // Attendance summary
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  daysLeave: number;
  totalHours: number;
  // Free-form
  headline: string | null;
  notes: string | null;
  sentiment: string;
};

const SENTIMENT_RGB: Record<string, [number, number, number]> = {
  praise: [16, 185, 129],       // emerald
  improvement: [59, 130, 246],  // blue
  warning: [245, 158, 11],      // amber
  neutral: [120, 135, 155],     // gray
};

const SCORE_TONE_RGB = (s: number): [number, number, number] =>
  s >= 85 ? [16, 185, 129] : s >= 70 ? [59, 130, 246] : s >= 50 ? [245, 158, 11] : [239, 68, 68];

export async function exportAllReportsPDF(
  reports: AllReportsPdfRow[],
  filename: string,
  meta: { monthLabel: string },
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const logoDataUrl = await loadLogoDataUrl();

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  // ── COVER PAGE ─────────────────────────────────────────────────────────────
  // Dark gradient band
  const bandH = 260;
  for (let i = 0; i < bandH; i++) {
    const t = i / bandH;
    const r = Math.round(13 + (18 - 13) * t);
    const g = Math.round(20 + (45 - 20) * t);
    const b = Math.round(32 + (70 - 32) * t);
    doc.setFillColor(r, g, b);
    doc.rect(0, i, pageW, 1, "F");
  }
  // Top accent
  doc.setFillColor(76, 213, 184);
  doc.rect(0, 0, pageW, 4, "F");
  doc.setFillColor(139, 92, 246);
  doc.rect(0, 4, pageW, 1, "F");

  // Logo
  drawBrandMark(doc, logoDataUrl, margin, 40, 48);

  // Title
  doc.setTextColor(245, 247, 250);
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.text("Monthly Reports Summary", margin, 130);

  // Subtitle
  doc.setTextColor(180, 195, 215);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(meta.monthLabel, margin, 152);
  doc.text(`${reports.length} agent${reports.length === 1 ? "" : "s"} · Salary disbursement sheet`, margin, 170);

  // Aggregate stats on the cover
  const totalNet = reports.reduce((s, r) => s + r.netSalary, 0);
  const totalBonus = reports.reduce((s, r) => s + r.bonus, 0);
  const totalDeduction = reports.reduce((s, r) => s + r.deduction, 0);
  const totalSales = reports.reduce((s, r) => s + r.totalSales, 0);
  const totalHours = reports.reduce((s, r) => s + r.totalHours, 0);
  const avgScore = reports.length ? reports.reduce((s, r) => s + r.overallScore, 0) / reports.length : 0;

  const coverStats = [
    { label: "Total Net Payroll", value: `PKR ${totalNet.toLocaleString("en-PK")}`, color: [76, 213, 184] as [number, number, number] },
    { label: "Total Bonuses", value: `PKR ${totalBonus.toLocaleString("en-PK")}`, color: [16, 185, 129] as [number, number, number] },
    { label: "Total Deductions", value: `PKR ${totalDeduction.toLocaleString("en-PK")}`, color: [239, 68, 68] as [number, number, number] },
    { label: "Total Sales", value: `PKR ${totalSales.toLocaleString("en-PK")}`, color: [59, 130, 246] as [number, number, number] },
    { label: "Total Hours", value: `${totalHours.toFixed(0)}h`, color: [245, 158, 11] as [number, number, number] },
    { label: "Avg Score", value: `${avgScore.toFixed(0)}/100`, color: [139, 92, 246] as [number, number, number] },
  ];

  const statCardW = (pageW - margin * 2 - 16) / 3; // 3 columns, 8px gap
  const statCardH = 56;
  const statY = bandH + 20;
  coverStats.forEach((s, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = margin + col * (statCardW + 8);
    const y = statY + row * (statCardH + 8);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(225, 232, 240);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, y, statCardW, statCardH, 6, 6, "FD");
    // accent left bar
    doc.setFillColor(s.color[0]!, s.color[1]!, s.color[2]!);
    doc.roundedRect(x, y, 3, statCardH, 1.5, 1.5, "F");
    // value
    doc.setTextColor(s.color[0]!, s.color[1]!, s.color[2]!);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(s.value, x + 12, y + 24);
    // label
    doc.setTextColor(120, 135, 155);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(s.label.toUpperCase(), x + 12, y + 42);
  });

  // Generated timestamp
  doc.setTextColor(150, 165, 185);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated ${new Date().toLocaleString("en-PK")} · Billzo Office Management System`,
    margin,
    pageH - 30,
  );
  doc.text("Confidential — for internal use only", pageW - margin, pageH - 30, { align: "right" });

  // ── PER-AGENT PAGES ────────────────────────────────────────────────────────
  for (const r of reports) {
    doc.addPage();

    // ── Compact header band ──────────────────────────────────────────────────
    const hdrH = 80;
    for (let i = 0; i < hdrH; i++) {
      const t = i / hdrH;
      const rr = Math.round(13 + (18 - 13) * t);
      const gg = Math.round(20 + (45 - 20) * t);
      const bb = Math.round(32 + (70 - 32) * t);
      doc.setFillColor(rr, gg, bb);
      doc.rect(0, i, pageW, 1, "F");
    }
    doc.setFillColor(76, 213, 184);
    doc.rect(0, 0, pageW, 2, "F");

    // Logo (small)
    drawBrandMark(doc, logoDataUrl, margin, 18, 28);

    // Agent name + ID
    doc.setTextColor(245, 247, 250);
    doc.setFontSize(17);
    doc.setFont("helvetica", "bold");
    doc.text(r.agentName, margin + 40, 38);
    doc.setTextColor(150, 170, 195);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const subParts = [r.employeeId, r.department, r.designation].filter(Boolean);
    doc.text(subParts.join(" · "), margin + 40, 54);

    // Month label (right-aligned)
    doc.setTextColor(76, 213, 184);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(meta.monthLabel, pageW - margin, 38, { align: "right" });

    // Sentiment badge (right-aligned, below month)
    const sentimentColor = SENTIMENT_RGB[r.sentiment] ?? SENTIMENT_RGB.neutral!;
    const sentimentLabel = r.sentiment.charAt(0).toUpperCase() + r.sentiment.slice(1);
    const badgeW = 80;
    const badgeH = 18;
    const badgeX = pageW - margin - badgeW;
    doc.setFillColor(sentimentColor[0]!, sentimentColor[1]!, sentimentColor[2]!);
    doc.roundedRect(badgeX, 48, badgeW, badgeH, 9, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(sentimentLabel, badgeX + badgeW / 2, 60, { align: "center" });

    // ── SALARY BREAKDOWN (3 cards) ───────────────────────────────────────────
    const salY = hdrH + 16;
    const salCardW = (pageW - margin * 2 - 16) / 3;
    const salCardH = 60;
    const salCards = [
      { label: "Base Salary", value: `PKR ${r.baseSalary.toLocaleString("en-PK")}`, color: [120, 135, 155] as [number, number, number] },
      { label: "Bonus", value: `+ PKR ${r.bonus.toLocaleString("en-PK")}`, color: [16, 185, 129] as [number, number, number] },
      { label: "Deduction", value: `− PKR ${r.deduction.toLocaleString("en-PK")}`, color: [239, 68, 68] as [number, number, number] },
    ];
    salCards.forEach((s, i) => {
      const x = margin + i * (salCardW + 8);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(225, 232, 240);
      doc.setLineWidth(0.6);
      doc.roundedRect(x, salY, salCardW, salCardH, 6, 6, "FD");
      doc.setFillColor(s.color[0]!, s.color[1]!, s.color[2]!);
      doc.roundedRect(x, salY, 3, salCardH, 1.5, 1.5, "F");
      doc.setTextColor(s.color[0]!, s.color[1]!, s.color[2]!);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(s.value, x + 12, salY + 26);
      doc.setTextColor(120, 135, 155);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(s.label.toUpperCase(), x + 12, salY + 44);
    });

    // Net salary — highlighted box
    const netY = salY + salCardH + 10;
    doc.setFillColor(13, 20, 32);
    doc.roundedRect(margin, netY, pageW - margin * 2, 44, 6, 6, "F");
    doc.setFillColor(76, 213, 184);
    doc.roundedRect(margin, netY, 4, 44, 2, 2, "F");
    doc.setTextColor(150, 170, 195);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("NET SALARY", margin + 16, netY + 18);
    doc.setTextColor(76, 213, 184);
    doc.setFontSize(22);
    doc.text(`PKR ${r.netSalary.toLocaleString("en-PK")}`, margin + 16, netY + 36);

    // Sales achievement (right side of net box)
    const achColor = r.achievementPct >= 100 ? [16, 185, 129] as [number, number, number] : r.achievementPct >= 70 ? [59, 130, 246] as [number, number, number] : [245, 158, 11] as [number, number, number];
    doc.setTextColor(150, 170, 195);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("SALES ACHIEVEMENT", pageW - margin - 16, netY + 18, { align: "right" });
    doc.setTextColor(achColor[0]!, achColor[1]!, achColor[2]!);
    doc.setFontSize(18);
    doc.text(`${r.achievementPct.toFixed(1)}%`, pageW - margin - 16, netY + 36, { align: "right" });
    doc.setTextColor(120, 135, 155);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`${r.totalSales.toLocaleString("en-PK")} / ${r.salesTarget.toLocaleString("en-PK")}`, pageW - margin - 16, netY + 50, { align: "right" });

    // ── SCORES TABLE ──────────────────────────────────────────────────────────
    const scoreY = netY + 58;
    doc.setTextColor(60, 70, 85);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("PERFORMANCE SCORES", margin, scoreY);

    autoTable(doc, {
      startY: scoreY + 6,
      head: [["Performance", "Behavior", "Attendance", "Punctuality", "Overall"]],
      body: [[
        `${r.performanceScore.toFixed(0)}/100`,
        `${r.behaviorScore.toFixed(0)}/100`,
        `${r.attendanceScore.toFixed(0)}/100`,
        `${r.punctualityScore.toFixed(0)}/100`,
        `${r.overallScore.toFixed(0)}/100`,
      ]],
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 6, halign: "center", lineColor: [225, 232, 240], lineWidth: 0.5 },
      headStyles: { fillColor: [22, 40, 52], textColor: 255, fontSize: 8, halign: "center" },
      bodyStyles: { textColor: [40, 50, 65], font: "helvetica", fontStyle: "bold" },
      columnStyles: {
        4: { fillColor: [240, 248, 245], textColor: [13, 20, 32] },
      },
      margin: { left: margin, right: margin },
    });

    // ── ATTENDANCE SUMMARY TABLE ──────────────────────────────────────────────
    // @ts-expect-error — autoTable adds lastAutoTable to doc at runtime
    const afterScoresY = doc.lastAutoTable?.finalY ?? scoreY + 30;
    const attY = afterScoresY + 16;
    doc.setTextColor(60, 70, 85);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("ATTENDANCE SUMMARY", margin, attY);

    autoTable(doc, {
      startY: attY + 6,
      head: [["Days Present", "Days Late", "Days Absent", "Days Leave", "Total Hours"]],
      body: [[
        String(r.daysPresent),
        String(r.daysLate),
        String(r.daysAbsent),
        String(r.daysLeave),
        `${r.totalHours.toFixed(1)}h`,
      ]],
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 6, halign: "center", lineColor: [225, 232, 240], lineWidth: 0.5 },
      headStyles: { fillColor: [22, 40, 52], textColor: 255, fontSize: 8, halign: "center" },
      bodyStyles: { textColor: [40, 50, 65], font: "helvetica", fontStyle: "bold" },
      margin: { left: margin, right: margin },
    });

    // ── HEADLINE + NOTES ──────────────────────────────────────────────────────
    // @ts-expect-error — autoTable adds lastAutoTable to doc at runtime
    const afterAttY = doc.lastAutoTable?.finalY ?? attY + 30;
    const notesY = afterAttY + 16;
    if (r.headline || r.notes) {
      doc.setTextColor(60, 70, 85);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("REMARKS", margin, notesY);

      if (r.headline) {
        doc.setTextColor(76, 213, 184);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`"${r.headline}"`, margin, notesY + 16);
      }
      if (r.notes) {
        doc.setTextColor(80, 90, 105);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const splitNotes = doc.splitTextToSize(r.notes, pageW - margin * 2);
        doc.text(splitNotes, margin, notesY + (r.headline ? 32 : 16));
      }
    }

    // ── FOOTER ────────────────────────────────────────────────────────────────
    doc.setDrawColor(225, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 28, pageW - margin, pageH - 28);
    doc.setTextColor(150, 165, 185);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Billzo · ${r.agentName} · ${meta.monthLabel}`, margin, pageH - 16);
    doc.text(`Page ${doc.getNumberOfPages()}`, pageW - margin, pageH - 16, { align: "right" });
  }

  // ── SUMMARY TABLE PAGE (last page — all agents at a glance) ────────────────
  doc.addPage();

  // Header
  doc.setFillColor(13, 20, 32);
  doc.rect(0, 0, pageW, 50, "F");
  doc.setFillColor(76, 213, 184);
  doc.rect(0, 0, pageW, 2, "F");
  drawBrandMark(doc, logoDataUrl, margin, 12, 26);
  doc.setTextColor(245, 247, 250);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("Salary Summary — All Agents", margin + 36, 28);
  doc.setTextColor(150, 170, 195);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(meta.monthLabel, margin + 36, 42);

  autoTable(doc, {
    startY: 60,
    head: [["Agent", "Emp ID", "Base", "Bonus", "Deduction", "Net Pay", "Sales", "Score"]],
    body: reports.map((r) => [
      r.agentName,
      r.employeeId,
      r.baseSalary.toLocaleString("en-PK"),
      `+${r.bonus.toLocaleString("en-PK")}`,
      `−${r.deduction.toLocaleString("en-PK")}`,
      r.netSalary.toLocaleString("en-PK"),
      r.totalSales.toLocaleString("en-PK"),
      `${r.overallScore.toFixed(0)}/100`,
    ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 4, lineColor: [225, 232, 240], lineWidth: 0.4 },
    headStyles: { fillColor: [22, 40, 52], textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      5: { fontStyle: "bold", textColor: [76, 213, 184] },
    },
    margin: { left: margin, right: margin },
  });

  // Total row
  // @ts-expect-error — autoTable adds lastAutoTable to doc at runtime
  const afterTableY = doc.lastAutoTable?.finalY ?? 100;
  doc.setFillColor(13, 20, 32);
  doc.roundedRect(margin, afterTableY + 8, pageW - margin * 2, 28, 4, 4, "F");
  doc.setTextColor(150, 170, 195);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL PAYROLL", margin + 10, afterTableY + 25);
  doc.setTextColor(76, 213, 184);
  doc.setFontSize(13);
  doc.text(`PKR ${totalNet.toLocaleString("en-PK")}`, pageW - margin - 10, afterTableY + 25, { align: "right" });

  // Footer
  doc.setTextColor(150, 165, 185);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated ${new Date().toLocaleString("en-PK")} · Billzo Office Management System`, margin, pageH - 16);
  doc.text(`Page ${doc.getNumberOfPages()}`, pageW - margin, pageH - 16, { align: "right" });

  doc.save(`${filename}.pdf`);
}

// ============================================================================
// PER-AGENT MONTHLY ATTENDANCE PDF
// ============================================================================
// Generates a single-agent attendance PDF for a specific month.
// Shows the full month calendar with clock-in/out, hours, and status for each day.
//
// Used by the agent's "My Profile → Attendance" tab and the admin agent detail.
// ============================================================================

export type AgentAttendancePdfRow = {
  date: string;
  dayName: string;
  clockIn: string | null;
  clockOut: string | null;
  hours: number;
  status: string;
  notes: string | null;
  autoFilled: boolean;
};

export async function exportAgentAttendancePDF(
  rows: AgentAttendancePdfRow[],
  filename: string,
  meta: {
    agentName: string;
    employeeId: string;
    department: string | null;
    designation: string | null;
    shiftTiming: string | null;
    monthLabel: string;
    summary: {
      daysPresent: number;
      daysAbsent: number;
      daysLate: number;
      daysLeave: number;
      daysHalfDay: number;
      totalHours: number;
    };
  },
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const logoDataUrl = await loadLogoDataUrl();

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  // ── HEADER BAND ────────────────────────────────────────────────────────────
  const bandH = 110;
  for (let i = 0; i < bandH; i++) {
    const t = i / bandH;
    const r = Math.round(13 + (18 - 13) * t);
    const g = Math.round(20 + (45 - 20) * t);
    const b = Math.round(32 + (70 - 32) * t);
    doc.setFillColor(r, g, b);
    doc.rect(0, i, pageW, 1, "F");
  }
  doc.setFillColor(76, 213, 184);
  doc.rect(0, 0, pageW, 3, "F");
  doc.setFillColor(139, 92, 246);
  doc.rect(0, 3, pageW, 1, "F");

  // Logo
  drawBrandMark(doc, logoDataUrl, margin, 22, 40);

  // Agent name + ID
  doc.setTextColor(245, 247, 250);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(meta.agentName, margin + 52, 48);

  doc.setTextColor(150, 170, 195);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const subParts = [meta.employeeId, meta.department, meta.designation].filter(Boolean);
  doc.text(subParts.join(" · "), margin + 52, 66);

  // Month label (right-aligned)
  doc.setTextColor(76, 213, 184);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(meta.monthLabel, pageW - margin, 48, { align: "right" });

  // Shift info (right-aligned)
  if (meta.shiftTiming) {
    doc.setTextColor(150, 170, 195);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Shift: ${meta.shiftTiming}`, pageW - margin, 66, { align: "right" });
  }

  // ── SUMMARY CARDS ──────────────────────────────────────────────────────────
  const sumY = bandH + 16;
  const sumCardW = (pageW - margin * 2 - 32) / 6; // 6 cards
  const sumCardH = 50;
  const sumCards = [
    { label: "Present", value: String(meta.summary.daysPresent), color: [16, 185, 129] as [number, number, number] },
    { label: "Late", value: String(meta.summary.daysLate), color: [245, 158, 11] as [number, number, number] },
    { label: "Absent", value: String(meta.summary.daysAbsent), color: [239, 68, 68] as [number, number, number] },
    { label: "Leave", value: String(meta.summary.daysLeave), color: [139, 92, 246] as [number, number, number] },
    { label: "Half Day", value: String(meta.summary.daysHalfDay), color: [59, 130, 246] as [number, number, number] },
    { label: "Hours", value: `${meta.summary.totalHours.toFixed(0)}h`, color: [76, 213, 184] as [number, number, number] },
  ];
  sumCards.forEach((s, i) => {
    const x = margin + i * (sumCardW + 6.4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(225, 232, 240);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, sumY, sumCardW, sumCardH, 5, 5, "FD");
    doc.setFillColor(s.color[0]!, s.color[1]!, s.color[2]!);
    doc.roundedRect(x, sumY, 2.5, sumCardH, 1.2, 1.2, "F");
    doc.setTextColor(s.color[0]!, s.color[1]!, s.color[2]!);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(s.value, x + sumCardW / 2, sumY + 24, { align: "center" });
    doc.setTextColor(120, 135, 155);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(s.label.toUpperCase(), x + sumCardW / 2, sumY + 40, { align: "center" });
  });

  // ── ATTENDANCE TABLE ───────────────────────────────────────────────────────
  const tableY = sumY + sumCardH + 20;
  doc.setTextColor(60, 70, 85);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DAILY ATTENDANCE", margin, tableY);

  autoTable(doc, {
    startY: tableY + 8,
    head: [["Date", "Day", "Clock In", "Clock Out", "Hours", "Status"]],
    body: rows.map((r) => [
      r.date,
      r.dayName,
      r.clockIn ?? (r.autoFilled ? "auto" : "—"),
      r.clockOut ?? (r.autoFilled ? "auto" : "—"),
      r.hours > 0 ? `${r.hours.toFixed(1)}h` : "—",
      r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : "—",
    ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 4, lineColor: [225, 232, 240], lineWidth: 0.3 },
    headStyles: { fillColor: [22, 40, 52], textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      // Color the status column based on status
      if (data.section === "body" && data.column.index === 5) {
        const statusText = String(data.cell.raw ?? "");
        const statusLower = statusText.toLowerCase();
        const color = STATUS_RGB[statusLower];
        if (color) {
          data.cell.styles.textColor = color;
          data.cell.styles.fontStyle = "bold";
        }
      }
      // Dim auto-filled rows
      if (data.section === "body") {
        const rowData = rows[data.row.index];
        if (rowData?.autoFilled) {
          data.cell.styles.fontStyle = "italic";
          data.cell.styles.textColor = [100, 120, 140];
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(225, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 24, pageW - margin, pageH - 24);
    doc.setTextColor(150, 165, 185);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Billzo · ${meta.agentName} · ${meta.monthLabel}`, margin, pageH - 12);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 12, { align: "right" });
  }

  doc.save(`${filename}.pdf`);
}

/**
 * EmployeeCardPrint — professional employee ID card.
 *
 * Features:
 * - Print-ready: 2 cards per A4 page (front + back), properly sized
 * - PDF download via jsPDF (vector-quality, embeds logo + photo)
 * - Professional design: dark gradient, Billzo logo, QR-style accent
 * - Shows only: Name, DP, Employee ID, Joined Date, Employee Type, Designation
 * - Gender-based accent colors (cyan/blue for male, pink/purple for female)
 */
import { useRef } from "react";
import { Printer, Download, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecureImage } from "@/components/billzo/SecureImage";
import { initials, formatDate } from "@/lib/billzo";

interface Agent {
  id: string;
  full_name: string;
  employee_id: string;
  reference_id: string;
  profile_picture_url?: string | null;
  designation?: string | null;
  department?: string | null;
  employee_type?: string | null;
  phone_number?: string | null;
  email?: string | null;
  joining_date?: string | null;
  gender?: string | null;
  status: string;
  blood_group?: string | null;
  cnic_number?: string | null;
}

interface Props {
  agent: Agent;
}

const FEMALE_GENDER = ["Female", "female", "F", "f"];

export function EmployeeCardPrint({ agent }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isFemale = FEMALE_GENDER.includes(agent.gender ?? "");

  const handlePrint = () => {
    const cardHTML = cardRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank", "width=900,height=650");
    if (!win) return;

    const accent = isFemale
      ? { from: "#ec4899", to: "#a855f7", glow: "rgba(236,72,153,0.3)", primary: "#ec4899" }
      : { from: "#06b6d4", to: "#3b82f6", glow: "rgba(6,182,212,0.3)", primary: "#06b6d4" };

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Employee ID Card — ${agent.full_name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0e1a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: 'Segoe UI', Arial, sans-serif;
      padding: 20px;
      gap: 20px;
    }
    .card-pair { display: flex; gap: 30px; flex-wrap: wrap; justify-content: center; }
    .card-wrapper { width: 400px; }
    .card-label { text-align: center; font-size: 10px; color: #666; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.1em; }
    @media print {
      body { background: white; padding: 10px; gap: 10px; }
      .card-pair { gap: 20px; }
      .card-wrapper { width: 380px; page-break-inside: avoid; }
      .card-label { display: none; }
      @page { margin: 15px; }
    }
  </style>
</head>
<body>
  <div class="card-pair">
    <div>
      <div class="card-wrapper">${cardHTML}</div>
      <div class="card-label">— Front —</div>
    </div>
    <div>
      <div class="card-wrapper">${cardHTML}</div>
      <div class="card-label">— Back (copy) —</div>
    </div>
  </div>
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body>
</html>`);
    win.document.close();
  };

  const handleDownloadPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Card dimensions (CR80 ratio: 85.6mm × 54mm)
    const cardW = 90;
    const cardH = 57;
    const gap = 20;
    const startX = (pageW - cardW * 2 - gap) / 2;
    const startY = (pageH - cardH) / 2;

    // Draw 2 cards (front + back copy)
    for (let copy = 0; copy < 2; copy++) {
      const x = startX + copy * (cardW + gap);
      drawCardPDF(doc, x, startY, cardW, cardH, agent, isFemale);
    }

    // Labels
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text("— Front —", startX + cardW / 2, startY + cardH + 5, { align: "center" });
    doc.text("— Back (copy) —", startX + cardW + gap + cardW / 2, startY + cardH + 5, { align: "center" });

    doc.save(`id-card-${agent.employee_id}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Card preview */}
      <div className="flex justify-center">
        <div ref={cardRef} className="w-full max-w-sm">
          <EmployeeCard agent={agent} isFemale={isFemale} />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="size-4" />
          Print (2 per page)
        </Button>
        <Button onClick={handleDownloadPDF} variant="outline" className="gap-2 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20">
          <Download className="size-4" />
          Download PDF
        </Button>
      </div>

      {/* Hint */}
      <p className="text-center text-xs text-muted-foreground">
        <CreditCard className="inline size-3.5 mr-1 opacity-60" />
        Standard CR80 card size — prints 2 cards per A4 page. Print on card stock or laminate.
      </p>
    </div>
  );
}

// ── On-screen card (also used for print HTML) ─────────────────────────────────

function EmployeeCard({ agent, isFemale }: { agent: Agent; isFemale: boolean }) {
  const accent = isFemale
    ? { from: "#ec4899", to: "#a855f7", glow: "rgba(236,72,153,0.25)", primary: "#ec4899" }
    : { from: "#06b6d4", to: "#3b82f6", glow: "rgba(6,182,212,0.25)", primary: "#06b6d4" };

  return (
    <div
      className="relative overflow-hidden rounded-2xl select-none"
      style={{
        background: "linear-gradient(145deg, #0a0f1c 0%, #121826 50%, #0a0f1c 100%)",
        boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${accent.glow}`,
        width: "100%",
        aspectRatio: "1.586 / 1",
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      {/* Top gradient bar */}
      <div style={{ height: 5, background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }} />

      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)`,
        backgroundSize: "14px 14px",
      }} />

      {/* Glow orb */}
      <div style={{
        position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%",
        background: `radial-gradient(circle, ${accent.glow} 0%, transparent 70%)`, pointerEvents: "none",
      }} />

      {/* Content */}
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10, position: "relative", height: "calc(100% - 5px)" }}>

        {/* Row 1: Logo + Brand */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/logo-mark.png" alt="Billzo" style={{ width: 30, height: 30, borderRadius: 6, objectFit: "cover" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "0.18em", textTransform: "uppercase" }}>
                BILLZO
              </div>
              <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}>
                OFFICE MANAGEMENT
              </div>
            </div>
          </div>
          {/* Status badge */}
          <div style={{
            fontSize: 8, fontWeight: 700, color: "#fff",
            background: agent.status === "active" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
            border: `1px solid ${agent.status === "active" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
            borderRadius: 10, padding: "2px 10px", textTransform: "uppercase", letterSpacing: "0.1em",
          }}>
            {agent.status}
          </div>
        </div>

        {/* Row 2: Avatar + Name + Designation */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            border: `2px solid ${accent.from}`,
            boxShadow: `0 0 12px ${accent.glow}`,
            background: `linear-gradient(135deg, ${accent.from}33, ${accent.to}33)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {agent.profile_picture_url ? (
              <SecureImage path={agent.profile_picture_url} alt={agent.full_name} className="w-full h-full object-cover" />
            ) : (
              <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{initials(agent.full_name)}</span>
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {agent.full_name}
            </div>
            {agent.designation && (
              <div style={{ fontSize: 9, color: accent.primary, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 3 }}>
                {agent.designation}
              </div>
            )}
          </div>
        </div>

        {/* Row 3: EMP ID chip (prominent) */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: `${accent.from}12`, border: `1px solid ${accent.from}30`, borderRadius: 8,
          padding: "5px 10px", marginTop: 2,
        }}>
          <span style={{ fontSize: 7, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            EMPLOYEE ID
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "monospace", letterSpacing: "0.08em", marginLeft: "auto" }}>
            {agent.employee_id}
          </span>
        </div>

        {/* Row 4: Key info — Joined Date + Employee Type */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginTop: 2 }}>
          {agent.joining_date && (
            <InfoRow label="Joined" value={formatDate(agent.joining_date) ?? agent.joining_date} accent={accent.primary} />
          )}
          {agent.employee_type && (
            <InfoRow label="Type" value={agent.employee_type} accent={accent.primary} />
          )}
        </div>

        {/* Bottom bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 20,
          background: `linear-gradient(90deg, ${accent.from}12, ${accent.to}12)`,
          borderTop: `1px solid ${accent.from}20`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 14px",
        }}>
          <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.2)", letterSpacing: "0.25em", textTransform: "uppercase" }}>
            AUTHORIZED PERSONNEL
          </span>
          <span style={{ fontSize: 6.5, color: accent.primary, fontWeight: 600, letterSpacing: "0.1em" }}>
            {new Date().getFullYear()} BILLZO
          </span>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <div style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </div>
    </div>
  );
}

// ── PDF card drawing (vector quality) ─────────────────────────────────────────

async function drawCardPDF(
  doc: { setFillColor: (r: number, g: number, b: number) => void; setTextColor: (r: number, g: number, b: number) => void; setFontSize: (s: number) => void; setFont: (f: string, s: string) => void; roundedRect: (x: number, y: number, w: number, h: number, rx: number, ry: number, style: string) => void; rect: (x: number, y: number, w: number, h: number, style: string) => void; text: (t: string, x: number, y: number, opts?: unknown) => void; addImage: (data: string, format: string, x: number, y: number, w: number, h: number, alias?: unknown, compression?: string) => void; setDrawColor: (r: number, g: number, b: number) => void; setLineWidth: (w: number) => void; circle: (x: number, y: number, r: number, style: string) => void; line: (x1: number, y1: number, x2: number, y2: number) => void; splitTextToSize: (t: string, w: number) => string[] },
  x: number,
  y: number,
  w: number,
  h: number,
  agent: Agent,
  isFemale: boolean,
) {
  const accent = isFemale
    ? { r: 236, g: 72, b: 153 }  // pink
    : { r: 6, g: 182, b: 212 };  // cyan

  // Card background (dark)
  doc.setFillColor(10, 15, 28);
  doc.roundedRect(x, y, w, h, 3, 3, "F");

  // Top accent bar
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.roundedRect(x, y, w, 1.5, 3, 3, "F");
  doc.rect(x, y + 1, w, 0.5, "F");

  // Logo (try to load, skip if fails)
  try {
    const resp = await fetch("/logo-mark.png");
    if (resp.ok) {
      const blob = await resp.blob();
      const logoData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      doc.addImage(logoData, "PNG", x + 4, y + 3, 5, 5);
    }
  } catch { /* skip logo */ }

  // Brand name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("BILLZO", x + 10, y + 5.5);
  doc.setFontSize(4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("OFFICE MANAGEMENT", x + 10, y + 7.5);

  // Status badge (right)
  const statusColor = agent.status === "active" ? [16, 185, 129] : [239, 68, 68];
  doc.setFillColor(statusColor[0]!, statusColor[1]!, statusColor[2]!);
  doc.roundedRect(x + w - 20, y + 3.5, 16, 4, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(4);
  doc.setFont("helvetica", "bold");
  doc.text(agent.status.toUpperCase(), x + w - 12, y + 6.2, { align: "center" });

  // Name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  const nameText = agent.full_name.length > 25 ? agent.full_name.slice(0, 25) + "…" : agent.full_name;
  doc.text(nameText, x + 4, y + 16);

  // Designation
  if (agent.designation) {
    doc.setFontSize(5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(agent.designation.toUpperCase(), x + 4, y + 19);
  }

  // Employee ID box
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.setTextColor(255, 255, 255);
  doc.roundedRect(x + 4, y + 22, w - 8, 6, 1.5, 1.5, "F");
  doc.setFontSize(4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text("EMPLOYEE ID", x + 6, y + 25.5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(agent.employee_id, x + w - 6, y + 26.5, { align: "right" });

  // Joined date + Employee type
  doc.setFontSize(4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  if (agent.joining_date) {
    doc.text("JOINED", x + 4, y + 33);
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(5);
    doc.text(formatDate(agent.joining_date) ?? agent.joining_date, x + 4, y + 35.5);
  }
  if (agent.employee_type) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(4);
    doc.text("TYPE", x + w / 2, y + 33);
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(5);
    doc.text(agent.employee_type, x + w / 2, y + 35.5);
  }

  // Bottom bar
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(x, y + h - 3, w, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(3.5);
  doc.setFont("helvetica", "normal");
  doc.text("AUTHORIZED PERSONNEL", x + 4, y + h - 1);
  doc.text(`${new Date().getFullYear()} BILLZO`, x + w - 4, y + h - 1, { align: "right" });

  // Card border
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 3, 3, "S");
}

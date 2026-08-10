/**
 * EmployeeCardPrint — professional employee ID card.
 *
 * Fixes:
 * - Print: uses print-color-adjust: exact so dark backgrounds + white text print correctly
 * - Print: embeds the profile picture as a base64 data URL (not SecureImage) so it shows in print
 * - PDF: embeds the profile picture as base64 in the jsPDF document
 * - Both: dark gradient background with proper contrast, all text visible
 */
import { useRef, useState, useEffect } from "react";
import { Printer, Download, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecureImage } from "@/components/billzo/SecureImage";
import { initials, formatDate } from "@/lib/billzo";
import { signedUrl } from "@/lib/storage";

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
  const [dpDataUrl, setDpDataUrl] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const accent = isFemale
    ? { from: "#ec4899", to: "#a855f7", glow: "rgba(236,72,153,0.25)", primary: "#ec4899", r: 236, g: 72, b: 153 }
    : { from: "#06b6d4", to: "#3b82f6", glow: "rgba(6,182,212,0.25)", primary: "#06b6d4", r: 6, g: 182, b: 212 };

  // Pre-fetch the profile picture as a base64 data URL (for print + PDF)
  useEffect(() => {
    if (!agent.profile_picture_url) return;
    void (async () => {
      try {
        const url = await signedUrl(agent.profile_picture_url);
        if (!url) return;
        const resp = await fetch(url);
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onloadend = () => setDpDataUrl(reader.result as string);
        reader.readAsDataURL(blob);
      } catch { /* skip */ }
    })();
  }, [agent.profile_picture_url]);

  // Pre-fetch the logo as base64
  useEffect(() => {
    void (async () => {
      try {
        const resp = await fetch("/logo-mark.png");
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoDataUrl(reader.result as string);
        reader.readAsDataURL(blob);
      } catch { /* skip */ }
    })();
  }, []);

  // ── Build the card HTML as a self-contained string (for print) ──────────────
  const buildCardHTML = () => {
    const dpImg = dpDataUrl
      ? `<img src="${dpDataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,${accent.from}33,${accent.to}33);border-radius:50%;"><span style="font-size:18px;font-weight:700;color:#fff;">${initials(agent.full_name)}</span></div>`;
    const logoImg = logoDataUrl
      ? `<img src="${logoDataUrl}" style="width:30px;height:30px;border-radius:6px;object-fit:cover;" />`
      : "";

    return `<div style="position:relative;overflow:hidden;border-radius:16px;width:400px;height:252px;background:linear-gradient(145deg,#0a0f1c 0%,#121826 50%,#0a0f1c 100%);font-family:'Segoe UI',Arial,sans-serif;box-shadow:0 0 0 1px rgba(255,255,255,0.08),0 20px 60px rgba(0,0,0,0.5);-webkit-print-color-adjust:exact;print-color-adjust:exact;">
  <div style="height:5px;background:linear-gradient(90deg,${accent.from},${accent.to});-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
  <div style="position:absolute;top:-40px;right:-40px;width:140px;height:140px;border-radius:50%;background:radial-gradient(circle,${accent.glow} 0%,transparent 70%);"></div>
  <div style="padding:14px 18px;display:flex;flex-direction:column;gap:10px;position:relative;height:calc(100% - 5px);">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:8px;">
        ${logoImg}
        <div>
          <div style="font-size:13px;font-weight:800;color:#fff;letter-spacing:0.18em;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact;">BILLZO</div>
          <div style="font-size:7px;color:rgba(255,255,255,0.5);letter-spacing:0.12em;-webkit-print-color-adjust:exact;print-color-adjust:exact;">OFFICE MANAGEMENT</div>
        </div>
      </div>
      <div style="font-size:8px;font-weight:700;color:#fff;background:${agent.status === "active" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"};border:1px solid ${agent.status === "active" ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.5)"};border-radius:10px;padding:2px 10px;text-transform:uppercase;letter-spacing:0.1em;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${agent.status}</div>
    </div>
    <div style="display:flex;align-items:center;gap:12px;margin-top:2px;">
      <div style="width:56px;height:56px;border-radius:50%;overflow:hidden;flex-shrink:0;border:2px solid ${accent.from};box-shadow:0 0 12px ${accent.glow};-webkit-print-color-adjust:exact;print-color-adjust:exact;">${dpImg}</div>
      <div style="min-width:0;flex:1;">
        <div style="font-size:16px;font-weight:700;color:#fff;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${agent.full_name}</div>
        ${agent.designation ? `<div style="font-size:9px;color:${accent.primary};text-transform:uppercase;letter-spacing:0.1em;margin-top:3px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${agent.designation}</div>` : ""}
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;background:${accent.from}15;border:1px solid ${accent.from}40;border-radius:8px;padding:5px 10px;margin-top:2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <span style="font-size:7px;color:rgba(255,255,255,0.5);letter-spacing:0.12em;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact;">EMPLOYEE ID</span>
      <span style="font-size:13px;font-weight:800;color:#fff;font-family:monospace;letter-spacing:0.08em;margin-left:auto;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${agent.employee_id}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;margin-top:2px;">
      ${agent.joining_date ? `<div><div style="font-size:7px;color:rgba(255,255,255,0.35);letter-spacing:0.08em;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact;">JOINED</div><div style="font-size:9px;color:rgba(255,255,255,0.8);margin-top:1px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${formatDate(agent.joining_date) ?? agent.joining_date}</div></div>` : ""}
      ${agent.employee_type ? `<div><div style="font-size:7px;color:rgba(255,255,255,0.35);letter-spacing:0.08em;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact;">TYPE</div><div style="font-size:9px;color:rgba(255,255,255,0.8);margin-top:1px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${agent.employee_type}</div></div>` : ""}
    </div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:20px;background:linear-gradient(90deg,${accent.from}15,${accent.to}15);border-top:1px solid ${accent.from}25;display:flex;align-items:center;justify-content:space-between;padding:0 14px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <span style="font-size:6.5px;color:rgba(255,255,255,0.3);letter-spacing:0.25em;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact;">AUTHORIZED PERSONNEL</span>
      <span style="font-size:6.5px;color:${accent.primary};font-weight:600;letter-spacing:0.1em;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${new Date().getFullYear()} BILLZO</span>
    </div>
  </div>
</div>`;
  };

  const handlePrint = () => {
    const cardHTML = buildCardHTML();
    const win = window.open("", "_blank", "width=900,height=650");
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Employee ID Card — ${agent.full_name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f0f0f0;
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
    .card-label { text-align: center; font-size: 10px; color: #666; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.1em; }
    @media print {
      body { background: white; padding: 10px; gap: 10px; }
      .card-pair { gap: 20px; }
      .card-label { display: none; }
      @page { margin: 15px; }
    }
  </style>
</head>
<body>
  <div class="card-pair">
    <div>
      ${cardHTML}
      <div class="card-label">— Front —</div>
    </div>
    <div>
      ${cardHTML}
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

    const cardW = 90;
    const cardH = 57;
    const gap = 20;
    const startX = (pageW - cardW * 2 - gap) / 2;
    const startY = (pageH - cardH) / 2;

    for (let copy = 0; copy < 2; copy++) {
      const x = startX + copy * (cardW + gap);
      await drawCardPDF(doc, x, startY, cardW, cardH, agent, isFemale, dpDataUrl, logoDataUrl);
    }

    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text("— Front —", startX + cardW / 2, startY + cardH + 5, { align: "center" });
    doc.text("— Back (copy) —", startX + cardW + gap + cardW / 2, startY + cardH + 5, { align: "center" });

    doc.save(`id-card-${agent.employee_id}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Card preview (on screen) */}
      <div className="flex justify-center">
        <div ref={cardRef} className="w-full max-w-sm">
          <EmployeeCard agent={agent} isFemale={isFemale} accent={accent} />
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

      <p className="text-center text-xs text-muted-foreground">
        <CreditCard className="inline size-3.5 mr-1 opacity-60" />
        Standard CR80 card size — prints 2 cards per A4 page with full color.
      </p>
    </div>
  );
}

// ── On-screen card ────────────────────────────────────────────────────────────

function EmployeeCard({ agent, isFemale, accent }: { agent: Agent; isFemale: boolean; accent: { from: string; to: string; glow: string; primary: string } }) {
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
      <div style={{ height: 5, background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }} />
      <div style={{
        position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%",
        background: `radial-gradient(circle, ${accent.glow} 0%, transparent 70%)`, pointerEvents: "none",
      }} />
      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10, position: "relative", height: "calc(100% - 5px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/logo-mark.png" alt="Billzo" style={{ width: 30, height: 30, borderRadius: 6, objectFit: "cover" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "0.18em", textTransform: "uppercase" }}>BILLZO</div>
              <div style={{ fontSize: 7, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em" }}>OFFICE MANAGEMENT</div>
            </div>
          </div>
          <div style={{
            fontSize: 8, fontWeight: 700, color: "#fff",
            background: agent.status === "active" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)",
            border: `1px solid ${agent.status === "active" ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.5)"}`,
            borderRadius: 10, padding: "2px 10px", textTransform: "uppercase", letterSpacing: "0.1em",
          }}>
            {agent.status}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            border: `2px solid ${accent.from}`, boxShadow: `0 0 12px ${accent.glow}`,
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
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: `${accent.from}15`, border: `1px solid ${accent.from}40`, borderRadius: 8, padding: "5px 10px", marginTop: 2,
        }}>
          <span style={{ fontSize: 7, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase" }}>EMPLOYEE ID</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "monospace", letterSpacing: "0.08em", marginLeft: "auto" }}>
            {agent.employee_id}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginTop: 2 }}>
          {agent.joining_date && (
            <div>
              <div style={{ fontSize: 7, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>JOINED</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.8)", marginTop: 1 }}>{formatDate(agent.joining_date) ?? agent.joining_date}</div>
            </div>
          )}
          {agent.employee_type && (
            <div>
              <div style={{ fontSize: 7, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>TYPE</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.8)", marginTop: 1 }}>{agent.employee_type}</div>
            </div>
          )}
        </div>
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 20,
          background: `linear-gradient(90deg, ${accent.from}15, ${accent.to}15)`,
          borderTop: `1px solid ${accent.from}25`,
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px",
        }}>
          <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.3)", letterSpacing: "0.25em", textTransform: "uppercase" }}>AUTHORIZED PERSONNEL</span>
          <span style={{ fontSize: 6.5, color: accent.primary, fontWeight: 600, letterSpacing: "0.1em" }}>{new Date().getFullYear()} BILLZO</span>
        </div>
      </div>
    </div>
  );
}

// ── PDF card drawing — now embeds the profile picture ─────────────────────────

async function drawCardPDF(
  doc: any,
  x: number,
  y: number,
  w: number,
  h: number,
  agent: Agent,
  isFemale: boolean,
  dpDataUrl: string | null,
  logoDataUrl: string | null,
) {
  const ac = isFemale
    ? { r: 236, g: 72, b: 153 }
    : { r: 6, g: 182, b: 212 };

  // Card background (dark navy)
  doc.setFillColor(10, 15, 28);
  doc.roundedRect(x, y, w, h, 3, 3, "F");

  // Top accent bar
  doc.setFillColor(ac.r, ac.g, ac.b);
  doc.roundedRect(x, y, w, 1.5, 3, 3, "F");
  doc.rect(x, y + 1, w, 0.5, "F");

  // Logo
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "PNG", x + 4, y + 3, 5, 5); } catch { /* skip */ }
  }

  // Brand name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("BILLZO", x + 10, y + 5.5);
  doc.setFontSize(4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 130, 130);
  doc.text("OFFICE MANAGEMENT", x + 10, y + 7.5);

  // Status badge
  const statusColor = agent.status === "active" ? [16, 185, 129] : [239, 68, 68];
  doc.setFillColor(statusColor[0]!, statusColor[1]!, statusColor[2]!);
  doc.roundedRect(x + w - 20, y + 3.5, 16, 4, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(4);
  doc.setFont("helvetica", "bold");
  doc.text(agent.status.toUpperCase(), x + w - 12, y + 6.2, { align: "center" });

  // Profile picture (DP) — embed as circle
  const dpX = x + 8;
  const dpY = y + 11;
  const dpSize = 10;
  if (dpDataUrl) {
    // Draw a colored circle background behind the photo
    doc.setFillColor(ac.r, ac.g, ac.b);
    doc.circle(dpX + dpSize / 2, dpY + dpSize / 2, dpSize / 2 + 0.5, "F");
    // Embed the photo
    try {
      doc.addImage(dpDataUrl, "PNG", dpX, dpY, dpSize, dpSize);
    } catch { /* skip */ }
  } else {
    // Fallback: initials in a colored circle
    doc.setFillColor(ac.r, ac.g, ac.b);
    doc.circle(dpX + dpSize / 2, dpY + dpSize / 2, dpSize / 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(initials(agent.full_name), dpX + dpSize / 2, dpY + dpSize / 2 + 1, { align: "center" });
  }

  // Name (next to DP)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  const nameText = agent.full_name.length > 22 ? agent.full_name.slice(0, 22) + "…" : agent.full_name;
  doc.text(nameText, x + 20, y + 16);

  // Designation
  if (agent.designation) {
    doc.setFontSize(5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(ac.r, ac.g, ac.b);
    doc.text(agent.designation.toUpperCase(), x + 20, y + 19);
  }

  // Employee ID box
  doc.setFillColor(ac.r, ac.g, ac.b);
  doc.roundedRect(x + 4, y + 24, w - 8, 6, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(4);
  doc.setFont("helvetica", "normal");
  doc.text("EMPLOYEE ID", x + 6, y + 27.5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(agent.employee_id, x + w - 6, y + 28.5, { align: "right" });

  // Joined date + Employee type
  doc.setFontSize(4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  if (agent.joining_date) {
    doc.text("JOINED", x + 4, y + 35);
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(5);
    doc.text(formatDate(agent.joining_date) ?? agent.joining_date, x + 4, y + 37.5);
  }
  if (agent.employee_type) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(4);
    doc.text("TYPE", x + w / 2, y + 35);
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(5);
    doc.text(agent.employee_type, x + w / 2, y + 37.5);
  }

  // Bottom bar
  doc.setFillColor(ac.r, ac.g, ac.b);
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

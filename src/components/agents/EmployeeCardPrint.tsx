/**
 * EmployeeCardPrint — print-ready employee ID card with unique design.
 * Renders a premium card on screen and prints cleanly via browser print.
 */
import { useRef } from "react";
import { Printer, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecureImage } from "@/components/billzo/SecureImage";
import { initials } from "@/lib/billzo";

interface Agent {
  id: string;
  full_name: string;
  employee_id: string;
  reference_id: string;
  profile_picture_url?: string | null;
  designation?: string | null;
  department?: string | null;
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
    const printContents = cardRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank", "width=900,height=650");
    if (!win) return;

    // Build the page skeleton with no user-supplied values interpolated into HTML.
    // The title is set via DOM textContent after document creation to prevent XSS.
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title></title>
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
      padding: 24px;
      gap: 24px;
    }
    .print-card-wrapper { width: 340px; }
    @media print {
      body { background: white; padding: 0; }
      .print-card-wrapper { page-break-inside: avoid; }
    }
    ${getPrintStyles(isFemale)}
  </style>
</head>
<body>
  <div class="print-card-wrapper"></div>
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body>
</html>`);
    win.document.close();

    // Set title via textContent — never via string interpolation — to avoid XSS.
    win.document.title = `Employee ID Card — ${agent.full_name}`;

    // Inject card HTML via innerHTML on a trusted wrapper element.
    const wrapper = win.document.querySelector(".print-card-wrapper");
    if (wrapper) wrapper.innerHTML = printContents;
  };

  return (
    <div className="space-y-6">
      {/* Card preview */}
      <div ref={cardRef} className="mx-auto w-full max-w-xs">
        <EmployeeCard agent={agent} isFemale={isFemale} />
      </div>

      {/* Print button */}
      <div className="flex justify-center gap-3">
        <Button onClick={handlePrint} className="gap-2 px-8">
          <Printer className="size-4" />
          Print ID Card
        </Button>
      </div>

      {/* Front + Back hint */}
      <p className="text-center text-xs text-muted-foreground">
        <CreditCard className="inline size-3.5 mr-1 opacity-60" />
        Standard CR80 card size — front face only. Print on card stock or laminate.
      </p>
    </div>
  );
}

function EmployeeCard({ agent, isFemale }: { agent: Agent; isFemale: boolean }) {
  const accent = isFemale
    ? { from: "#e91e8c", to: "#9b59b6", glow: "rgba(233,30,140,0.35)", badge: "#e91e8c" }
    : { from: "#00c6ff", to: "#0062ff", glow: "rgba(0,98,255,0.35)", badge: "#0062ff" };

  return (
    <div
      className="relative overflow-hidden rounded-2xl select-none"
      style={{
        background: "linear-gradient(145deg, #0d1117 0%, #161b27 60%, #0d1117 100%)",
        boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${accent.glow}`,
        width: "100%",
        aspectRatio: "1.586 / 1",
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          height: 4,
          background: `linear-gradient(90deg, ${accent.from}, ${accent.to})`,
        }}
      />

      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
          pointerEvents: "none",
        }}
      />

      {/* Glowing orb */}
      <div
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent.glow} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div style={{ padding: "14px 16px 12px", display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>

        {/* Top row: logo / company + avatar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Logo */}
            <img
              src="/logo-mark.png"
              alt="Billzo"
              style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }}
            />
            <div>
              <div style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.2em",
                color: "#fff",
                textTransform: "uppercase",
              }}>
                BILLZO
              </div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", marginTop: 1 }}>
                OFFICE MANAGEMENT SYSTEM
              </div>
            </div>
          </div>

          {/* Avatar */}
          <div style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            overflow: "hidden",
            border: `2px solid ${accent.from}`,
            boxShadow: `0 0 12px ${accent.glow}`,
            flexShrink: 0,
            background: `linear-gradient(135deg, ${accent.from}33, ${accent.to}33)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {agent.profile_picture_url ? (
              <SecureImage
                path={agent.profile_picture_url}
                alt={agent.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                {initials(agent.full_name)}
              </span>
            )}
          </div>
        </div>

        {/* Name + designation */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
            {agent.full_name}
          </div>
          {agent.designation && (
            <div style={{
              fontSize: 9,
              color: accent.from,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginTop: 3,
            }}>
              {agent.designation}
              {agent.department ? ` · ${agent.department}` : ""}
            </div>
          )}
        </div>

        {/* ID chip row */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Chip label="EMP ID" value={agent.employee_id} accent={accent.from} />
          <Chip label="REF ID" value={agent.reference_id} accent={accent.to} />
        </div>

        {/* Info grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px" }}>
          {agent.phone_number && <InfoItem label="Phone" value={agent.phone_number} />}
          {agent.blood_group && <InfoItem label="Blood" value={agent.blood_group} />}
          {agent.joining_date && <InfoItem label="Joined" value={agent.joining_date} />}
          {agent.status && (
            <InfoItem
              label="Status"
              value={agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
            />
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 22,
        background: `linear-gradient(90deg, ${accent.from}22, ${accent.to}22)`,
        borderTop: `1px solid ${accent.from}33`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{
          fontSize: 7,
          color: "rgba(255,255,255,0.3)",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
        }}>
          AUTHORIZED PERSONNEL ONLY
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      background: `${accent}18`,
      border: `1px solid ${accent}40`,
      borderRadius: 6,
      padding: "2px 8px",
      display: "flex",
      flexDirection: "column",
    }}>
      <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", fontFamily: "monospace", letterSpacing: "0.05em" }}>
        {value}
      </span>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>
        {value}
      </div>
    </div>
  );
}

function getPrintStyles(isFemale: boolean) {
  const accent = isFemale
    ? { from: "#e91e8c", to: "#9b59b6", glow: "rgba(233,30,140,0.35)" }
    : { from: "#00c6ff", to: "#0062ff", glow: "rgba(0,98,255,0.35)" };

  return `
    .employee-card {
      background: linear-gradient(145deg, #0d1117 0%, #161b27 60%, #0d1117 100%);
      box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${accent.glow};
      border-radius: 16px;
      overflow: hidden;
      position: relative;
      width: 340px;
      height: 214px;
    }
  `;
}

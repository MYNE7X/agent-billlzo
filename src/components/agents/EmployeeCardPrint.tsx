/**
 * EmployeeCardPrint — print-ready employee ID card.
 * Premium design with Billzo branding, QR-style accent, and clean print output.
 * Prints on standard CR80 card stock (85.6mm × 54mm).
 */
import { useRef } from "react";
import { Printer, CreditCard, Phone, Droplet, Calendar, Briefcase } from "lucide-react";
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
      gap: 16px;
    }
    .print-card-wrapper { width: 380px; }
    @media print {
      body { background: white; padding: 0; }
      .print-card-wrapper { page-break-inside: avoid; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="print-card-wrapper"></div>
  <script>window.onload = () => { window.print(); window.close(); }<\/script>
</body>
</html>`);
    win.document.close();
    win.document.title = `Employee ID Card — ${agent.full_name}`;
    const wrapper = win.document.querySelector(".print-card-wrapper");
    if (wrapper) wrapper.innerHTML = printContents;
  };

  return (
    <div className="space-y-6">
      {/* Card preview */}
      <div ref={cardRef} className="mx-auto w-full max-w-sm">
        <EmployeeCard agent={agent} isFemale={isFemale} />
      </div>

      {/* Print button */}
      <div className="flex justify-center gap-3">
        <Button onClick={handlePrint} className="gap-2 px-8">
          <Printer className="size-4" />
          Print ID Card
        </Button>
      </div>

      {/* Hint */}
      <p className="text-center text-xs text-muted-foreground">
        <CreditCard className="inline size-3.5 mr-1 opacity-60" />
        Standard CR80 card size — print on card stock or laminate for best results.
      </p>
    </div>
  );
}

function EmployeeCard({ agent, isFemale }: { agent: Agent; isFemale: boolean }) {
  const accent = isFemale
    ? { from: "#ec4899", to: "#a855f7", glow: "rgba(236,72,153,0.3)", primary: "#ec4899" }
    : { from: "#06b6d4", to: "#3b82f6", glow: "rgba(6,182,212,0.3)", primary: "#06b6d4" };

  return (
    <div
      className="relative overflow-hidden rounded-2xl select-none"
      style={{
        background: "linear-gradient(145deg, #0a0f1c 0%, #121826 50%, #0a0f1c 100%)",
        boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px rgba(0,0,0,0.6), 0 0 50px ${accent.glow}`,
        width: "100%",
        aspectRatio: "1.586 / 1",
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      {/* Top gradient bar */}
      <div style={{ height: 5, background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }} />

      {/* Subtle grid texture */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)`,
        backgroundSize: "16px 16px",
      }} />

      {/* Glowing orbs */}
      <div style={{
        position: "absolute", top: -50, right: -50, width: 160, height: 160, borderRadius: "50%",
        background: `radial-gradient(circle, ${accent.glow} 0%, transparent 70%)`, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -40, left: -30, width: 120, height: 120, borderRadius: "50%",
        background: `radial-gradient(circle, ${accent.from}15 0%, transparent 70%)`, pointerEvents: "none",
      }} />

      {/* Content */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, position: "relative", height: "calc(100% - 5px)" }}>

        {/* Row 1: Logo + Brand */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/logo-mark.png" alt="Billzo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: "0.18em", textTransform: "uppercase" }}>
                BILLZO
              </div>
              <div style={{ fontSize: 7, color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", marginTop: 1 }}>
                OFFICE MANAGEMENT SYSTEM
              </div>
            </div>
          </div>
          {/* Status badge */}
          <div style={{
            fontSize: 7, fontWeight: 700, color: "#fff",
            background: agent.status === "active" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
            border: `1px solid ${agent.status === "active" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
            borderRadius: 10, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.1em",
          }}>
            {agent.status}
          </div>
        </div>

        {/* Row 2: Avatar + Name + Designation */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
          {/* Avatar */}
          <div style={{
            width: 52, height: 52, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            border: `2px solid ${accent.from}`,
            boxShadow: `0 0 10px ${accent.glow}`,
            background: `linear-gradient(135deg, ${accent.from}33, ${accent.to}33)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {agent.profile_picture_url ? (
              <SecureImage path={agent.profile_picture_url} alt={agent.full_name} className="w-full h-full object-cover" />
            ) : (
              <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{initials(agent.full_name)}</span>
            )}
          </div>
          {/* Name + designation */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {agent.full_name}
            </div>
            {(agent.designation || agent.department) && (
              <div style={{ fontSize: 8, color: accent.primary, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {agent.designation ?? ""}{agent.designation && agent.department ? " · " : ""}{agent.department ?? ""}
              </div>
            )}
          </div>
        </div>

        {/* Row 3: EMP ID + REF ID chips */}
        <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
          <Chip label="EMP ID" value={agent.employee_id} color={accent.from} />
          <Chip label="REF ID" value={agent.reference_id} color={accent.to} />
        </div>

        {/* Row 4: Info grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px", marginTop: 2 }}>
          {agent.phone_number && <InfoItem icon="phone" label="Phone" value={agent.phone_number} />}
          {agent.blood_group && <InfoItem icon="blood" label="Blood" value={agent.blood_group} />}
          {agent.joining_date && <InfoItem icon="calendar" label="Joined" value={formatDate(agent.joining_date) ?? agent.joining_date} />}
          {agent.cnic_number && <InfoItem icon="id" label="CNIC" value={agent.cnic_number} />}
        </div>

        {/* Bottom bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 20,
          background: `linear-gradient(90deg, ${accent.from}15, ${accent.to}15)`,
          borderTop: `1px solid ${accent.from}25`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 12px",
        }}>
          <span style={{ fontSize: 6.5, color: "rgba(255,255,255,0.25)", letterSpacing: "0.25em", textTransform: "uppercase" }}>
            AUTHORIZED PERSONNEL
          </span>
          <span style={{ fontSize: 6.5, color: accent.primary, letterSpacing: "0.15em", fontWeight: 600 }}>
            {new Date().getFullYear()} BILLZO
          </span>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: `${color}15`, border: `1px solid ${color}35`, borderRadius: 6,
      padding: "3px 8px", display: "flex", flexDirection: "column", minWidth: 0, flex: 1,
    }}>
      <span style={{ fontSize: 6, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", fontFamily: "monospace", letterSpacing: "0.05em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </span>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}:
      </span>
      <span style={{ fontSize: 8, color: "rgba(255,255,255,0.65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </span>
    </div>
  );
}

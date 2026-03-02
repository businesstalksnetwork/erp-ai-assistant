import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import QRCode from "qrcode";

interface LoyaltyCardPrintProps {
  member: {
    card_number?: string;
    first_name?: string;
    last_name?: string;
    current_tier?: string;
    points_balance?: number;
  };
}

const TIER_COLORS: Record<string, string> = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
  platinum: "#E5E4E2",
};

export function LoyaltyCardPrint({ member }: LoyaltyCardPrintProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    if (member.card_number) {
      QRCode.toDataURL(member.card_number, { width: 120, margin: 1 })
        .then(setQrDataUrl);
    }
  }, [member.card_number]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    // CR12-16: Normalize tier key to lowercase for color lookup
    const tier = (member.current_tier || "Bronze").toLowerCase();
    const tierColor = TIER_COLORS[tier] || TIER_COLORS.bronze;
    const name = `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Member";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Loyalty Card</title>
      <style>
        @page { size: 85.6mm 54mm; margin: 0; }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        .card {
          width: 85.6mm; height: 54mm;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, ${tierColor}33 100%);
          color: white; padding: 5mm; box-sizing: border-box;
          display: flex; flex-direction: column; justify-content: space-between;
          position: relative; overflow: hidden;
        }
        .card::before {
          content: ''; position: absolute; top: -20mm; right: -20mm;
          width: 60mm; height: 60mm; border-radius: 50%;
          background: ${tierColor}22;
        }
        .header { display: flex; justify-content: space-between; align-items: flex-start; }
        .brand { font-size: 14pt; font-weight: bold; letter-spacing: 1px; }
        .tier { font-size: 8pt; text-transform: uppercase; letter-spacing: 2px;
          background: ${tierColor}; color: #1a1a2e; padding: 1mm 3mm; border-radius: 2mm; font-weight: bold; }
        .body { display: flex; justify-content: space-between; align-items: flex-end; }
        .info { flex: 1; }
        .name { font-size: 11pt; font-weight: 600; margin-bottom: 1mm; }
        .card-num { font-size: 9pt; font-family: monospace; letter-spacing: 1.5px; opacity: 0.9; }
        .points { font-size: 7pt; opacity: 0.7; margin-top: 1mm; }
        .qr { width: 18mm; height: 18mm; }
        .qr img { width: 100%; height: 100%; border-radius: 1mm; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head>
      <body>
        <div class="card">
          <div class="header">
            <div class="brand">LOYALTY</div>
            <div class="tier">${tier}</div>
          </div>
          <div class="body">
            <div class="info">
              <div class="name">${name}</div>
              <div class="card-num">${member.card_number || ""}</div>
              <div class="points">${(member.points_balance || 0).toLocaleString()} points</div>
            </div>
            ${qrDataUrl ? `<div class="qr"><img src="${qrDataUrl}" alt="QR" /></div>` : ""}
          </div>
        </div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="mx-auto rounded-xl overflow-hidden shadow-lg" style={{ width: "323px", height: "204px", background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, ${TIER_COLORS[member.current_tier || "bronze"]}33 100%)` }}>
        <div className="p-4 h-full flex flex-col justify-between text-white">
          <div className="flex justify-between items-start">
            <span className="text-lg font-bold tracking-wider">LOYALTY</span>
            <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded font-bold" style={{ background: TIER_COLORS[member.current_tier || "bronze"], color: "#1a1a2e" }}>
              {member.current_tier || "bronze"}
            </span>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <div className="font-semibold">{`${member.first_name || ""} ${member.last_name || ""}`.trim() || "Member"}</div>
              <div className="font-mono text-sm opacity-90 tracking-wider">{member.card_number}</div>
              <div className="text-xs opacity-60 mt-0.5">{(member.points_balance || 0).toLocaleString()} points</div>
            </div>
            {qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-16 h-16 rounded" />}
          </div>
        </div>
      </div>

      <Button onClick={handlePrint} className="w-full">
        <Printer className="h-4 w-4 mr-2" />Print Card (85.6 × 54mm)
      </Button>
    </div>
  );
}

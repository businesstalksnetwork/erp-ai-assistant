import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

interface KPOEntry {
  id: string;
  ordinal_number: number;
  description: string;
  products_amount: number;
  services_amount: number;
  total_amount: number;
}

interface KPOPdfExportProps {
  entries: KPOEntry[];
  totals: { products: number; services: number; total: number };
  year: number;
  companyName: string;
  companyPib: string;
  companyAddress: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function KPOPdfExport({ entries, totals, year, companyName, companyPib, companyAddress }: KPOPdfExportProps) {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Molimo dozvolite pop-up prozore za štampanje');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="sr">
      <head>
        <meta charset="UTF-8">
        <title>KPO Knjiga ${year} - ${companyName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Times New Roman', Times, serif; 
            font-size: 11pt;
            line-height: 1.4;
            padding: 15mm;
            color: #000;
          }
          .header { 
            text-align: center; 
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
          }
          .header h1 { 
            font-size: 16pt; 
            font-weight: bold;
            margin-bottom: 5px;
          }
          .header h2 { 
            font-size: 14pt; 
            font-weight: normal;
            margin-bottom: 10px;
          }
          .company-info {
            font-size: 10pt;
            margin-top: 10px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 15px;
            font-size: 10pt;
          }
          th, td { 
            border: 1px solid #000; 
            padding: 6px 8px;
            text-align: left;
          }
          th { 
            background-color: #f0f0f0;
            font-weight: bold;
            text-align: center;
          }
          .number { text-align: center; width: 50px; }
          .amount { text-align: right; width: 100px; font-family: 'Courier New', monospace; }
          .description { text-align: left; }
          .footer-row { 
            font-weight: bold; 
            background-color: #f0f0f0;
          }
          .total-row {
            font-weight: bold;
            background-color: #e0e0e0;
            font-size: 11pt;
          }
          .signature-section {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            text-align: center;
            width: 200px;
          }
          .signature-line {
            border-top: 1px solid #000;
            margin-top: 50px;
            padding-top: 5px;
            font-size: 9pt;
          }
          .print-date {
            margin-top: 30px;
            font-size: 9pt;
            text-align: right;
          }
          @media print {
            body { padding: 10mm; }
            @page { size: A4; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>KNJIGA O OSTVARENOM PROMETU PAUŠALNOG OBVEZNIKA</h1>
          <h2>KPO - ${year}. godina</h2>
          <div class="company-info">
            <strong>${companyName}</strong><br>
            ${companyAddress}<br>
            PIB: ${companyPib}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="number">R.br.</th>
              <th class="description">Opis dobara, odnosno usluga</th>
              <th class="amount">Proizvodi (RSD)</th>
              <th class="amount">Usluge (RSD)</th>
              <th class="amount">Ukupno (RSD)</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(entry => `
              <tr>
                <td class="number">${entry.ordinal_number}</td>
                <td class="description">${entry.description}</td>
                <td class="amount">${entry.products_amount > 0 ? formatCurrency(entry.products_amount) : '-'}</td>
                <td class="amount">${entry.services_amount > 0 ? formatCurrency(entry.services_amount) : '-'}</td>
                <td class="amount">${formatCurrency(entry.total_amount)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="2" style="text-align: right;">UKUPNO:</td>
              <td class="amount">${formatCurrency(totals.products)}</td>
              <td class="amount">${formatCurrency(totals.services)}</td>
              <td class="amount">${formatCurrency(totals.total)}</td>
            </tr>
          </tbody>
        </table>

        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line">M.P.</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">Potpis odgovornog lica</div>
          </div>
        </div>

        <div class="print-date">
          Datum štampanja: ${new Date().toLocaleDateString('sr-Latn-RS')}
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <Button onClick={handlePrint} variant="outline" disabled={entries.length === 0}>
      <FileText className="mr-2 h-4 w-4" />
      Štampaj PDF
    </Button>
  );
}

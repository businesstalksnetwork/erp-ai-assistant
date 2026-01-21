import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { KPOEntry } from '@/hooks/useKPO';

interface Props {
  entries: KPOEntry[];
  totals: { products: number; services: number; total: number };
  year: number;
  companyName: string;
}

export function KPOCsvExport({ entries, totals, year, companyName }: Props) {
  const handleExport = () => {
    const headers = ['R.br.', 'Datum', 'Opis', 'Proizvodi (RSD)', 'Usluge (RSD)', 'Ukupno (RSD)'];
    
    const rows = entries.map(entry => [
      entry.display_ordinal,
      entry.document_date || '',
      `"${entry.description.replace(/"/g, '""')}"`,
      entry.products_amount.toFixed(2),
      entry.services_amount.toFixed(2),
      entry.total_amount.toFixed(2),
    ]);
    
    // Dodaj red sa ukupnim sumama
    rows.push(['', '', 'UKUPNO', totals.products.toFixed(2), totals.services.toFixed(2), totals.total.toFixed(2)]);
    
    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    
    // Preuzmi sa BOM za UTF-8 podršku u Excel-u
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `KPO_${companyName.replace(/\s+/g, '_')}_${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button onClick={handleExport} variant="outline" disabled={entries.length === 0}>
      <Download className="mr-2 h-4 w-4" />
      CSV
    </Button>
  );
}

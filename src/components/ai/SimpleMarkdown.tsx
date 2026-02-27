import React from "react";

function applyInlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

function parseTableRows(lines: string[], startIdx: number): { rows: string[][]; endIdx: number } {
  const rows: string[][] = [];
  let idx = startIdx;
  while (idx < lines.length && lines[idx].trim().startsWith("|")) {
    const line = lines[idx].trim();
    // Skip separator rows (|---|---|)
    if (/^\|[\s\-:]+\|/.test(line) && !line.replace(/[\s|\-:]/g, "").length) {
      idx++;
      continue;
    }
    const cells = line.split("|").slice(1, -1).map(c => c.trim());
    if (cells.length > 0) rows.push(cells);
    idx++;
  }
  return { rows, endIdx: idx };
}

export function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const cls = level === 1 ? "text-xs font-bold" : level === 2 ? "text-xs font-semibold" : "text-[11px] font-semibold";
      elements.push(<p key={i} className={`${cls} mt-1.5 mb-0.5`}>{applyInlineBold(headingMatch[2])}</p>);
      i++;
      continue;
    }

    // Table (markdown pipe tables)
    if (line.trim().startsWith("|")) {
      const { rows, endIdx } = parseTableRows(lines, i);
      if (rows.length >= 2) {
        const header = rows[0];
        const body = rows.slice(1);
        elements.push(
          <div key={`tbl-${i}`} className="overflow-x-auto my-1.5">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {header.map((h, hi) => (
                    <th key={hi} className="text-left font-semibold px-1.5 py-1 text-muted-foreground">{applyInlineBold(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} className="border-b border-border/50 last:border-0">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-1.5 py-1">{applyInlineBold(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        i = endIdx;
        continue;
      }
      // Fallback: not enough rows for a table
      i++;
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^[\*\-]\s+(.+)/);
    if (bulletMatch) {
      const items: React.ReactNode[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^[\*\-]\s+(.+)/);
        if (!m) break;
        items.push(<li key={i} className="ml-3 list-disc">{applyInlineBold(m[1])}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`} className="space-y-0.5 my-0.5">{items}</ul>);
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^\d+\.\s+(.+)/);
    if (numMatch) {
      const items: React.ReactNode[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\d+\.\s+(.+)/);
        if (!m) break;
        items.push(<li key={i} className="ml-3 list-decimal">{applyInlineBold(m[1])}</li>);
        i++;
      }
      elements.push(<ol key={`ol-${i}`} className="space-y-0.5 my-0.5">{items}</ol>);
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-1" />);
      i++;
      continue;
    }

    // Normal paragraph
    elements.push(<p key={i} className="my-0.5">{applyInlineBold(line)}</p>);
    i++;
  }

  return <div className="space-y-0">{elements}</div>;
}

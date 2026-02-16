import React from "react";

function applyInlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>
  );
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

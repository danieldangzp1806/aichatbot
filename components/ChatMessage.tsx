import React from 'react';
import { Message, GroundingChunk } from '../types';
import { ExternalLink, CheckCircle2 } from 'lucide-react';

interface DetailRendererProps {
  message: Message;
  compact?: boolean;
}

const DetailRenderer: React.FC<DetailRendererProps> = ({ message, compact }) => {
  const parseInlineBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <span key={j} className="font-semibold text-z-deep-teal">{part.replace(/\*\*/g, '')}</span>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={j} className="px-1.5 py-0.5 bg-z-light-green/50 text-z-deep-teal rounded font-mono text-xs">{part.replace(/`/g, '')}</code>;
      }
      return part;
    });
  };

  // Sanitizes sections (removes Active Ingredient section) and enforces requested order:
  // WHO ATC Code -> Packaging -> Standard Dosage -> License
  const sanitizeAndOrderSections = (rawText: string): string => {
    if (!rawText.includes('## ')) return rawText;

    const rawSections = rawText.split(/(?=^##\s)/m);
    
    // Filter out "Master Data Disambiguation & Active Ingredient (INN)"
    const filteredSections = rawSections.filter(section => {
      const headerLine = (section.split('\n')[0] || '').toLowerCase();
      if (
        headerLine.includes('master data disambiguation') ||
        headerLine.includes('active ingredient')
      ) {
        return false;
      }
      return true;
    });

    // Desired priority order:
    // 1: WHO ATC Code
    // 2: Packaging
    // 3: Standard Dosage
    // 4: License / Manufacturer
    const getOrderPriority = (section: string): number => {
      const headerLine = (section.split('\n')[0] || '').toLowerCase();
      if (headerLine.includes('atc')) return 1;
      if (headerLine.includes('packaging')) return 2;
      if (headerLine.includes('dosage') || headerLine.includes('dosing')) return 3;
      if (
        headerLine.includes('license') || 
        headerLine.includes('licensing') || 
        headerLine.includes('manufacturer')
      ) return 4;
      return 5;
    };

    const intro: string[] = [];
    const mainSections: string[] = [];

    filteredSections.forEach(sec => {
      if (sec.trim().startsWith('## ')) {
        mainSections.push(sec);
      } else {
        intro.push(sec);
      }
    });

    mainSections.sort((a, b) => getOrderPriority(a) - getOrderPriority(b));

    return [...intro, ...mainSections].join('\n\n').trim();
  };

  // Enhanced Markdown parser for headers, lists, and tables
  const formatText = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableRows: string[][] = [];

    const flushTable = (keyPrefix: number) => {
      if (tableRows.length > 0) {
        const header = tableRows[0];
        const body = tableRows.slice(1);
        elements.push(
          <div key={`table-${keyPrefix}`} className="my-6 overflow-x-auto rounded-xl border border-z-light-green bg-white shadow-sm">
            <table className="min-w-full divide-y divide-z-light-green text-sm">
              <thead className="bg-z-light-green/30">
                <tr>
                  {header.map((col, idx) => (
                    <th key={idx} className="px-4 py-3 text-left font-semibold text-z-deep-teal uppercase text-xs tracking-wider">
                      {col.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {body.map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-z-ivory/50'}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-4 py-3 text-slate-700 whitespace-normal">
                        {parseInlineBold(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
      inTable = false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for markdown table row
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        inTable = true;
        if (!line.includes('---')) {
          const cells = line.split('|').slice(1, -1);
          tableRows.push(cells);
        }
        continue;
      } else if (inTable) {
        flushTable(i);
      }

      // Headers - Using Z Deep Teal
      if (line.startsWith('## ')) {
        const marginClass = compact ? 'mt-6 mb-3' : 'mt-10 mb-4';
        elements.push(
          <h3 key={i} className={`text-xl font-bold text-z-deep-teal ${marginClass} border-b border-z-light-green pb-2.5 pt-2 first:mt-0`}>
            {line.replace('## ', '')}
          </h3>
        );
        continue;
      }

      if (line.startsWith('### ')) {
        const marginClass = compact ? 'mt-4 mb-2' : 'mt-6 mb-3';
        elements.push(
          <h4 key={i} className={`text-lg font-semibold text-z-deep-teal ${marginClass} first:mt-0`}>
            {line.replace('### ', '')}
          </h4>
        );
        continue;
      }

      // Bold titles or key-value headers
      if (line.startsWith('**') && line.endsWith('**')) {
        elements.push(
          <p key={i} className="font-bold text-z-deep-teal mt-4 mb-2">
            {line.replace(/\*\*/g, '')}
          </p>
        );
        continue;
      }

      // Bullet points
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        elements.push(
          <li key={i} className="ml-5 list-disc text-slate-700 mb-2 pl-2 marker:text-z-green leading-relaxed text-sm sm:text-base">
            {parseInlineBold(line.replace(/^[\*\-]\s/, ''))}
          </li>
        );
        continue;
      }

      // Numbered lists
      const numberedMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
      if (numberedMatch) {
        elements.push(
          <div key={i} className="ml-2 flex items-start gap-2.5 text-slate-700 mb-2 leading-relaxed text-sm sm:text-base">
            <span className="font-semibold text-z-green min-w-[20px]">{numberedMatch[1]}.</span>
            <div>{parseInlineBold(numberedMatch[2])}</div>
          </div>
        );
        continue;
      }

      // Blank line
      if (line.trim() === '') {
        elements.push(<div key={i} className="h-3"></div>);
        continue;
      }

      // Regular paragraph
      elements.push(
        <p key={i} className="text-slate-700 leading-relaxed mb-3 text-sm sm:text-base">
          {parseInlineBold(line)}
        </p>
      );
    }

    if (inTable) {
      flushTable(lines.length);
    }

    return elements;
  };

  const processedText = sanitizeAndOrderSections(message.text);
  const groundingChunks = message.groundingMetadata?.groundingChunks;

  return (
    <div className="w-full">
      <div className={`prose prose-slate max-w-none ${compact ? 'prose-sm' : ''}`}>
        {formatText(processedText)}
      </div>

      {/* Grounding Sources - Shown in Dashboard mode */}
      {!compact && groundingChunks && groundingChunks.length > 0 && (
        <div className="mt-12 pt-8 border-t border-z-light-green">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="bg-z-light-green p-1.5 rounded-full">
                <CheckCircle2 size={16} className="text-z-deep-teal" />
              </div>
              <span className="text-sm font-bold text-z-deep-teal uppercase tracking-wide">
                Grounding & Verification Sources ({groundingChunks.filter(c => c.web?.uri).length})
              </span>
            </div>
            <span className="text-xs text-slate-400">Real-time Verified Data</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {groundingChunks.map((chunk: GroundingChunk, idx: number) => {
              if (!chunk.web?.uri) return null;
              let hostname = "";
              try {
                hostname = new URL(chunk.web.uri).hostname;
              } catch (e) {
                hostname = "external source";
              }

              return (
                <a
                  key={idx}
                  href={chunk.web.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3.5 p-3.5 rounded-xl bg-white border border-z-light-green hover:border-z-green hover:bg-z-ivory transition-all duration-200 shadow-2xs hover:shadow-xs"
                >
                  <div className="mt-0.5 bg-z-light-green/30 p-2 rounded-lg border border-z-light-green group-hover:border-z-green/50 transition-colors">
                    <ExternalLink size={14} className="text-z-deep-teal/70 group-hover:text-z-deep-teal" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-z-deep-teal truncate group-hover:text-z-green transition-colors">
                      {chunk.web.title || "Regulatory Document / Product Monograph"}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5 font-mono">
                      {hostname}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailRenderer;
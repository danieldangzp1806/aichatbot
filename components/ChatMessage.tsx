import React from 'react';
import { Message, GroundingChunk } from '../types';
import { ExternalLink, CheckCircle2 } from 'lucide-react';

interface DetailRendererProps {
  message: Message;
  compact?: boolean;
}

const DetailRenderer: React.FC<DetailRendererProps> = ({ message, compact }) => {
  // Simple Markdown-like parser for headers and lists
  const formatText = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Headers - Using Z Deep Teal - Increased Spacing
      // Added first:mt-0 to remove top margin if it's the first element
      if (line.startsWith('## ')) {
        const marginClass = compact ? 'mt-6 mb-3' : 'mt-12 mb-6';
        return <h3 key={i} className={`text-xl font-bold text-z-deep-teal ${marginClass} border-b border-z-light-green pb-3 pt-4 first:mt-0`}>{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('### ')) {
        const marginClass = compact ? 'mt-4 mb-2' : 'mt-8 mb-3';
        return <h4 key={i} className={`text-lg font-semibold text-z-deep-teal ${marginClass} first:mt-0`}>{line.replace('### ', '')}</h4>;
      }
      // Bold list items usually
      if (line.startsWith('**') && line.endsWith('**')) {
         return <p key={i} className="font-bold text-z-deep-teal mt-4 mb-2">{line.replace(/\*\*/g, '')}</p>;
      }
      // Bullet points
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        return (
          <li key={i} className="ml-5 list-disc text-slate-700 mb-2 pl-2 marker:text-z-green leading-relaxed">
            {parseInlineBold(line.replace(/^[\*\-]\s/, ''))}
          </li>
        );
      }
      
      // Regular paragraphs
      if (line.trim() === '') return <div key={i} className="h-4"></div>;
      
      return (
        <p key={i} className="text-slate-700 leading-relaxed mb-4 text-base">
          {parseInlineBold(line)}
        </p>
      );
    });
  };

  const parseInlineBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <span key={j} className="font-semibold text-z-deep-teal">{part.replace(/\*\*/g, '')}</span>;
      }
      return part;
    });
  };

  return (
    <div className="w-full">
      <div className={`prose prose-slate max-w-none ${compact ? 'prose-sm' : ''}`}>
         {formatText(message.text)}
      </div>

      {/* Grounding Sources - Only shown in Dashboard mode (not compact) */}
      {!compact && message.groundingMetadata?.groundingChunks && message.groundingMetadata.groundingChunks.length > 0 && (
        <div className="mt-12 pt-8 border-t border-z-light-green">
          <div className="flex items-center gap-2 mb-6">
            <div className="bg-z-light-green p-1.5 rounded-full">
              <CheckCircle2 size={16} className="text-z-deep-teal" />
            </div>
            <span className="text-sm font-bold text-z-deep-teal uppercase tracking-wide">Information Sources</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {message.groundingMetadata.groundingChunks.map((chunk: GroundingChunk, idx: number) => {
              if (!chunk.web?.uri) return null;
              return (
                <a
                  key={idx}
                  href={chunk.web.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-4 p-4 rounded-xl bg-white border border-z-light-green hover:border-z-green hover:bg-z-ivory transition-all duration-200"
                >
                  <div className="mt-0.5 bg-z-light-green/30 p-2 rounded-lg border border-z-light-green group-hover:border-z-green/50 transition-colors">
                    <ExternalLink size={14} className="text-z-deep-teal/60 group-hover:text-z-deep-teal" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-z-deep-teal truncate group-hover:text-z-green transition-colors">
                      {chunk.web.title || "External Source"}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-1">
                      {new URL(chunk.web.uri).hostname}
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
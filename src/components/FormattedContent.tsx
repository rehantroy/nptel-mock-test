import React, { useMemo } from 'react';
import katex from 'katex';

interface FormattedContentProps {
  content: string;
  className?: string;
}

/**
 * Renders question and option text preserving:
 * - Subscripts and superscripts (e.g. CO2 -> CO₂, x^2 -> x², or <sub>/<sup>)
 * - Greek symbols (μ, λ, Ω, Δ, etc.)
 * - Inline LaTeX math via KaTeX ($...$ or $$...$$)
 * - Bold (**text**), Italic (*text*), and code (`text`)
 * - Paragraphs and clean line breaks
 */
export const FormattedContent: React.FC<FormattedContentProps> = ({
  content,
  className = '',
}) => {
  const renderedHtml = useMemo(() => {
    if (!content) return '';

    let text = content;

    // 1. Process LaTeX Math expressions ($...$ and $$...$$)
    // Replace block math $$...$$
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        return `$$${math}$$`;
      }
    });

    // Replace inline math $...$
    text = text.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return `$${math}$`;
      }
    });

    // 2. Format common chemical / scientific formulas without math delimiters
    // e.g., CO2 -> CO₂, H2O -> H₂O, SO4 -> SO₄, O2 -> O₂
    text = text.replace(/\b(CO|H2O|SO|NO|O|N|CH|NH)(2|3|4)\b/g, (match, prefix, num) => {
      const subMap: Record<string, string> = { '2': '₂', '3': '₃', '4': '₄' };
      return `${prefix}${subMap[num] || num}`;
    });

    // 3. Format superscripts like x^2, m^3, 10^-3, cm^2
    text = text.replace(/([a-zA-Z0-9])\^([0-9\-]+)/g, (_, base, exp) => {
      const supMap: Record<string, string> = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
        '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻'
      };
      const convertedExp = exp.split('').map((c: string) => supMap[c] || c).join('');
      return `${base}${convertedExp}`;
    });

    // 4. Basic Markdown: bold, italic, code
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^\*\n]+?)\*/g, '<em>$1</em>');
    text = text.replace(/`([^`\n]+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-sm font-mono">$1</code>');

    // 5. Preserving linebreaks into paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    const html = paragraphs
      .map((p) => {
        const clean = p.trim().replace(/\n/g, '<br />');
        return clean ? `<p class="mb-2 last:mb-0 leading-relaxed">${clean}</p>` : '';
      })
      .join('');

    return html;
  }, [content]);

  return (
    <div
      className={`question-content text-slate-900 ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};

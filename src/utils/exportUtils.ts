import { ExtractionResult } from '../types';

/**
 * Copies plain text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy text:', err);
    return false;
  }
}

/**
 * Formats script into plain text for export or clipboard
 */
export function formatScriptAsText(
  result: ExtractionResult,
  mode: 'vietnamese' | 'chinese' | 'bilingual' | 'timestamps'
): string {
  const lines: string[] = [];

  if (result.isVietnamese) {
    // Vietnamese video
    if (mode === 'timestamps') {
      result.segments.forEach((seg) => {
        lines.push(`${seg.timestamp} ${seg.originalText}`);
      });
    } else {
      lines.push(result.fullOriginalScript);
    }
  } else {
    // Chinese or foreign video
    if (mode === 'chinese') {
      result.segments.forEach((seg) => {
        lines.push(`${seg.timestamp} ${seg.originalText}`);
      });
    } else if (mode === 'vietnamese') {
      result.segments.forEach((seg) => {
        lines.push(`${seg.timestamp} ${seg.translatedText || seg.originalText}`);
      });
    } else {
      // Bilingual
      result.segments.forEach((seg) => {
        lines.push(`${seg.timestamp}`);
        lines.push(`🇨🇳 Gốc: ${seg.originalText}`);
        lines.push(`🇻🇳 Dịch: ${seg.translatedText || seg.originalText}`);
        lines.push('');
      });
    }
  }

  return lines.join('\n').trim();
}

/**
 * Generates standard .SRT subtitle file
 */
export function generateSrtContent(result: ExtractionResult, language: 'vi' | 'zh'): string {
  const formatSrtTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  };

  const srtBlocks: string[] = [];

  result.segments.forEach((seg, index) => {
    const startStr = formatSrtTime(seg.startSec);
    const endStr = formatSrtTime(seg.endSec || seg.startSec + 4);
    const text = language === 'zh' ? seg.originalText : (seg.translatedText || seg.originalText);

    srtBlocks.push(`${index + 1}\n${startStr} --> ${endStr}\n${text}\n`);
  });

  return srtBlocks.join('\n');
}

/**
 * Downloads text or subtitle file directly
 */
export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

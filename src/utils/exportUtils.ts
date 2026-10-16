import { ExtractionResult } from '../types';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
} from 'docx';

/**
 * Encodes AudioBuffer into a lightweight WAV blob (16-bit PCM mono/stereo)
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(buffer.numberOfChannels, 2);
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  let samples: Float32Array;
  if (numChannels === 2) {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    samples = new Float32Array(left.length + right.length);
    for (let i = 0; i < left.length; i++) {
      samples[i * 2] = left[i];
      samples[i * 2 + 1] = right[i];
    }
  } else {
    samples = buffer.getChannelData(0);
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const bufferLength = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF identifier
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Extracts and compresses audio track from heavy video file directly inside the browser
 * Reduces upload payload from >100MB to ~2-3MB instantly.
 */
export async function extractAudioFromVideoInBrowser(file: File): Promise<File> {
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|mkv|webm|avi)$/i.test(file.name);
  if (!isVideo || file.size <= 20 * 1024 * 1024) {
    return file;
  }

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return file;

    const audioCtx = new AudioContextClass();
    const arrayBuffer = await file.arrayBuffer();
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const wavBlob = audioBufferToWav(decodedBuffer);
    audioCtx.close().catch(() => {});

    const newFileName = file.name.replace(/\.[^/.]+$/, '') + '_audio.wav';
    return new File([wavBlob], newFileName, { type: 'audio/wav' });
  } catch (err) {
    console.warn('[Client Audio Extraction] Browser decode fallback to original file:', err);
    return file;
  }
}

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
 * If video is a multi-speaker dialogue, outputs clean bulleted conversation lines:
 *   - Lời thoại 1
 *   - Lời thoại 2
 * If single speaker / monologue, outputs natural prose paragraphs.
 */
export function formatScriptAsText(
  result: ExtractionResult,
  mode: 'vietnamese' | 'chinese' | 'bilingual' | 'timestamps'
): string {
  const lines: string[] = [];
  const segments = result.segments || [];

  if (mode === 'timestamps') {
    segments.forEach((seg) => {
      const trans = seg.translatedText || seg.vietnameseTranslation || seg.originalText;
      const text = result.isVietnamese ? seg.originalText : trans;
      lines.push(`${seg.timestamp} ${text}`);
    });
    return lines.join('\n').trim();
  }

  // Detect whether video is a dialogue between multiple speakers
  const distinctSpeakers = Array.from(
    new Set(segments.map((s) => s.speaker?.trim()).filter(Boolean))
  );
  const isDialogue = distinctSpeakers.length > 1;

  if (result.isVietnamese) {
    // Vietnamese video
    if (isDialogue) {
      // Clean bulleted dialogue:
      // - Câu nói của người 1
      // - Câu nói của người 2
      segments.forEach((seg) => {
        lines.push(`- ${seg.originalText.trim()}`);
      });
    } else {
      // Natural prose paragraph
      lines.push(result.fullOriginalScript || segments.map((s) => s.originalText.trim()).join(' '));
    }
  } else {
    // Foreign / Chinese video
    if (mode === 'chinese') {
      if (isDialogue) {
        segments.forEach((seg) => {
          lines.push(`- ${seg.originalText.trim()}`);
        });
      } else {
        lines.push(result.fullOriginalScript || segments.map((s) => s.originalText.trim()).join(' '));
      }
    } else if (mode === 'vietnamese') {
      // Vietnamese translation only
      if (isDialogue) {
        segments.forEach((seg) => {
          const trans = seg.translatedText || seg.vietnameseTranslation || seg.originalText;
          lines.push(`- ${trans.trim()}`);
        });
      } else {
        const fullVi = result.fullTranslatedScript || result.fullVietnameseScript;
        lines.push(fullVi || segments.map((s) => s.translatedText || s.vietnameseTranslation || s.originalText).join(' '));
      }
    } else {
      // Bilingual
      if (isDialogue) {
        segments.forEach((seg) => {
          const trans = seg.translatedText || seg.vietnameseTranslation || seg.originalText;
          lines.push(`- ${seg.originalText.trim()}`);
          lines.push(`  (${trans.trim()})`);
        });
      } else {
        segments.forEach((seg) => {
          const trans = seg.translatedText || seg.vietnameseTranslation || seg.originalText;
          lines.push(`🇨🇳 Gốc: ${seg.originalText.trim()}`);
          lines.push(`🇻🇳 Dịch: ${trans.trim()}`);
          lines.push('');
        });
      }
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
    const text = language === 'zh'
      ? seg.originalText
      : (seg.translatedText || seg.vietnameseTranslation || seg.originalText);

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

/**
 * Generates and downloads standard formatted Word (.docx) document
 */
export async function exportDocxFile(
  result: ExtractionResult,
  mode: 'vietnamese' | 'chinese' | 'bilingual' = 'bilingual'
) {
  const isVi = result.isVietnamese || mode === 'vietnamese';

  const tableHeaders = isVi
    ? ['STT', 'Mốc Thời Gian', 'Lời Thoại Kịch Bản']
    : mode === 'chinese'
    ? ['STT', 'Mốc Thời Gian', 'Kịch Bản Gốc (Tiếng Trung)']
    : ['STT', 'Thời Gian', 'Kịch Bản Gốc (Tiếng Trung)', 'Bản Dịch Tiếng Việt'];

  const headerCells = tableHeaders.map((text, idx) => {
    let width = 40;
    if (isVi || mode === 'chinese') {
      if (idx === 0) width = 10;
      else if (idx === 1) width = 25;
      else width = 65;
    } else {
      if (idx === 0) width = 8;
      else if (idx === 1) width = 18;
      else if (idx === 2) width = 37;
      else width = 37;
    }

    return new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      shading: { fill: 'F3E8FF' },
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true, color: '4A154B' })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    });
  });

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: headerCells,
    }),
  ];

  result.segments.forEach((seg, index) => {
    const translation = seg.translatedText || seg.vietnameseTranslation || seg.originalText;
    const cells: TableCell[] = [];

    // Cell 1: Index
    cells.push(
      new TableCell({
        children: [new Paragraph({ text: String(index + 1), alignment: AlignmentType.CENTER })],
      })
    );

    // Cell 2: Timestamp
    cells.push(
      new TableCell({
        children: [new Paragraph({ text: seg.timestamp, alignment: AlignmentType.CENTER })],
      })
    );

    if (isVi) {
      cells.push(
        new TableCell({
          children: [new Paragraph({ text: seg.originalText })],
        })
      );
    } else if (mode === 'chinese') {
      cells.push(
        new TableCell({
          children: [new Paragraph({ text: seg.originalText })],
        })
      );
    } else {
      // Bilingual
      cells.push(
        new TableCell({
          children: [new Paragraph({ text: seg.originalText })],
        })
      );
      cells.push(
        new TableCell({
          children: [new Paragraph({ text: translation })],
        })
      );
    }

    rows.push(new TableRow({ children: cells }));
  });

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      text: result.videoMetadata.title || 'Kịch Bản Video',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Nền tảng: ', bold: true }),
        new TextRun({ text: `${result.videoMetadata.platform.toUpperCase()}  |  ` }),
        new TextRun({ text: 'Ngôn ngữ: ', bold: true }),
        new TextRun({ text: `${result.sourceLanguageName}  |  ` }),
        new TextRun({ text: 'Thời lượng: ', bold: true }),
        new TextRun({ text: `~${result.videoMetadata.duration || 30}s` }),
      ],
      spacing: { after: 120 },
    }),
  ];

  if (result.summary) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Tóm tắt nội dung: ', bold: true, color: '6B21A8' }),
          new TextRun({ text: result.summary, italics: true }),
        ],
        spacing: { after: 100 },
      })
    );
  }

  if (result.toneAndStyle) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Phong cách / Giọng điệu: ', bold: true, color: '6B21A8' }),
          new TextRun({ text: result.toneAndStyle }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  children.push(
    new Paragraph({
      text: 'BẢNG KỊCH BẢN CHI TIẾT THEO TIMESTAMP',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 150 },
    })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeTitle = (result.videoMetadata.title || 'video')
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()
    .substring(0, 25);
  const filename = `kich_ban_${result.videoMetadata.platform}_${safeTitle}.docx`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

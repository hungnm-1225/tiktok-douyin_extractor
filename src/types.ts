export interface ScriptSegment {
  id: string;
  timestamp: string; // e.g. "[00:00 - 00:05]"
  startSec: number;
  endSec: number;
  originalText: string;
  translatedText?: string;
}

export interface VideoMetadata {
  url: string;
  platform: 'tiktok' | 'douyin' | 'upload' | 'sample';
  title: string;
  author?: string;
  duration?: number;
  coverImage?: string;
}

export interface ExtractionResult {
  id: string;
  createdAt: number;
  videoMetadata: VideoMetadata;
  segments: ScriptSegment[];
  fullOriginalScript: string;
  fullTranslatedScript?: string;
  sourceLanguage: 'vi' | 'zh' | 'en' | 'other' | string;
  sourceLanguageName: string; // e.g. "Tiếng Việt", "Tiếng Trung (Douyin)"
  isVietnamese: boolean;
  cleanedUpTempFiles: boolean;
}

export interface SampleVideoItem {
  id: string;
  platform: 'tiktok' | 'douyin';
  title: string;
  niche: string;
  description: string;
  url: string;
  badge: string;
  sampleResult: Partial<ExtractionResult>;
}

# 🌸 TikTok & Douyin Script AI — Tài Liệu Kỹ Thuật Toàn Diện

> **Dành riêng cho Hoàng Hồng Hạnh** ✨  
> Web App tự động bóc tách kịch bản (script) từ video TikTok & Douyin, hỗ trợ song ngữ Tiếng Việt – Tiếng Trung với timestamp chính xác, tích hợp **Gemini AI** của Google.

---

## 📌 Mục Lục

1. [Tổng Quan Dự Án](#1-tổng-quan-dự-án)
2. [Tech Stack](#2-tech-stack)
3. [Cấu Trúc Thư Mục](#3-cấu-trúc-thư-mục)
4. [Kiến Trúc Hệ Thống](#4-kiến-trúc-hệ-thống)
5. [Chi Tiết Từng File](#5-chi-tiết-từng-file)
6. [Luồng Dữ Liệu (Data Flow)](#6-luồng-dữ-liệu-data-flow)
7. [API Endpoints](#7-api-endpoints)
8. [TypeScript Types Chính](#8-typescript-types-chính)
9. [Cài Đặt & Chạy Dự Án](#9-cài-đặt--chạy-dự-án)
10. [Môi Trường Biến & Config](#10-môi-trường-biến--config)
11. [Deploy lên Vercel](#11-deploy-lên-vercel)
12. [Các Điểm Quan Trọng Cần Lưu Ý](#12-các-điểm-quan-trọng-cần-lưu-ý)

---

## 1. Tổng Quan Dự Án

**TikTok & Douyin Script AI** là một web application full-stack cho phép người dùng:

- **Dán link TikTok hoặc Douyin** → tự động tải video/audio về server → gửi cho Gemini AI phân tích → trả về kịch bản có timestamp
- **Tải file MP4/MP3 trực tiếp** từ máy tính lên để bóc tách
- **Xem kịch bản song ngữ** Tiếng Trung gốc + Bản dịch Tiếng Việt (cho video Douyin) hoặc chỉ Tiếng Việt (TikTok)
- **Xuất kết quả** ra file `.TXT` hoặc file phụ đề `.SRT` chuẩn (CapCut / Premiere)
- **Xem lại lịch sử** 5 video gần nhất (lưu trong LocalStorage của trình duyệt)

**Hai chế độ deploy:**

| Môi trường | Cách chạy | File server |
|---|---|---|
| Development (local) | `npm run dev` | `server.ts` → `server/app.ts` |
| Production (Vercel) | Deploy → Serverless | `api/*.ts` (Vercel Functions) |

---

## 2. Tech Stack

### Frontend

| Thư Viện | Phiên Bản | Vai Trò |
|---|---|---|
| **React** | `^19.0.1` | UI framework chính |
| **TypeScript** | `~5.8.2` | Type safety toàn app |
| **Vite** | `^6.2.3` | Build tool, Dev server HMR |
| **Tailwind CSS v4** | `^4.1.14` | Styling (plugin `@tailwindcss/vite`, syntax v4) |
| **lucide-react** | `^0.546.0` | Icon components |
| **motion** | `^12.23.24` | Animation library |
| **canvas-confetti** | `^1.9.4` | Hiệu ứng confetti khi bóc tách thành công |
| **Google Fonts** | Quicksand + Nunito | Typography (load qua `<link>` trong `index.html`) |

### Backend

| Thư Viện | Phiên Bản | Vai Trò |
|---|---|---|
| **Express** | `^4.21.2` | HTTP server (dev mode) |
| **@google/genai** | `^2.4.0` | Gemini AI SDK chính thức |
| **yt-dlp** | Binary tải runtime | Fallback download video (strategy 3, chỉ dev) |
| **docx** | `^9.7.1` | Xuất file Word (có trong dependencies, chưa dùng trong UI) |
| **dotenv** | `^17.2.3` | Đọc biến môi trường từ `.env` |

### Dev Tools

| Công Cụ | Vai Trò |
|---|---|
| **tsx** | Chạy TypeScript trực tiếp không cần compile (dev server) |
| **esbuild** | Bundle `server.ts` → `dist/server.cjs` cho production |
| **@vercel/node** | Vercel serverless runtime types |

---

## 3. Cấu Trúc Thư Mục

```
tiktok-douyin_extractor/
│
├── index.html                   # HTML entry point (SPA), load font Quicksand/Nunito
├── server.ts                    # Dev-mode entry: khởi động Express + Vite middleware
├── package.json                 # Scripts, dependencies
├── vite.config.ts               # Vite config (React + Tailwind plugin, HMR control)
├── tsconfig.json                # TypeScript config (ESNext, JSX react-jsx, alias @/)
├── vercel.json                  # Vercel deploy config (maxDuration 60s, SPA rewrite)
├── metadata.json                # App metadata (tên, mô tả, capabilities)
│
├── api/                         # ⚡ Vercel Serverless Functions (Production)
│   ├── extract.ts               # POST /api/extract — tải video + Gemini xử lý
│   ├── upload-media.ts          # POST /api/upload-media — nhận base64, Gemini xử lý
│   ├── samples.ts               # GET /api/samples — trả danh sách video mẫu
│   ├── health.ts                # GET /api/health — kiểm tra server status
│   └── index.ts                 # Re-export app từ server/app (Vercel fallback)
│
├── server/                      # 🖥️ Express Backend (Development + shared logic)
│   ├── app.ts                   # Express app: định nghĩa 4 routes API
│   ├── videoExtractor.ts        # Logic tải video TikTok/Douyin (3 strategy cascade)
│   ├── geminiService.ts         # Gọi Gemini API, xử lý response, tạo ExtractionResult
│   └── sampleData.ts            # Dữ liệu mẫu tĩnh (3 video mẫu có sẵn)
│
├── src/                         # ⚛️ React Frontend
│   ├── main.tsx                 # Entry point React (ReactDOM.createRoot → #root)
│   ├── App.tsx                  # Root component: state management, API calls
│   ├── types.ts                 # TypeScript interfaces dùng chung toàn app
│   ├── index.css                # Global CSS (Tailwind v4 import + custom animations)
│   │
│   ├── components/              # React UI Components
│   │   ├── Header.tsx           # Sticky header: logo + nút Lịch Sử
│   │   ├── InputSection.tsx     # Form nhập URL / drag-drop upload file
│   │   ├── ResultViewer.tsx     # Hiển thị kịch bản (timestamp / fulltext / bilingual)
│   │   ├── LoadingCuteModal.tsx # Modal loading cute với 5-step animation
│   │   ├── HistoryDrawer.tsx    # Slide-in drawer xem lịch sử 5 video
│   │   ├── SampleModal.tsx      # Modal chọn video mẫu có sẵn
│   │   └── ApiKeyModal.tsx      # Modal nhập Gemini API Key cá nhân
│   │
│   └── utils/
│       └── exportUtils.ts       # Hàm copy clipboard, xuất .TXT, xuất .SRT
│
└── public/
    └── favicon.svg              # Icon app (SVG)
```

---

## 4. Kiến Trúc Hệ Thống

```
┌──────────────────────────────────────────────────────────────┐
│                     BROWSER (React SPA)                      │
│                                                              │
│  App.tsx ──── InputSection ──── ResultViewer                 │
│     │              │                  │                      │
│     │     (URL / File Upload)   (Hiển thị kịch bản)         │
│     │                                                        │
│     └──── fetch('/api/extract')   <── LocalStorage (5 items) │
│           fetch('/api/upload-media')                         │
└──────────────────┬───────────────────────────────────────────┘
                   │ HTTP POST (JSON / base64)
                   ▼
┌──────────────────────────────────────────────────────────────┐
│                    BACKEND SERVER                             │
│                                                              │
│  [Dev]  server.ts → server/app.ts (Express on :3000)         │
│  [Prod] api/extract.ts (Vercel Serverless Function)          │
│                                                              │
│  Route Handler:                                              │
│  1. Nhận URL → extractCleanUrl() → identifyPlatform()        │
│  2. downloadMediaFromUrl() → Strategy Cascade:               │
│     ├── Strategy 1: TikWM API (tikwm.com)  [ưu tiên nhất]   │
│     ├── Strategy 2: Douyin Direct API (iesdouyin.com)        │
│     └── Strategy 3: yt-dlp binary fallback [chỉ dev]        │
│  3. Lưu file tạm vào /tmp/                                   │
│  4. processMediaWithGemini()                                 │
│     ├── File <= 20MB → inlineData (base64, zero latency)     │
│     └── File >  20MB → Gemini File API upload → fileUri      │
│  5. Parse JSON response → ExtractionResult                   │
│  6. Cleanup: xóa /tmp file + Gemini cloud file               │
│  7. Trả JSON về frontend                                     │
└──────────────────┬───────────────────────────────────────────┘
                   │ @google/genai SDK
                   ▼
┌──────────────────────────────────────────────────────────────┐
│                    GEMINI AI API                              │
│                                                              │
│  Model cascade (thử lần lượt đến khi có response):          │
│  gemini-3.7-flash → gemini-3.6-flash → gemini-3.5-flash-lite│
│  → gemini-3.5-flash → gemini-3.1-flash-lite → ...           │
│                                                              │
│  Output: JSON strict theo responseSchema                     │
│  - isVietnamese, sourceLanguage, sourceLanguageName          │
│  - segments[] {timestamp, startSec, endSec, originalText,    │
│                translatedText}                               │
│  - fullOriginalScript, fullTranslatedScript                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Chi Tiết Từng File

### 5.1 Root Files

#### `index.html`
- HTML entry point SPA, ngôn ngữ `lang="vi"`
- Load font **Quicksand** và **Nunito** từ Google Fonts qua `<link>`
- Body: background `#FFF9FB` (hồng kem nhạt), selection màu pink, font-family Quicksand/Nunito
- Mount React vào `<div id="root">` qua script module `src/main.tsx`

#### `server.ts`
- **Entry point duy nhất cho Development** — `npm run dev` chạy file này qua `tsx`
- Import Express `app` từ `server/app.ts`
- Dev mode: tạo Vite dev server `middlewareMode: 'spa'` (HMR, hot reload)
- Production mode: phục vụ thư mục `dist/` tĩnh + fallback về `index.html`
- Listen trên cổng `3000`, bind `0.0.0.0`

#### `vite.config.ts`
- Plugin: `@vitejs/plugin-react` + `@tailwindcss/vite` (Tailwind v4)
- Path alias `@` → root project (`.`)
- Điều khiển HMR/watch qua env `DISABLE_HMR=true` (tắt khi chạy trong AI Studio)

#### `vercel.json`
- `api/*.ts`: `maxDuration: 60s`, `memory: 1024MB`
- Rewrite: mọi route không bắt đầu bằng `api/` → `index.html` (SPA routing)

#### `tsconfig.json`
- Target `ES2022`, Module `ESNext`, JSX `react-jsx` (không cần import React thủ công)
- Alias `@/*` → `./*`, `allowImportingTsExtensions: true`, `noEmit: true`

#### `metadata.json`
- Tên: `TikTok & Douyin Script Extractor AI`
- `majorCapabilities: ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]`

---

### 5.2 `server/` — Backend Express

#### `server/app.ts`

Express app với **4 API routes:**

| Route | Method | Mô Tả |
|---|---|---|
| `/api/health` | GET | Status server, model, SDK, có API key không |
| `/api/samples` | GET | Trả `SAMPLE_VIDEOS[]` từ `sampleData.ts` |
| `/api/extract` | POST | Nhận URL → tải media → Gemini → `ExtractionResult` |
| `/api/upload-media` | POST | Nhận base64 → lưu `/tmp` → Gemini → `ExtractionResult` |

**Config:** `express.json({ limit: '60mb' })` để nhận video/audio base64.

**Flow `/api/extract`:**
1. `sampleId` trong body → trả `SAMPLE_VIDEOS[id].sampleResult` ngay (không gọi AI)
2. Validate `url` là string
3. `downloadMediaFromUrl(url)` → `{ filePath, mimeType, title, author, duration, platform }`
4. Đọc custom API key từ header `x-gemini-api-key` hoặc `body.customApiKey`
5. `processMediaWithGemini({ filePath, mimeType, customApiKey, videoMetadata })`
6. `finally`: `cleanupLocalTempFile(localTempPath)`

**Flow `/api/upload-media`:**
1. Nhận `{ base64Data, fileName, mimeType, title }`
2. Strip prefix `data:[type];base64,` → `Buffer.from(base64, 'base64')`
3. Ghi ra `/tmp/upload_<fileId>.<ext>`
4. `processMediaWithGemini(...)` với `platform: 'upload'`

---

#### `server/videoExtractor.ts`

**Exported functions:**

| Hàm | Vai Trò |
|---|---|
| `extractCleanUrl(text)` | Regex `https?://[^\s"'<>]+` — lấy URL thuần từ share text lộn xộn |
| `identifyPlatform(url)` | `douyin.com`/`iesdouyin.com` → `'douyin'`; `tiktok.com` → `'tiktok'` |
| `ensureYtDlp()` | Kiểm tra `/tmp/yt-dlp` hoặc PATH; curl download binary từ GitHub nếu thiếu |
| `downloadMediaFromUrl(rawUrl)` | **Hàm chính**: chạy 3 strategy theo thứ tự |
| `cleanupLocalTempFile(filePath?)` | `fs.unlinkSync()` an toàn với try/catch |

**3 Strategy cascade (private):**

| Strategy | Hàm | Cơ chế |
|---|---|---|
| 1 — ưu tiên nhất | `downloadViaTikWmApi` | POST `tikwm.com/api/` với `{ url, hd:1 }` → nhận JSON có `play`/`wmplay` URL → stream MP4 về `/tmp/tiktok_douyin_media/` |
| 2 — Douyin only | `downloadViaDouyinApi` | Fetch redirect URL → extract `aweme_id` → GET `iesdouyin.com/web/api/v2/aweme/iteminfo/` → stream `video.play_addr.url_list[0]` |
| 3 — fallback dev | `downloadViaYtDlp` | Subprocess `yt-dlp -x --audio-format mp3 -o <output>`, timeout 45s |

**Tại sao ưu tiên MP4:** Video TikTok/Douyin có AI TTS và lồng tiếng trong video track, không phải music track. Gemini đọc được cả âm thanh lẫn phụ đề trên MP4.

**Interface `DownloadedMedia`:**
```typescript
{ filePath: string; mimeType: string; title: string; duration?: number; author?: string; platform: 'tiktok'|'douyin'|'upload'|'sample'; }
```

---

#### `server/geminiService.ts`

**Exported:**

| Hàm/Hằng | Vai Trò |
|---|---|
| `getAiClient(customApiKey?)` | `new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } })` |
| `CANDIDATE_MODELS[]` | 10 model thử lần lượt: `gemini-3.7-flash` → `gemini-3.6-flash` → `gemini-3.5-flash-lite` → ... |
| `SYSTEM_INSTRUCTION` | System prompt tiếng Việt: vai trò chuyên gia bóc tách, nhận ngôn ngữ, format timestamp |
| `processMediaWithGemini(params)` | Hàm chính: upload/inline media → generateContent → parse JSON → `ExtractionResult` |

**Logic `processMediaWithGemini` chi tiết:**
1. `fs.statSync()` → tính `fileSizeInMB`
2. `<= 20MB`: `fs.readFileSync()` → base64 → `{ inlineData: { mimeType, data } }` (zero latency)
3. `> 20MB`: `ai.files.upload({ file: filePath })` → poll `ai.files.get()` tối đa 10 lần × 1.5s → `{ fileData: { fileUri, mimeType } }`
4. Vòng lặp CANDIDATE_MODELS: `ai.models.generateContent({ model, contents: [mediaPart, taskPrompt], config: { systemInstruction, responseMimeType: 'application/json', responseSchema } })`
5. Nếu `response.text` → break, dùng response đó
6. `JSON.parse(response.text)` → map thành `ExtractionResult`
7. Fallback: nếu `segments = []` → tạo 1 segment từ `fullOriginalScript`
8. `finally`: `ai.files.delete({ name: uploadedCloudFile.name })` nếu đã upload Gemini cloud

**responseSchema strict:**
```typescript
{
  isVietnamese: boolean,
  sourceLanguage: string,         // 'vi', 'zh', 'en', 'other'
  sourceLanguageName: string,     // 'Tiếng Việt', 'Tiếng Trung (Douyin)', ...
  fullOriginalScript: string,
  fullTranslatedScript?: string,
  segments: Array<{
    id?: string, timestamp: string, startSec: number, endSec: number,
    originalText: string, translatedText?: string
  }>
}
```

---

#### `server/sampleData.ts`

- Export `SAMPLE_VIDEOS: SampleVideoItem[]` — 3 video mẫu tĩnh, trả ngay không cần gọi AI

| ID | Platform | Ngôn ngữ | Nội dung |
|---|---|---|---|
| `douyin-skincare-viral` | Douyin | Tiếng Trung + dịch Việt | 5 segments — Skincare Salicylic Acid |
| `tiktok-gadget-review` | TikTok | Tiếng Việt | 5 segments — Review bàn phím cơ |
| `douyin-food-viral` | Douyin | Tiếng Trung + dịch Việt | 4 segments — Lẩu tự sôi Tứ Xuyên |

---

### 5.3 `api/` — Vercel Serverless Functions

> Logic tương tự `server/` nhưng mỗi file là một serverless function riêng. **Không có yt-dlp**. Chỉ dùng Strategy 1 + 2.

#### `api/extract.ts`
- `export const config = { maxDuration: 60 }` — timeout Vercel 60s
- CORS headers: `Access-Control-Allow-Origin: *`, hỗ trợ OPTIONS preflight
- **CANDIDATE_MODELS** 5 model: `gemini-3.7-flash`, `gemini-3.1-flash-lite`, `gemini-flash-lite-latest`, `gemini-flash-latest`, `gemini-2.5-flash`
- **EXTRACTION_SCHEMA** phong phú hơn server: thêm `summary`, `toneAndStyle`, mỗi segment có `speaker`, dùng `vietnameseTranslation` thay vì `translatedText`
- Hàm `downloadMedia()` tích hợp Strategy 1 + 2 trực tiếp (tự-contained)
- Trả `modelUsed` trong response data

#### `api/upload-media.ts`
- Nhận base64 → lưu `/tmp` → Gemini theo `EXTRACTION_SCHEMA`

#### `api/samples.ts`
- Trả danh sách video mẫu

#### `api/health.ts`
- 4 dòng: trả `{ status: 'ok', model, sdk, hasApiKey, timestamp }`

#### `api/index.ts`
- 3 dòng: `import app from '../server/app'; export default app;`

---

### 5.4 `src/` — Frontend React

#### `src/types.ts`

**3 interfaces cốt lõi — import xuyên suốt frontend và backend:**

```typescript
interface ScriptSegment {
  id?: string;
  timestamp: string;               // '[00:00 - 00:05]'
  startSec: number;
  endSec: number;
  originalText: string;            // Lời gốc (Việt hoặc Trung)
  translatedText?: string;         // Bản dịch Việt (server/ schema)
  vietnameseTranslation?: string;  // Alias (api/ schema — cùng nghĩa, khác tên)
  speaker?: string;                // Người nói (api/ schema)
}

interface VideoMetadata {
  url: string;
  platform: 'tiktok' | 'douyin' | 'upload' | 'sample';
  title: string;
  author?: string;
  duration?: number;    // giây
  coverImage?: string;
}

interface ExtractionResult {
  id: string;           // 'ext_<timestamp>_<random5chars>'
  createdAt: number;    // Unix timestamp ms
  videoMetadata: VideoMetadata;
  segments: ScriptSegment[];
  fullOriginalScript: string;
  fullTranslatedScript?: string;
  fullVietnameseScript?: string;
  summary?: string;
  toneAndStyle?: string;
  sourceLanguage: 'vi' | 'zh' | 'en' | 'other' | string;
  sourceLanguageName: string;
  isVietnamese: boolean;
  cleanedUpTempFiles?: boolean;
  modelUsed?: string;
}

interface SampleVideoItem {
  id: string;
  platform: 'tiktok' | 'douyin';
  title: string;
  niche?: string;
  description: string;
  url?: string;
  badge?: string;
  sampleResult: Partial<ExtractionResult>;
}
```

---

#### `src/main.tsx`
- 11 dòng: render `<StrictMode><App /></StrictMode>` vào `getElementById('root')`
- Import `index.css` để kích hoạt Tailwind CSS

---

#### `src/App.tsx`

**Root component — trung tâm state và API calls:**

**State:**

| State | Type | Mô Tả |
|---|---|---|
| `url` | `string` | URL nhập trong InputSection |
| `isLoading` | `boolean` | True khi đang gọi API |
| `currentResult` | `ExtractionResult \| null` | Kết quả bóc tách hiện tại |
| `history` | `ExtractionResult[]` | Tối đa 5 kết quả gần nhất |
| `isHistoryOpen` | `boolean` | Đóng/mở HistoryDrawer |
| `errorMessage` | `string \| null` | Alert box lỗi |

**LocalStorage key:** `tiktok_douyin_script_history_v2`

**Hàm chính:**

| Hàm | Mô Tả |
|---|---|
| `saveToHistory(result)` | Thêm đầu array, dedup theo `id`+`title`, giới hạn 5, sync localStorage |
| `handleClearHistory()` | `setHistory([])` + `localStorage.removeItem()` |
| `handleDeleteHistoryItem(id)` | Filter bỏ item theo id, sync localStorage |
| `handleSubmitUrl()` | `fetch POST /api/extract { url }` → setCurrentResult + saveToHistory + confetti |
| `handleUploadFile(file)` | `FileReader.readAsDataURL()` → `fetch POST /api/upload-media` → setCurrentResult + confetti |

**Render:** `!currentResult` → Hero + InputSection; có `currentResult` → ResultViewer

---

#### `src/components/Header.tsx`

**Props:** `{ historyCount: number, onOpenHistory: () => void }`

- Sticky header, glassmorphism `bg-white/80 backdrop-blur-md`
- Logo gradient pink→purple→indigo, icon `Sparkles`
- Nút Lịch sử: badge số `historyCount` màu purple-600

---

#### `src/components/InputSection.tsx`

**Props:** `{ url, setUrl, onSubmitUrl, onUploadFile, isLoading }`

**Local state:** `isUploadMode`, `dragActive`, `copiedLink`

**Mode URL:**
- Input + nút "Dán nhanh" (`navigator.clipboard.readText()` → extract URL bằng regex)
- Badge tự động: `douyin.com` → badge đỏ; `tiktok.com` → badge xanh
- Enter → `onSubmitUrl()`

**Mode Upload:**
- Dropzone: `onDragEnter/Leave/Over/Drop` + `<input type="file" hidden>`
- Accept: `video/mp4, video/quicktime, video/webm, audio/mp3, audio/mpeg, audio/m4a, audio/wav`
- Click dropzone → `fileInputRef.current?.click()`

---

#### `src/components/ResultViewer.tsx`

**Props:** `{ result: ExtractionResult, onReset: () => void }`

**Local state:** `viewMode`, `langTab`, `searchTerm`, `copiedType`

**Search realtime:**
```typescript
filteredSegments = segments.filter(seg =>
  seg.originalText.includes(term) || seg.translatedText?.includes(term)
)
```

**Hiển thị theo `isVietnamese`:**

- `true` (Tiếng Việt): Toggle timestamps/fulltext → bảng `[mm:ss] | lời thoại`
- `false` (Tiếng Trung): 3 tab → song ngữ 2 cột / chỉ Việt / chỉ Trung

**Actions:**
- Video Việt: Copy kịch bản, Xuất .TXT, Tải .SRT
- Video Trung: Copy dịch Việt, Copy gốc Trung, Copy song ngữ, Xuất .TXT, Tải .SRT

---

#### `src/components/LoadingCuteModal.tsx`

**Props:** `{ isOpen: boolean }`

- Nếu `!isOpen` → `return null`
- `setInterval(2800ms)` đếm step 0→4, reset khi đóng
- Animated: flower spin + heartbeat heart
- 5 steps: Kết nối → Trích xuất → Gemini lắng nghe → Timestamp & dịch → Dọn dẹp
- Progress dots: 5 chấm — active `w-7 pink`, đã qua `w-2 purple`, chưa tới `w-2 slate`

---

#### `src/components/HistoryDrawer.tsx`

**Props:** `{ isOpen, onClose, history[], onSelectHistoryItem, onClearHistory, onDeleteItem }`

- Nếu `!isOpen` → `return null`
- Backdrop click → `onClose()`; Panel click → `stopPropagation()`
- Animate `slide-in-from-right duration-250`
- Mỗi item: platform badge, thời gian `HH:mm dd/mm/yyyy`, tiêu đề, số đoạn thoại, ngôn ngữ
- Nút Trash2 mỗi item: `stopPropagation()` → `onDeleteItem(id)`
- Footer: nút "Xóa toàn bộ 5 lịch sử" (chỉ hiện khi có history)

---

#### `src/components/SampleModal.tsx`
- Modal hiển thị 3 video mẫu, click chọn → POST `/api/extract { sampleId }` → trả data tĩnh

#### `src/components/ApiKeyModal.tsx`
- Modal nhập Gemini API Key cá nhân → gửi `x-gemini-api-key` header mỗi request

---

#### `src/utils/exportUtils.ts`

| Hàm | Signature | Mô Tả |
|---|---|---|
| `copyToClipboard` | `(text: string) => Promise<boolean>` | `navigator.clipboard.writeText()` |
| `formatScriptAsText` | `(result, mode) => string` | Format kịch bản theo mode xuất |
| `generateSrtContent` | `(result, language: 'vi'\|'zh') => string` | `.SRT` chuẩn `HH:MM:SS,mmm --> HH:MM:SS,mmm` |
| `downloadTextFile` | `(filename, content, mimeType?) => void` | Blob → `URL.createObjectURL` → `<a>` auto-click |

**`formatScriptAsText` modes:**
- `vietnamese`: `[timestamp] translatedText` (hoặc originalText nếu video Việt)
- `chinese`: `[timestamp] originalText`
- `bilingual`: `[timestamp]\n🇨🇳 Gốc: ...\n🇻🇳 Dịch: ...\n`
- `timestamps`: `[timestamp] originalText` (mặc định cho Việt)

---

#### `src/index.css`

- `@import "tailwindcss"` — Tailwind v4 syntax
- Body: font `Quicksand, Nunito`, bg `#FFF9FB`, color `#4A4058`

**Custom animations:**

| Keyframe | Hiệu ứng | Class dùng |
|---|---|---|
| `heartbeat` | scale 1→1.15→0.98→1.1→1 (1.4s) | `.animate-heartbeat` |
| `flower-spin` | rotate 0→360deg (6s linear) | `.animate-flower-spin` |
| `float` | translateY 0→-6px→0 (3s ease) | `.animate-float` |
| `shimmer` | bg-position slide -200%→200% | (chưa có utility class) |

**Custom box shadows (pastel):**
- `.pastel-shadow` — `rgba(244,180,208,0.35)` + `rgba(216,180,254,0.2)`
- `.pastel-shadow-sm`, `.pastel-shadow-hover:hover`

**Custom scrollbar (webkit):** track `#FFF0F5`, thumb `#F2C4DE`, thumb-hover `#E8A8CC`

---

## 6. Luồng Dữ Liệu (Data Flow)

### Bóc tách từ URL:

```
[User] dán URL → InputSection
      ↓
App.handleSubmitUrl() → setIsLoading(true)
      ↓
fetch POST /api/extract { url }
      ↓
server/app.ts Route Handler
  extractCleanUrl(url)         → URL thuần
  identifyPlatform(url)        → 'tiktok' | 'douyin'
  downloadMediaFromUrl(url)
    Strategy 1: TikWM API      → MP4 stream → /tmp/<id>.mp4 ✓
    Strategy 2: Douyin API     → MP4 stream (nếu S1 fail & Douyin)
    Strategy 3: yt-dlp         → MP3 (nếu S1+S2 fail, chỉ dev)
      ↓
processMediaWithGemini({ filePath, mimeType, videoMetadata })
  <= 20MB → inlineData base64
  > 20MB  → ai.files.upload() → poll 10x(1.5s) → fileUri
      ↓
ai.models.generateContent(model, [mediaPart, prompt], responseSchema)
  [thử từng model trong CANDIDATE_MODELS đến khi có response.text]
      ↓
JSON.parse(response.text) → ExtractionResult
      ↓
finally: fs.unlinkSync(localTempPath) + ai.files.delete(cloudFile)
      ↓
res.json({ success: true, data: ExtractionResult })
      ↓
App: setCurrentResult(data) + saveToHistory(data) + confetti()
      ↓
ResultViewer hiển thị kịch bản
```

---

## 7. API Endpoints

### `GET /api/health`
```json
{ "status": "ok", "model": "gemini-3.7-flash", "sdk": "@google/genai", "hasApiKey": true, "timestamp": "2026-09-15T09:00:00.000Z" }
```

### `GET /api/samples`
```json
{ "success": true, "samples": [ ...SampleVideoItem ] }
```

### `POST /api/extract`

**Request:**
```
Headers: x-gemini-api-key: <optional>
Body:    { "url": "https://tiktok.com/...", "sampleId": "optional" }
```

**Response thành công:**
```json
{
  "success": true,
  "data": {
    "id": "ext_1726390000000_abc12",
    "createdAt": 1726390000000,
    "isVietnamese": false,
    "sourceLanguage": "zh",
    "sourceLanguageName": "Tiếng Trung (Douyin)",
    "fullOriginalScript": "如果你的脸上总是有...",
    "fullTranslatedScript": "Nếu mặt bạn đang chi chít...",
    "segments": [{
      "id": "seg_1", "timestamp": "[00:00 - 00:04]",
      "startSec": 0, "endSec": 4,
      "originalText": "如果你的脸上总是有这种密密麻麻的闭口粉刺",
      "translatedText": "Nếu mặt bạn đang chi chít mụn ẩn li ti thế này"
    }],
    "videoMetadata": { "url": "...", "platform": "douyin", "title": "...", "author": "...", "duration": 28 },
    "modelUsed": "gemini-3.7-flash"
  },
  "message": "Bóc tách kịch bản thành công! 🎉"
}
```

**Response lỗi:**
```json
{ "success": false, "error": "Mô tả lỗi tiếng Việt" }
```

### `POST /api/upload-media`
```
Body: { "base64Data": "data:video/mp4;base64,...", "fileName": "video.mp4", "mimeType": "video/mp4", "title": "Tên video" }
```

---

## 8. TypeScript Types Chính

> Xem đầy đủ tại `src/types.ts`

```typescript
ScriptSegment    // timestamp + startSec + endSec + originalText + translatedText?
VideoMetadata    // url + platform + title + author? + duration?
ExtractionResult // id + createdAt + videoMetadata + segments[] + scripts + isVietnamese + ...
SampleVideoItem  // id + platform + title + sampleResult: Partial<ExtractionResult>
```

---

## 9. Cài Đặt & Chạy Dự Án

### Yêu cầu
- Node.js >= 18, npm/yarn/bun

### Cài dependencies
```bash
npm install   # hoặc: bun install
```

### Cấu hình môi trường
Tạo file `.env`:
```env
GEMINI_API_KEY=your_key_here
```
Lấy API Key miễn phí: https://aistudio.google.com/apikey

### Chạy Development
```bash
npm run dev   # Server: http://localhost:3000
```

### Build Production
```bash
npm run build   # dist/ (frontend) + dist/server.cjs (backend)
```

### Chạy Production (local)
```bash
npm run start   # Chạy dist/server.cjs
```

### Kiểm tra TypeScript
```bash
npm run lint   # tsc --noEmit
```

---

## 10. Môi Trường Biến & Config

| Biến | Bắt buộc? | Mô Tả |
|---|---|---|
| `GEMINI_API_KEY` | Khuyến nghị | API Key Gemini. Thiếu → user phải nhập qua `ApiKeyModal` |
| `NODE_ENV` | Tự động | `'production'` → serve static; khác → Vite dev mode |
| `DISABLE_HMR` | Không | `'true'` → tắt Vite HMR+watch (AI Studio environment) |
| `PORT` | Không | Cổng Express, mặc định `3000` |

---

## 11. Deploy lên Vercel

### Bước deploy:
1. Push code lên GitHub
2. Import project vào Vercel Dashboard
3. Thêm Environment Variable: `GEMINI_API_KEY`
4. Deploy — Vercel tự detect `vercel.json`:
   - `vite build` → static assets
   - `api/*.ts` → Serverless Functions (Node.js runtime)

### Đặc điểm môi trường Vercel:
- **Không có yt-dlp** — sandbox, không cài binary → chỉ Strategy 1 & 2
- **Timeout:** 60s per function
- **Memory:** 1024 MB per function
- **Temp files:** `/tmp` ghi được trong execution, xóa sau function end
- **Cold start:** ~1-2s thêm lần đầu gọi

---

## 12. Các Điểm Quan Trọng Cần Lưu Ý

### ⚠️ Dual Logic: `server/` vs `api/`

Dự án có **2 bộ backend song song:**

| Khía cạnh | `server/` (Dev/VPS) | `api/` (Vercel) |
|---|---|---|
| yt-dlp Strategy 3 | Có | Không |
| Translation field | `translatedText` | `vietnameseTranslation` |
| Extra AI fields | Không | `summary`, `toneAndStyle`, `speaker` |
| Model count | 10 models | 5 models |

**Frontend `ResultViewer.tsx`** render: `seg.translatedText || seg.originalText` — **không đọc** `vietnameseTranslation` từ `api/extract.ts`.

> **TODO:** Chuẩn hóa field name và schema giữa 2 bộ.

### ⚠️ Naming Inconsistency

| Ngữ cảnh | Field name |
|---|---|
| `src/types.ts`, `server/geminiService.ts`, `server/sampleData.ts`, `ResultViewer.tsx` | `translatedText` |
| `api/extract.ts` Gemini schema | `vietnameseTranslation` |

### ⚠️ Lỗi Thường Gặp

| Lỗi | Nguyên nhân | Xử lý |
|---|---|---|
| `429 / RESOURCE_EXHAUSTED` | Gemini rate limit | Thông báo "hạn mức đạt giới hạn" |
| `Failed to fetch` | Server chưa start / mất mạng | Thông báo kiểm tra kết nối |
| Buffer < 1000 bytes | Stream download thất bại | Strategy bỏ qua, thử strategy tiếp |
| `yt-dlp not found` | Binary không có trong PATH | `ensureYtDlp()` tự download từ GitHub |
| Gemini upload timeout | File lớn / mạng chậm | Throw error sau 10 polls × 1.5s = 15s |

### 💡 Custom API Key Flow

1. User mở `ApiKeyModal` → nhập key
2. Mỗi request: header `x-gemini-api-key: <key>`
3. Backend ưu tiên: `req.headers['x-gemini-api-key']` > `process.env.GEMINI_API_KEY`

### 💡 LocalStorage History

- Key: `tiktok_douyin_script_history_v2`
- Max 5 `ExtractionResult` objects, dedup theo `id` + `title`
- Auto-load khi App mount (`useEffect([], [])`)
- `slice(0, 5)` khi load để đảm bảo giới hạn

---

*Tài liệu được tổng hợp từ việc phân tích toàn bộ source code. Cập nhật: 2026-09-15*

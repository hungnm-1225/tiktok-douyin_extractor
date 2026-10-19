import React, { 
  useState, 
  useRef, 
  useEffect, 
  forwardRef, 
  useImperativeHandle 
} from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Music, 
  Video as VideoIcon,
  Sparkles,
  Heart
} from 'lucide-react';

export interface CustomMediaPlayerRef {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
}

interface CustomMediaPlayerProps {
  src?: string;
  title?: string;
  platform?: string;
  duration?: number;
  coverImage?: string;
  mimeType?: string;
  mediaType?: 'video' | 'audio';
  onError?: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const CustomMediaPlayer = forwardRef<CustomMediaPlayerRef, CustomMediaPlayerProps>(
  ({ src, title, platform, duration: initialDuration, coverImage, mimeType, mediaType, onError }, ref) => {
    const mediaRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(initialDuration || 0);
    const [volume, setVolume] = useState<number>(1);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [showControls, setShowControls] = useState<boolean>(true);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Robust audio detection: checks mediaType, mimeType, title extension, and src patterns
    const isAudioOnly = Boolean(
      mediaType === 'audio' ||
      mimeType?.startsWith('audio/') ||
      (title && /\.(mp3|wav|m4a|aac|ogg|flac|wma)$/i.test(title)) ||
      (src && (
        /\.(mp3|wav|m4a|aac|ogg|flac|wma)(\?.*)?$/i.test(src) ||
        src.includes('audio/') ||
        src.includes('mime_type=audio')
      ))
    );

    // Expose control methods to parent (e.g., clicking on timestamps in the script)
    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (mediaRef.current) {
          mediaRef.current.currentTime = Math.max(0, seconds);
          setCurrentTime(Math.max(0, seconds));
          mediaRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      },
      play: () => {
        mediaRef.current?.play().catch(() => {});
        setIsPlaying(true);
      },
      pause: () => {
        mediaRef.current?.pause();
        setIsPlaying(false);
      },
      getCurrentTime: () => mediaRef.current?.currentTime || 0,
    }));

    useEffect(() => {
      const video = mediaRef.current;
      if (!video) return;

      const handleTimeUpdate = () => {
        if (!isDragging) {
          setCurrentTime(video.currentTime);
        }
      };

      const handleLoadedMetadata = () => {
        if (video.duration && !isNaN(video.duration)) {
          setDuration(video.duration);
        }
      };

      const handleEnded = () => {
        setIsPlaying(false);
      };

      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('ended', handleEnded);

      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('ended', handleEnded);
      };
    }, [isDragging]);

    const togglePlay = () => {
      if (!mediaRef.current) return;
      if (isPlaying) {
        mediaRef.current.pause();
        setIsPlaying(false);
      } else {
        mediaRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    };

    const handleSeekForward = (seconds: number = 5) => {
      if (!mediaRef.current) return;
      const target = Math.min(mediaRef.current.currentTime + seconds, duration);
      mediaRef.current.currentTime = target;
      setCurrentTime(target);
    };

    const handleSeekBackward = (seconds: number = 5) => {
      if (!mediaRef.current) return;
      const target = Math.max(mediaRef.current.currentTime - seconds, 0);
      mediaRef.current.currentTime = target;
      setCurrentTime(target);
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !mediaRef.current || duration <= 0) return;
      const rect = progressRef.current.getBoundingClientRect();
      const clickPos = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = clickPos / rect.width;
      const newTime = percentage * duration;
      mediaRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    };

    const toggleMute = () => {
      if (!mediaRef.current) return;
      const newMuted = !isMuted;
      mediaRef.current.muted = newMuted;
      setIsMuted(newMuted);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!mediaRef.current) return;
      const newVol = parseFloat(e.target.value);
      mediaRef.current.volume = newVol;
      setVolume(newVol);
      setIsMuted(newVol === 0);
    };

    const toggleFullscreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      } else {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    };

    const handleMouseMove = () => {
      setShowControls(true);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      if (isPlaying) {
        hideTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    };

    if (!src) {
      return null;
    }

    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <div
        id="custom-media-player-card"
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        className="relative bg-white rounded-3xl overflow-hidden border border-pink-200/90 pastel-shadow group select-none transition-all"
      >
        {isAudioOnly ? (
          /* ============================================================== */
          /* DEDICATED CUTE PASTEL AUDIO PLAYER (NO BLACK SCREEN)            */
          /* ============================================================== */
          <div className="p-4 sm:p-5 bg-gradient-to-r from-pink-50/90 via-purple-50/80 to-indigo-50/80 space-y-3.5">
            <audio ref={mediaRef as any} src={src} preload="metadata" onError={onError} />

            {/* Audio Header Row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`h-11 w-11 rounded-2xl bg-gradient-to-tr from-pink-300 via-purple-300 to-indigo-300 text-purple-900 flex items-center justify-center shadow-md shadow-pink-200/60 shrink-0 ${
                    isPlaying ? 'animate-spin-slow' : ''
                  }`}
                >
                  <Music className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                      Bản Ghi Âm Thanh
                    </span>
                    <span className="text-[11px] text-slate-400">Audio Track</span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate mt-0.5 max-w-sm sm:max-w-md">
                    {title || 'Tệp âm thanh'}
                  </h4>
                </div>
              </div>

              {/* Animated Waveform Visualizer Bars when Playing */}
              <div className="flex items-end gap-1 h-6 shrink-0 px-2">
                {[40, 75, 55, 90, 60, 85, 45, 100, 70, 50].map((h, i) => (
                  <span
                    key={i}
                    className={`w-1 rounded-full bg-gradient-to-t from-pink-400 to-purple-500 transition-all duration-300 ${
                      isPlaying ? 'animate-pulse' : 'opacity-40'
                    }`}
                    style={{
                      height: isPlaying ? `${Math.max(20, (h * (i % 2 === 0 ? 1 : 0.7)))}%` : '25%',
                      animationDelay: `${i * 100}ms`,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Custom Pastel Progress / Seek Bar */}
            <div
              ref={progressRef}
              onClick={handleProgressClick}
              className="group/seek relative w-full h-2.5 bg-pink-200/60 rounded-full cursor-pointer overflow-visible flex items-center"
            >
              <div
                className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full relative transition-all"
                style={{ width: `${progressPercentage}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-3.5 w-3.5 bg-white border-2 border-pink-500 rounded-full shadow-md shadow-pink-300 group-hover/seek:scale-125 transition-transform" />
              </div>
            </div>

            {/* Audio Controller Buttons Row */}
            <div className="flex items-center justify-between gap-3 text-slate-700 flex-wrap pt-0.5">
              <div className="flex items-center gap-2">
                {/* Play/Pause */}
                <button
                  type="button"
                  onClick={togglePlay}
                  className="h-9 w-9 rounded-xl bg-gradient-to-tr from-pink-400 to-purple-500 hover:from-pink-500 hover:to-purple-600 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer"
                  title={isPlaying ? 'Tạm dừng' : 'Phát tiếp'}
                >
                  {isPlaying ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 ml-0.5 fill-white" />}
                </button>

                {/* Rewind / Forward 5s */}
                <button
                  type="button"
                  onClick={() => handleSeekBackward(5)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-white transition-colors cursor-pointer"
                  title="Tua lại 5s"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSeekForward(5)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-white transition-colors cursor-pointer"
                  title="Tua tới 5s"
                >
                  <RotateCw className="h-4 w-4" />
                </button>

                {/* Time Display */}
                <div className="ml-1 font-mono text-xs font-bold text-slate-600 tracking-tight">
                  <span className="text-purple-800">{formatTime(currentTime)}</span>
                  <span className="text-slate-300 mx-1">/</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-white transition-colors cursor-pointer"
                  title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4 text-rose-500" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-purple-700" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 sm:w-24 h-1.5 bg-pink-200/80 rounded-full accent-pink-500 cursor-pointer"
                  title="Âm lượng"
                />
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* VIDEO PLAYER (WITH ACTUAL VIDEO SCREEN AND CONTROLS)           */
          /* ============================================================== */
          <>
            {/* Top Mini Header */}
            <div className="px-4 py-2 bg-gradient-to-r from-pink-50/90 via-purple-50/70 to-indigo-50/70 border-b border-pink-100 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-pink-400 animate-pulse"></span>
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <VideoIcon className="h-3.5 w-3.5 text-pink-500" />
                  <span>Trình Phát Video Đối Chiếu</span>
                </span>
              </div>

              <div className="text-[11px] text-purple-700 font-semibold bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">
                {platform === 'douyin' ? 'Douyin (抖音)' : platform === 'tiktok' ? 'TikTok' : 'Video'}
              </div>
            </div>

            {/* Video Viewing Screen */}
            <div 
              className="relative bg-slate-950 flex items-center justify-center cursor-pointer min-h-[220px] sm:min-h-[340px] max-h-[480px] overflow-hidden"
              onClick={togglePlay}
            >
              <video
                ref={mediaRef}
                src={src}
                poster={coverImage}
                preload="metadata"
                playsInline
                onError={onError}
                className="w-full h-full max-h-[480px] object-contain mx-auto"
              />

              {/* Big Cute Play Button in Center when Paused */}
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-2xs transition-opacity">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-tr from-pink-400 via-purple-400 to-indigo-400 flex items-center justify-center text-white shadow-xl shadow-pink-500/40 transform hover:scale-110 active:scale-95 transition-transform">
                    <Play className="h-8 w-8 sm:h-9 sm:w-9 ml-1 fill-white" />
                  </div>
                </div>
              )}
            </div>

            {/* Custom Pastel Controls Bar */}
            <div 
              className={`p-3 sm:p-4 bg-white/95 backdrop-blur-md border-t border-pink-100 transition-opacity duration-300 space-y-2.5 ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Progress Seekbar */}
              <div
                ref={progressRef}
                onClick={handleProgressClick}
                className="group/seek relative w-full h-2.5 bg-pink-100/90 rounded-full cursor-pointer overflow-visible flex items-center"
              >
                <div
                  className="h-full bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-500 rounded-full relative transition-all"
                  style={{ width: `${progressPercentage}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-4 w-4 bg-white border-2 border-pink-500 rounded-full shadow-md shadow-pink-300 group-hover/seek:scale-125 transition-transform" />
                </div>
              </div>

              {/* Buttons Row */}
              <div className="flex items-center justify-between gap-3 text-slate-700 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="h-9 w-9 rounded-xl bg-gradient-to-tr from-pink-400 to-purple-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer"
                    title={isPlaying ? 'Tạm dừng' : 'Phát tiếp'}
                  >
                    {isPlaying ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 ml-0.5 fill-white" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSeekBackward(5)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-pink-50 transition-colors cursor-pointer"
                    title="Tua lại 5 giây"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSeekForward(5)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-pink-50 transition-colors cursor-pointer"
                    title="Tua tới 5 giây"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>

                  <div className="ml-1 font-mono text-xs font-bold text-slate-600 tracking-tight">
                    <span className="text-purple-700">{formatTime(currentTime)}</span>
                    <span className="text-slate-300 mx-1">/</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-pink-50 transition-colors cursor-pointer"
                      title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="h-4 w-4 text-rose-500" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-purple-700" />
                      )}
                    </button>

                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-16 sm:w-20 h-1.5 bg-pink-100 rounded-full accent-pink-500 cursor-pointer"
                      title="Âm lượng"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-pink-50 transition-colors cursor-pointer"
                    title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                  >
                    {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
);

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
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const CustomMediaPlayer = forwardRef<CustomMediaPlayerRef, CustomMediaPlayerProps>(
  ({ src, title, platform, duration: initialDuration, coverImage }, ref) => {
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

    // Determine if source is audio-only
    const isAudioOnly = Boolean(src && (src.includes('.mp3') || src.includes('.wav') || src.includes('.m4a')));

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
        {/* Top Mini Header */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-pink-50/90 via-purple-50/70 to-indigo-50/70 border-b border-pink-100 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-pink-400 animate-pulse"></span>
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-pink-500" />
              <span>Trình Phát Video / Audio Gốc</span>
            </span>
          </div>

          <div className="text-[11px] text-purple-700 font-semibold bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">
            {platform === 'douyin' ? 'Douyin (抖音)' : platform === 'tiktok' ? 'TikTok' : 'Media'}
          </div>
        </div>

        {/* Media Viewing Screen */}
        <div 
          className="relative bg-slate-950 flex items-center justify-center cursor-pointer min-h-[220px] sm:min-h-[340px] max-h-[480px] overflow-hidden"
          onClick={togglePlay}
        >
          {isAudioOnly ? (
            /* Audio visualization cute screen */
            <div className="w-full h-48 sm:h-64 flex flex-col items-center justify-center bg-gradient-to-b from-pink-900/40 via-purple-900/40 to-slate-950 text-white space-y-4 p-6">
              <div className={`h-20 w-20 rounded-full bg-gradient-to-tr from-pink-300 via-purple-300 to-indigo-300 flex items-center justify-center shadow-lg shadow-pink-500/20 text-purple-950 ${isPlaying ? 'animate-spin-slow' : ''}`}>
                <Music className="h-9 w-9 text-purple-900" />
              </div>
              <p className="text-xs sm:text-sm font-semibold text-pink-200 text-center max-w-md line-clamp-1">
                {title || 'Bản ghi âm thanh kịch bản'}
              </p>
              <audio ref={mediaRef as any} src={src} preload="metadata" />
            </div>
          ) : (
            /* Full video screen (Without native controls) */
            <>
              <video
                ref={mediaRef}
                src={src}
                poster={coverImage}
                preload="metadata"
                playsInline
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
            </>
          )}
        </div>

        {/* Custom Pastel Controls Bar */}
        <div 
          className={`p-3 sm:p-4 bg-white/95 backdrop-blur-md border-t border-pink-100 transition-opacity duration-300 space-y-2.5 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Custom Pastel Progress / Seek Bar */}
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            className="group/seek relative w-full h-2.5 bg-pink-100/90 rounded-full cursor-pointer overflow-visible flex items-center"
          >
            {/* Filled Progress Gradient */}
            <div
              className="h-full bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-500 rounded-full relative transition-all"
              style={{ width: `${progressPercentage}%` }}
            >
              {/* Cute Scrubber Circle Knob */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-4 w-4 bg-white border-2 border-pink-500 rounded-full shadow-md shadow-pink-300 group-hover/seek:scale-125 transition-transform" />
            </div>
          </div>

          {/* Buttons & Time Controller Row */}
          <div className="flex items-center justify-between gap-3 text-slate-700 flex-wrap">
            {/* Left buttons: Play/Pause, Rewind, Forward, Current/Total Time */}
            <div className="flex items-center gap-2">
              {/* Play/Pause Button */}
              <button
                type="button"
                onClick={togglePlay}
                className="h-9 w-9 rounded-xl bg-gradient-to-tr from-pink-400 to-purple-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer"
                title={isPlaying ? 'Tạm dừng' : 'Phát tiếp'}
              >
                {isPlaying ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 ml-0.5 fill-white" />}
              </button>

              {/* Backward 5s */}
              <button
                type="button"
                onClick={() => handleSeekBackward(5)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-pink-50 transition-colors cursor-pointer"
                title="Tua lại 5 giây"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              {/* Forward 5s */}
              <button
                type="button"
                onClick={() => handleSeekForward(5)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-pink-50 transition-colors cursor-pointer"
                title="Tua tới 5 giây"
              >
                <RotateCw className="h-4 w-4" />
              </button>

              {/* Time Display */}
              <div className="ml-1 font-mono text-xs font-bold text-slate-600 tracking-tight">
                <span className="text-purple-700">{formatTime(currentTime)}</span>
                <span className="text-slate-300 mx-1">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right buttons: Volume Controller & Fullscreen */}
            <div className="flex items-center gap-2.5">
              {/* Volume & Mute */}
              <div className="flex items-center gap-1.5 group/vol">
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

                {/* Volume slider */}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 sm:w-20 h-1.5 bg-pink-100 rounded-full accent-pink-500 cursor-pointer"
                  title="Điều chỉnh âm lượng"
                />
              </div>

              {/* Fullscreen Button (For video only) */}
              {!isAudioOnly && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-pink-50 transition-colors cursor-pointer"
                  title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

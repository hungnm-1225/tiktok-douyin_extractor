import React from 'react';
import { X, Film, Flame, ArrowRight } from 'lucide-react';
import { SampleVideoItem } from '../types';

interface SampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  samples: SampleVideoItem[];
  onSelectSample: (sample: SampleVideoItem) => void;
}

export const SampleModal: React.FC<SampleModalProps> = ({
  isOpen,
  onClose,
  samples,
  onSelectSample,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="sample-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        id="sample-modal-card"
        className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 border border-pink-100 shadow-2xl shadow-pink-200/50 space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-pink-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-pink-100 text-pink-700">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-800">
                Thư Viện Video Mẫu (TikTok & Douyin)
              </h3>
              <p className="text-xs text-slate-500">
                Trải nghiệm bóc tách kịch bản tức thì chỉ với 1 cú nhấp chuột
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Samples list */}
        <div className="space-y-3.5">
          {samples.map((sample) => (
            <div
              key={sample.id}
              id={`sample-item-${sample.id}`}
              className="p-4 sm:p-5 rounded-2xl bg-[#FFF9FB] border border-pink-100 hover:border-pink-300 hover:bg-pink-50/50 transition-all group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer"
              onClick={() => {
                onSelectSample(sample);
                onClose();
              }}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                    sample.platform === 'douyin'
                      ? 'bg-rose-100 text-rose-700 border-rose-200'
                      : 'bg-cyan-100 text-cyan-800 border-cyan-200'
                  }`}>
                    {sample.platform.toUpperCase()}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                    {sample.niche}
                  </span>
                  <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                    <Flame className="h-3 w-3" />
                    {sample.badge}
                  </span>
                </div>

                <h4 className="font-bold text-xs sm:text-sm text-slate-800 group-hover:text-purple-800 transition-colors">
                  {sample.title}
                </h4>

                <p className="text-xs text-slate-500 leading-relaxed">
                  {sample.description}
                </p>
              </div>

              <button
                type="button"
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white group-hover:bg-gradient-to-r group-hover:from-pink-300 group-hover:to-purple-300 group-hover:text-purple-950 text-slate-700 text-xs font-bold border border-pink-200 transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0"
              >
                <span>Xem Thử</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

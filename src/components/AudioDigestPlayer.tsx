import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Play, Pause, RotateCcw, VolumeX, Loader2, Sparkles } from 'lucide-react';
import { fetchWithRetry } from '../utils/fetchWithRetry';

interface AudioDigestPlayerProps {
  summaryText: string;
  bookTitle: string;
}

export const AudioDigestPlayer: React.FC<AudioDigestPlayerProps> = ({
  summaryText,
  bookTitle
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState<string>('Kore');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Reset audio state when book changes
    setAudioUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setErrorMsg(null);
  }, [bookTitle, summaryText]);

  const generateAndPlayAudio = async () => {
    if (audioUrl) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetchWithRetry('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: summaryText,
          voiceName
        })
      });

      const rawText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        console.error('Non-JSON TTS response received:', rawText.slice(0, 300));
      }

      if (!response.ok || !data?.audioBase64) {
        throw new Error(data?.error || `Server speech synthesis error (${response.status}).`);
      }

      const url = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
      setAudioUrl(url);
      setIsLoading(false);

      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.playbackRate = playbackSpeed;
          audioRef.current.play().then(() => setIsPlaying(true)).catch(e => console.error(e));
        }
      }, 100);
    } catch (err: any) {
      console.error('Audio generation failed:', err);
      setErrorMsg(err?.message || 'Speech synthesis failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-[#F4EDE2] border border-[#E2D4C3] rounded-xl p-4 md:p-5 shadow-sm space-y-3">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onLoadedMetadata={handleTimeUpdate}
        />
      )}

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-[#2A1E17] text-[#D4A373] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="font-serif-display font-bold text-sm text-[#2A1E17] truncate">
              AI Executive Speech Digest
            </h4>
            <p className="text-[11px] font-sans-ui text-[#7A6B5D] truncate">
              Synthesized via Gemini 3.8 Flash Lite Voice
            </p>
          </div>
        </div>

        {/* Voice Selector */}
        <select
          value={voiceName}
          onChange={e => {
            setVoiceName(e.target.value);
            setAudioUrl(null); // regenerate with new voice
          }}
          disabled={isLoading}
          className="w-full sm:w-auto min-h-[34px] bg-[#FBF7EE] border border-[#D8C8B4] rounded-md px-2.5 py-1 text-xs font-sans-ui text-[#2A1E17] focus:outline-none"
        >
          <option value="Kore">Voice: Kore (Calm & Clear)</option>
          <option value="Fenrir">Voice: Fenrir (Warm Deep)</option>
          <option value="Zephyr">Voice: Zephyr (Articulate)</option>
          <option value="Puck">Voice: Puck (Lively)</option>
        </select>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 bg-[#FBF7EE] p-3 rounded-lg border border-[#E8DDCB]">
        {/* Play/Pause Main Button */}
        <button
          onClick={generateAndPlayAudio}
          disabled={isLoading}
          className="w-10 h-10 rounded-full bg-[#2A1E17] text-[#FBF7EE] hover:bg-[#3D2C22] flex items-center justify-center shrink-0 transition-all shadow-sm disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#D4A373]" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 text-[#D4A373]" />
          ) : (
            <Play className="w-5 h-5 text-[#D4A373] ml-0.5" />
          )}
        </button>

        {/* Time & Progress Bar */}
        <div className="flex-1 min-w-[140px] flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-sans-ui text-[#7A6B5D]">
            <span>{formatTime(currentTime)}</span>
            <span>{duration > 0 ? formatTime(duration) : 'AI Voice Digest'}</span>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            disabled={!audioUrl}
            className="w-full accent-[#8C5A2B] h-1.5 bg-[#E2D4C3] rounded-lg cursor-pointer disabled:cursor-not-allowed"
          />
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1.5 shrink-0 text-xs font-sans-ui text-[#5E5043] w-full sm:w-auto justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-[#E8DDCB]/60">
          {[1.0, 1.25, 1.5].map(s => (
            <button
              key={s}
              onClick={() => changeSpeed(s)}
              className={`min-h-[30px] px-2 py-0.5 rounded text-[11px] ${
                playbackSpeed === s ? 'bg-[#2A1E17] text-[#FBF7EE] font-semibold' : 'hover:bg-[#E8DDCB]'
              }`}
            >
              {s}x
            </button>
          ))}
          <button
            onClick={toggleMute}
            className="min-h-[30px] min-w-[30px] flex items-center justify-center p-1 hover:text-[#2A1E17] transition-colors ml-1"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {errorMsg && (
        <p className="text-xs font-sans-ui text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">
          {errorMsg}
        </p>
      )}
    </div>
  );
};

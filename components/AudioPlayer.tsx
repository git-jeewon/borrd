import React, { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  src: string;
}

export default function AudioPlayer({ src }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isWaveformReady, setIsWaveformReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [currentRegion, setCurrentRegion] = useState<any>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wavesurferRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [wavesurfer, setWavesurfer] = useState<any>(null);

  // Initialize WaveSurfer on client side only
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initWaveSurfer = async () => {
      try {
        // Dynamic import to keep bundle small
        const WaveSurfer = (await import('wavesurfer.js')).default;
        
        if (!waveformRef.current) return;

        // Create WaveSurfer instance with regions plugin
        const ws = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: '#8b5cf6', // Purple color matching the theme
          progressColor: '#7c3aed',
          cursorColor: 'transparent',
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          height: 48,
          normalize: true,
          hideScrollbar: true,
          interact: true, // Enable interaction for region selection
          autoCenter: true,
        });

        // Set up event listeners before loading
        ws.on('ready', () => {
          console.log('WaveSurfer ready');
          setIsLoading(false);
          setIsWaveformReady(true);
        });

        ws.on('play', () => {
          console.log('WaveSurfer playing');
          setIsPlaying(true);
        });

        ws.on('pause', () => {
          console.log('WaveSurfer paused');
          setIsPlaying(false);
        });

        ws.on('finish', () => {
          console.log('WaveSurfer finished');
          // Loop the audio - restart from beginning
          ws.seekTo(0);
          ws.play();
          // Keep playing state as true since we're looping
          setIsPlaying(true);
        });

        ws.on('error', (error: Error) => {
          console.error('WaveSurfer error:', error);
          setIsLoading(false);
        });

        // Handle waveform clicks (create new region)
        ws.on('click', (position: number) => {
          console.log('Waveform clicked at position:', position);
          
          // Remove existing region
          if (currentRegion) {
            currentRegion.remove();
          }
          
          // Create a new region around the click point
          const duration = ws.getDuration();
          const regionWidth = Math.min(5, duration * 0.1); // 5 seconds or 10% of duration, whichever is smaller
          const start = Math.max(0, position - regionWidth / 2);
          const end = Math.min(duration, start + regionWidth);
          
          // Only create region if we have the regions plugin available
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newRegion = (ws as any).addRegion({
              start: start,
              end: end,
              color: 'rgba(139, 92, 246, 0.3)',
              handleStyle: {
                left: {
                  backgroundColor: '#8b5cf6',
                  border: '2px solid #7c3aed',
                },
                right: {
                  backgroundColor: '#8b5cf6',
                  border: '2px solid #7c3aed',
                }
              }
            });
            
            setCurrentRegion(newRegion);
          } catch {
            console.log('Regions plugin not available, skipping region creation');
          }
        });

        setWavesurfer(ws);
        wavesurferRef.current = ws;

        // Load audio after setting up listeners
        console.log('Loading audio:', src);
        await ws.load(src);

      } catch (error) {
        console.error('Error initializing WaveSurfer:', error);
        setIsLoading(false);
      }
    };

    initWaveSurfer();

    // Cleanup function
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [src, currentRegion]);

  const togglePlay = () => {
    if (!wavesurfer) return;

    if (isPlaying) {
      wavesurfer.pause();
    } else {
      wavesurfer.play();
    }
  };

  const clearRegion = () => {
    if (currentRegion && wavesurfer) {
      currentRegion.remove();
      setCurrentRegion(null);
    }
  };

  return (
    <div className="my-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center space-x-3">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          disabled={isLoading || !isWaveformReady}
          className="flex-shrink-0 w-12 h-12 bg-purple-600 text-white rounded-full hover:bg-purple-700 focus:ring-2 focus:ring-purple-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Waveform Container */}
        <div className="flex-1 relative">
          <div 
            ref={waveformRef}
            className="h-12 bg-transparent cursor-pointer"
          />
          {/* Region indicator */}
          {currentRegion && (
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <div className="flex items-center justify-center h-full">
                <div className="bg-purple-600 text-white rounded-full p-1 opacity-80">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Clear Region Button */}
        {currentRegion && (
          <button
            onClick={clearRegion}
            className="flex-shrink-0 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            title="Clear selection"
          >
            Clear
          </button>
        )}

        {/* Audio Icon */}
        <div className="flex-shrink-0 text-purple-600">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.794L4.5 14H2a1 1 0 01-1-1V7a1 1 0 011-1h2.5l3.883-2.794a1 1 0 011.617.794zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  );
} 
import React from 'react';

interface VideoPlayerProps {
  src: string;
}

export default function VideoPlayer({ src }: VideoPlayerProps) {
  return (
    <div className="my-4">
      <video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        className="w-full max-w-2xl rounded-lg shadow-sm"
        style={{ maxHeight: '400px' }}
      />
    </div>
  );
} 
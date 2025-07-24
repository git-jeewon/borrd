import React from 'react';
import ReactMarkdown from 'react-markdown';
import AudioPlayer from './AudioPlayer';
import VideoPlayer from './VideoPlayer';

interface CustomMarkdownProps {
  children: string;
}

export default function CustomMarkdown({ children }: CustomMarkdownProps) {
  // Custom renderer for audio and video tags
  const components = {
    p: ({ children, ...props }: React.ComponentProps<'p'>) => {
      // Convert children to string to check for media tags
      const content = React.Children.toArray(children)
        .map(child => {
          if (typeof child === 'string') return child;
          if (React.isValidElement(child) && typeof child.props.children === 'string') {
            return child.props.children;
          }
          return '';
        })
        .join('');
      
      // Check if this paragraph contains an audio tag
      if (content.trim().startsWith('!audio(') && content.trim().endsWith(')')) {
        const audioUrl = content.trim().slice(7, -1); // Remove !audio( and )
        return <AudioPlayer src={audioUrl} />;
      }
      
      // Check if this paragraph contains a video tag
      if (content.trim().startsWith('!video(') && content.trim().endsWith(')')) {
        const videoUrl = content.trim().slice(7, -1); // Remove !video( and )
        return <VideoPlayer src={videoUrl} />;
      }
      
      // Default paragraph rendering
      return <p {...props}>{children}</p>;
    }
  };

  return (
    <ReactMarkdown components={components}>
      {children}
    </ReactMarkdown>
  );
} 
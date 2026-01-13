// ProcessingProgressBar.tsx
import React from 'react';
import { ProcessingStatus } from './types';
import { Loader2 } from 'lucide-react';

interface ProcessingProgressBarProps {
  status: ProcessingStatus;
  progress: number;
}

const ProcessingProgressBar: React.FC<ProcessingProgressBarProps> = ({ 
  status, 
  progress 
}) => {
  if (status === 'idle' || status === 'complete') {
    return null;
  }

  // Ensure progress is always between 0-100
  const safeProgress = Math.max(0, Math.min(100, progress));
  
  // Custom color based on progress
  const getBarColor = () => {
    if (status === 'error') return 'bg-red-500';
    if (safeProgress < 30) return 'bg-blue-500';
    if (safeProgress < 60) return 'bg-blue-600';
    if (safeProgress < 90) return 'bg-green-500';
    return 'bg-green-600';
  };

  return (
    <div className="w-full mt-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center text-xs text-gray-600">
          {status === 'error' ? (
            <span className="text-red-500">Processing failed</span>
          ) : (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              <span>
                {status === 'queued' 
                  ? 'Waiting to process...' 
                  : `Processing CSV: ${Math.round(safeProgress)}%`
                }
              </span>
            </>
          )}
        </div>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-300 ease-out ${getBarColor()}`}
          style={{ 
            width: `${safeProgress}%`,
            transition: 'width 0.3s ease-out'
          }}
        />
      </div>
    </div>
  );
};

export default ProcessingProgressBar;
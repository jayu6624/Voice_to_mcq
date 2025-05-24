import React from 'react';

interface ProgressBarProps {
  progress: number;
  status: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, status }) => {
  return (
    <div className="progress-container">
      <div className="status-text">
        Status: {status}
      </div>
      <div className="progress-bar-outer">
        <div 
          className="progress-bar-inner" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="progress-text">{progress}%</div>
    </div>
  );
};

export default ProgressBar;

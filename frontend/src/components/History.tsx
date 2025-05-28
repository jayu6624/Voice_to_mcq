import React from 'react';
import { useSocket } from '../contexts/SocketContext';
import { FileText, CheckCircle, AlertCircle, Loader, Clock, Trash } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface HistoryProps {
  onViewTranscript: (file: any) => void;
  onDeleteFile: (file: any) => void;
}

const History: React.FC<HistoryProps> = ({ onViewTranscript, onDeleteFile }) => {
  const { uploadedFiles } = useSocket();
  
  // Sort files by timestamp, newest first
  const sortedFiles = [...uploadedFiles].sort((a, b) => 
    (b.timestamp || 0) - (a.timestamp || 0)
  );
  
  return (
    <div className="divide-y divide-gray-100">
      {sortedFiles.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          <div className="mb-4 flex justify-center">
            <Clock className="w-10 h-10 text-gray-300" />
          </div>
          <p>No upload history yet</p>
          <p className="text-sm mt-1">Files you upload will appear here</p>
        </div>
      ) : (
        sortedFiles.map(file => (
          <div key={file.file.name} className="p-4 hover:bg-gray-50/80 transition-colors">
            <div className="flex items-center mb-2">
              <div className={`p-2 rounded mr-3 ${file.status === 'done' ? 'bg-green-50' : 
                file.status === 'error' ? 'bg-red-50' : 
                file.status === 'processing' ? 'bg-amber-50' : 'bg-blue-50'}`}>
                <FileText className={`w-4 h-4 ${file.status === 'done' ? 'text-green-600' : 
                  file.status === 'error' ? 'text-red-500' : 
                  file.status === 'processing' ? 'text-amber-600' : 'text-blue-500'}`} />
              </div>
              <p className="text-sm font-medium text-gray-800 truncate flex-1">
                {file.file.name}
              </p>
            </div>
            
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                {file.status === 'done' ? (
                  <span className="text-xs text-green-600 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" /> Completed
                  </span>
                ) : file.status === 'processing' ? (
                  <span className="text-xs text-amber-600 flex items-center">
                    <Loader className="w-3 h-3 mr-1 animate-spin" /> Processing {file.progress}%
                  </span>
                ) : file.status === 'error' ? (
                  <span className="text-xs text-red-500 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" /> Error
                  </span>
                ) : (
                  <span className="text-xs text-blue-500 flex items-center">
                    <Loader className="w-3 h-3 mr-1 animate-spin" /> Uploading {file.progress}%
                  </span>
                )}
              </div>
              
              <span className="text-xs text-gray-400">
                {file.timestamp ? formatDistanceToNow(file.timestamp, { addSuffix: true }) : ''}
              </span>
            </div>
            
            {(file.status === 'uploading' || file.status === 'processing') && (
              <div className="w-full bg-gray-200 rounded-full h-1 mb-3">
                <div
                  className={`h-1 rounded-full transition-all duration-300 ${
                    file.status === 'processing' ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${file.progress}%` }}
                />
              </div>
            )}
            
            <div className="flex space-x-2 mt-2">
              {file.status === 'done' && (
                <button
                  onClick={() => onViewTranscript(file)}
                  className="flex-1 py-1.5 px-3 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors flex items-center justify-center"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  View Transcript
                </button>
              )}
              <button
                onClick={() => onDeleteFile(file)}
                className={`${file.status === 'done' ? 'flex-1' : 'w-full'} py-1.5 px-3 text-xs bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-red-600 rounded transition-colors flex items-center justify-center`}
              >
                <Trash className="w-3.5 h-3.5 mr-1.5" />
                {file.status === 'done' ? 'Delete' : 'Remove'}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default History;

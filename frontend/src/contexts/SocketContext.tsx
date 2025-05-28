import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  initializeSocket, 
  addEventListener,
  getSocket
} from '../utils/socketManager';
import axios from 'axios';

// Add timestamp to UploadedFile interface
interface UploadedFile {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
  fileName?: string;
  transcript?: any;
  timestamp?: number; // Add timestamp
}

interface LogMessage {
  message: string;
  isError?: boolean;
  timestamp: Date;
}

interface SocketContextType {
  socketId: string | null;
  isConnected: boolean;
  uploadedFiles: UploadedFile[];
  logs: LogMessage[];
  addFile: (file: UploadedFile) => void;
  updateFile: (fileName: string, updates: Partial<UploadedFile>) => void;
  removeFile: (fileId: string) => void;
  deleteFile: (fileId: string, serverFileName?: string) => Promise<boolean>;
  addLog: (message: string, isError?: boolean) => void;
}

const SocketContext = createContext<SocketContextType>({
  socketId: null,
  isConnected: false,
  uploadedFiles: [],
  logs: [],
  addFile: () => {},
  updateFile: () => {},
  removeFile: () => {},
  deleteFile: async () => false,
  addLog: () => {},
});

export const useSocket = () => useContext(SocketContext);

// Storage key for persisting files
const STORAGE_KEY = 'voice_to_mcq_uploaded_files';

export const SocketProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [socketId, setSocketId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(() => {
    // Load files from localStorage on init
    const savedFiles = localStorage.getItem(STORAGE_KEY);
    if (savedFiles) {
      try {
        const parsedFiles = JSON.parse(savedFiles);
        // Reconstruct File objects - we only store metadata in localStorage
        return parsedFiles.map((file: any) => ({
          ...file,
          file: new File([], file.file.name, { 
            type: file.file.type,
            lastModified: file.file.lastModified
          })
        }));
      } catch (e) {
        console.error('Failed to parse stored files:', e);
        return [];
      }
    }
    return [];
  });
  const [logs, setLogs] = useState<LogMessage[]>([]);

  // Initialize socket on mount
  useEffect(() => {
    // Force socket initialization
    const socket = initializeSocket();
    
    const removeConnectionListener = addEventListener('connection-established', (data: any) => {
      console.log("Connection established event in context:", data);
      setSocketId(data.socketId);
      setIsConnected(true);
      addLog(`Socket connected with ID: ${data.socketId}`);
    });
    
    const removeStatusListener = addEventListener('transcription-status', (data: any) => {
      console.log("Transcription status event:", data);
      updateFileStatus(data.fileName, data.status);
      addLog(`Transcription ${data.status} for ${data.fileName}`);
    });
    
    const removeProgressListener = addEventListener('transcription-progress', (data: any) => {
      console.log("Progress event:", data);
      updateFileProgress(data.fileName, data.progress);
    });
    
    const removeLogListener = addEventListener('transcription-log', (data: any) => {
      addLog(data.log, data.isError);
    });
    
    const removeCompleteListener = addEventListener('transcription-complete', (data: any) => {
      console.log('Transcription complete event received in context:', data);
      
      // Force the progress to 100% first (in case it's not already)
      updateFileProgress(data.fileName, 100);
      
      // Add a small delay before updating status to "done" to ensure the progress bar animation completes
      setTimeout(() => {
        addLog(`Transcription completed for ${data.fileName}`);
        updateFileToComplete(data.fileName, data.metadata || {}, data.timestamp || Date.now());
      }, 300);
    });
    
    const removeDisconnectListener = addEventListener('socketDisconnected', () => {
      setIsConnected(false);
      setSocketId(null);
      addLog('Socket disconnected, trying to reconnect...', true);
    });
    
    const removeReconnectListener = addEventListener('socketReconnected', (attempt: number) => {
      const socketInstance = getSocket();
      setIsConnected(true);
      setSocketId(socketInstance?.id ?? null);
      addLog(`Reconnected after ${attempt} attempts. Socket ID: ${socketInstance?.id}`);
    });
    
    // Initial socket status check
    if (socket.connected) {
      setIsConnected(true);
      setSocketId(socket.id ?? null);
    } else {
      setSocketId(null);
    }
    
    return () => {
      removeConnectionListener();
      removeStatusListener();
      removeProgressListener();
      removeLogListener();
      removeCompleteListener();
      removeDisconnectListener();
      removeReconnectListener();
      
      // We don't close the socket when unmounting context
      // This is intentional to keep socket alive across navigations
    };
  }, []);

  // Save files to localStorage whenever they change
  useEffect(() => {
    // Store simplified version of files (can't store File objects directly)
    const filesForStorage = uploadedFiles.map(file => ({
      ...file,
      file: {
        name: file.file.name,
        type: file.file.type,
        size: file.file.size,
        lastModified: file.file.lastModified
      }
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filesForStorage));
  }, [uploadedFiles]);

  const addLog = (message: string, isError = false) => {
    setLogs(prev => [...prev, { message, isError, timestamp: new Date() }]);
  };

  // A more robust updateFileStatus that handles path differences
  const updateFileStatus = (fileName: string, status: string) => {
    const baseFileName = fileName.split('/').pop() || fileName;
    
    setUploadedFiles(prev => 
      prev.map(file => {
        // Try different matching strategies with improved debugging
        const fileBaseName = file.file.name.split('.')[0].toLowerCase();
        const serverBaseName = baseFileName.split('.')[0].toLowerCase();
        
        const matches = 
          file.fileName === fileName || 
          file.fileName === baseFileName || 
          fileName.includes(fileBaseName) || 
          baseFileName.includes(fileBaseName) ||
          fileBaseName.includes(serverBaseName);
          
        if (matches) {
          console.log(`Updating status for ${file.file.name} to ${status}`);
          return { 
            ...file, 
            status: status === 'started' ? 'processing' : 'uploading',
            // Clear any previous errors when status changes positively
            error: undefined
          };
        }
        return file;
      })
    );
  };

  // Update enhanced updateFileToComplete function to ensure completion status is correctly set
  const updateFileToComplete = (serverFileName: string, transcript: any, timestamp: number = Date.now()) => {
    console.log('Setting file to DONE status:', serverFileName);
    
    // Extract the base filename without path
    const baseServerFileName = serverFileName.split('/').pop() || serverFileName;
    
    setUploadedFiles(prev => {
      // Try different matching strategies to find the file
      const updatedFiles: UploadedFile[] = prev.map(file => {
        // More thorough matching logic
        const fileBaseName = file.file.name.split('.')[0].toLowerCase();
        const serverBaseName = baseServerFileName.split('.')[0].toLowerCase();
        
        // First try exact file name match
        if (file.fileName === serverFileName || file.fileName === baseServerFileName) {
          console.log(`Exact match found for ${file.fileName}, updating to DONE`);
          return { ...file, status: 'done', progress: 100, transcript, timestamp, error: undefined };
        }
        
        // Try partial name matching (more comprehensive)
        if ((serverFileName && serverFileName.toLowerCase().includes(fileBaseName)) || 
            (baseServerFileName && baseServerFileName.toLowerCase().includes(fileBaseName)) ||
            (fileBaseName.includes(serverBaseName))) {
          console.log(`Partial match found for ${file.file.name}, updating to DONE`);
          return { 
            ...file, 
            status: 'done', 
            progress: 100, 
            transcript, 
            fileName: serverFileName, 
            timestamp,
            error: undefined
          };
        }
        
        // Check for processing status as fallback
        if (file.status === 'processing') {
          console.log(`Processing file found (${file.file.name}), updating to DONE as fallback`);
          return { 
            ...file, 
            status: 'done', 
            progress: 100, 
            transcript, 
            fileName: file.fileName || serverFileName, 
            timestamp,
            error: undefined
          };
        }
        
        return file;
      });
      
      // Log if we didn't find any files to update
      if (JSON.stringify(updatedFiles) === JSON.stringify(prev)) {
        console.warn('No files were updated to DONE status. Available files:', 
          prev.map(f => ({ name: f.file.name, fileName: f.fileName, status: f.status }))
        );
      }
      
      return updatedFiles;
    });
  };
  
  // Improved progress update function that ensures smooth progress transitions
  const updateFileProgress = (fileName: string, progress: number) => {
    if (!fileName && progress !== 100) {
      console.warn('Received progress update without filename:', progress);
      return;
    }
    
    const baseFileName = fileName ? fileName.split('/').pop() || fileName : '';
    
    setUploadedFiles(prev => 
      prev.map(file => {
        const fileBaseName = file.file.name.split('.')[0].toLowerCase();
        const serverBaseName = baseFileName.split('.')[0].toLowerCase();
        
        // More comprehensive matching logic
        const matches = 
          file.fileName === fileName || 
          file.fileName === baseFileName ||
          (fileName && fileName.toLowerCase().includes(fileBaseName)) ||
          (baseFileName && baseFileName.toLowerCase().includes(fileBaseName)) ||
          (fileBaseName.includes(serverBaseName)) ||
          // Special case - if progress is 100%, also check processing files
          (progress === 100 && file.status === 'processing');
        
        if (matches) {
          console.log(`Updating progress for ${file.file.name} from ${file.progress}% to ${progress}%`);
          
          // Never decrease progress
          const newProgress = Math.max(progress, file.progress || 0);
          
          // For 100% progress, ensure we're showing "done" state
          if (newProgress === 100) {
            return { 
              ...file, 
              progress: newProgress,
              // Only update status to done if we're at 100%
              status: file.status === 'processing' || file.status === 'uploading' ? 'done' : file.status,
              error: undefined // Clear any errors when we reach 100%
            };
          }
          
          return { ...file, progress: newProgress };
        }
        
        return file;
      })
    );
  };
  
  const addFile = (file: UploadedFile) => {
    // Add timestamp if not provided
    const fileWithTimestamp = {
      ...file,
      timestamp: file.timestamp || Date.now()
    };
    setUploadedFiles(prev => [...prev, fileWithTimestamp]);
  };

  const updateFile = (fileId: string, updates: Partial<UploadedFile>) => {
    setUploadedFiles(prev => 
      prev.map(file => 
        file.file.name === fileId 
          ? { ...file, ...updates }
          : file
      )
    );
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.file.name !== fileId));
  };

  // New function to delete file from server and storage
  const deleteFile = async (fileId: string, serverFileName?: string) => {
    try {
      const fileToDelete = uploadedFiles.find(f => f.file.name === fileId);
      if (!fileToDelete) return false;
      
      const fileName = serverFileName || fileToDelete.fileName;
      
      if (fileName) {
        // Delete from server
        await axios.delete(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/transcription/delete/${encodeURIComponent(fileName)}`);
      }
      
      // Remove from local state regardless of server response
      removeFile(fileId);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  };

  return (
    <SocketContext.Provider 
      value={{
        socketId,
        isConnected,
        uploadedFiles,
        logs,
        addFile,
        updateFile,
        removeFile,
        deleteFile, // Add the new function to the context
        addLog,
      }}>
      {children}
    </SocketContext.Provider>
  );
};

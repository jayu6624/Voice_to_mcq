import React, { useState, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { HiUpload } from 'react-icons/hi';
import { Upload as UploadIcon, Plus, FileText, X, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import axios from 'axios';

const ALLOWED_FILE_TYPES = [
  'audio/wav',
  'audio/mpeg',
  'audio/mp4',
  'video/mp4',
  'audio/m4a',
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const API_URL = 'http://localhost:5000'; // Your server endpoint

interface UploadedFile {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
  fileName?: string; // For tracking on the server
  transcript?: any; // For storing transcript metadata
}

interface LogMessage {
  message: string;
  isError?: boolean;
  timestamp: Date;
}

const Upload: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [transcriptChunks, setTranscriptChunks] = useState<string[]>([]);
  const [selectedChunk, setSelectedChunk] = useState<string | null>(null);
  const [chunkContent, setChunkContent] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(API_URL);
    
    newSocket.on('connection-established', (data) => {
      setSocketId(data.socketId);
      addLog(`Socket connected with ID: ${data.socketId}`);
    });
    
    newSocket.on('transcription-status', (data) => {
      updateFileStatus(data.fileName, data.status);
      addLog(`Transcription ${data.status} for ${data.fileName}`);
    });
    
    newSocket.on('transcription-progress', (data) => {
      updateFileProgress(data.fileName, data.progress);
    });
    
    newSocket.on('transcription-log', (data) => {
      addLog(data.log, data.isError);
    });
    
    newSocket.on('transcription-complete', (data) => {
      console.log('Transcription complete event received:', data);
      addLog(`Transcription completed for ${data.fileName}`);
      
      // Force the file to be marked as complete regardless of matching logic
      setUploadedFiles(prev => {
        return prev.map(file => {
          // If this is the only file or we're processing only one file, assume it's this one
          if (prev.length === 1 || 
              // Or try to match by fileName if available
              (file.fileName && (file.fileName.includes(data.fileName) || data.fileName.includes(file.fileName))) ||
              // Or try to match by original file name
              data.fileName.includes(file.file.name) || file.file.name.includes(data.fileName)) {
            return { ...file, status: 'done', progress: 100, fileName: data.fileName, transcript: data.metadata };
          }
          return file;
        });
      });
    });
    
    newSocket.on('disconnect', () => {
      setSocketId(null);
      addLog('Socket disconnected, trying to reconnect...', true);
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      addLog(`Connection error: ${error.message}`, true);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      addLog(`Reconnected after ${attemptNumber} attempts`);
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (message: string, isError = false) => {
    setLogs(prev => [...prev, { message, isError, timestamp: new Date() }]);
  };

  const updateFileStatus = (fileName: string, status: string) => {
    setUploadedFiles(prev => 
      prev.map(file => 
        file.fileName === fileName 
          ? { ...file, status: status === 'started' ? 'processing' : 'uploading' }
          : file
      )
    );
  };

  const updateFileProgress = (fileName: string, progress: number) => {
    setUploadedFiles(prev => 
      prev.map(file => 
        file.fileName === fileName 
          ? { ...file, progress }
          : file
      )
    );
  };

  // Completely revamped updateFileComplete function with better matching
  const updateFileComplete = (serverFileName: string, transcript: any) => {
    console.log('Updating file to complete status:', serverFileName);
    
    // Extract the base filename without path
    const baseServerFileName = serverFileName.split('/').pop() || serverFileName;
    
    setUploadedFiles(prev => {
      // First try to find an exact match by fileName
      const exactMatch = prev.find(f => 
        f.fileName === serverFileName || 
        f.fileName === baseServerFileName
      );
      
      if (exactMatch) {
        console.log('Found exact match by fileName:', exactMatch.fileName);
        return prev.map(file => 
          file === exactMatch 
            ? { ...file, status: 'done', progress: 100, transcript }
            : file
        );
      }
      
      // If no exact match, try matching by timestamp or partial file name
      const timeMatch = prev.find(f => {
        const timestamp = extractTimestamp(f.file.name);
        return timestamp && serverFileName.includes(timestamp);
      });
      
      if (timeMatch) {
        console.log('Found match by timestamp:', timeMatch.file.name);
        return prev.map(file => 
          file === timeMatch 
            ? { ...file, status: 'done', progress: 100, transcript, fileName: serverFileName }
            : file
        );
      }
      
      // Last resort: update the first processing file we find
      const processingFile = prev.find(f => f.status === 'processing');
      if (processingFile) {
        console.log('Updating first processing file as fallback');
        return prev.map(file => 
          file === processingFile 
            ? { ...file, status: 'done', progress: 100, transcript, fileName: serverFileName }
            : file
        );
      }
      
      // If all else fails, don't update anything
      console.log('No matching file found for completion update');
      return prev;
    });
  };
  
  // Helper function to extract timestamp from file names like "2025-03-07 16-57-59.mp4"
  const extractTimestamp = (fileName: string): string | null => {
    const match = fileName.match(/(\d{4}-\d{2}-\d{2}[\s_-]\d{2}[-_:]\d{2}[-_:]\d{2})/);
    return match ? match[1] : null;
  };

  const updateFileError = (fileName: string, error: string) => {
    const baseFileName = fileName.split('/').pop() || fileName;
    
    setUploadedFiles(prev => {
      // Try exact match first
      const fileExists = prev.some(f => f.fileName === fileName || f.fileName === baseFileName);
      
      if (!fileExists) {
        // Try matching by original name
        return prev.map(file => {
          if (fileName.includes(file.file.name) || baseFileName.includes(file.file.name)) {
            return { ...file, status: 'error', error, fileName: fileName };
          }
          return file;
        });
      }
      
      // Update by fileName
      return prev.map(file => 
        (file.fileName === fileName || file.fileName === baseFileName)
          ? { ...file, status: 'error', error }
          : file
      );
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return 'File type not supported. Please upload MP3, WAV, M4A, or MP4 files.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 500MB limit.';
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    if (!socketId) {
      addLog('Socket connection not established. Please try again.', true);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('video', file); // Server expects 'video' as field name
      formData.append('socketId', socketId);

      const response = await axios.post(`${API_URL}/api/transcription/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadedFiles(prev => 
              prev.map(f => 
                f.file === file 
                  ? { ...f, progress: Math.min(progress, 99) } // Cap at 99% until processing completes
                  : f
              )
            );
          }
        },
      });

      if (response.data.success) {
        console.log('File uploaded successfully:', response.data);
        addLog(`File ${file.name} uploaded successfully as ${response.data.fileName}, transcription started.`);
        
        // Store server-provided fileName
        setUploadedFiles(prev => 
          prev.map(f => 
            f.file === file 
              ? { ...f, fileName: response.data.fileName, status: 'processing' }
              : f
          )
        );
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      setUploadedFiles(prev => 
        prev.map(f => 
          f.file === file 
            ? { ...f, status: 'error', error: errorMessage }
            : f
        )
      );
      addLog(`Error uploading ${file.name}: ${errorMessage}`, true);
    }
  };

  const handleFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const error = validateFile(file);
      if (error) {
        setUploadedFiles((prev) => [
          ...prev,
          {
            file,
            progress: 0,
            status: 'error',
            error,
          },
        ]);
        addLog(`Validation failed for ${file.name}: ${error}`, true);
        return;
      }

      // Add file to list and start upload
      setUploadedFiles((prev) => [
        ...prev,
        {
          file,
          progress: 0,
          status: 'uploading',
        },
      ]);
      
      // Start actual upload
      uploadFile(file);
    });
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (file: File) => {
    setUploadedFiles((prev) => prev.filter((f) => f.file !== file));
    if (selectedFile?.file === file) {
      setSelectedFile(null);
      setTranscriptChunks([]);
      setSelectedChunk(null);
      setChunkContent('');
    }
  };

  const viewTranscript = async (fileData: UploadedFile) => {
    setSelectedFile(fileData);
    
    if (fileData.transcript) {
      // If we already have the transcript data
      if (fileData.transcript.chunks) {
        setTranscriptChunks(fileData.transcript.chunks);
      }
    } else if (fileData.fileName) {
      // Fetch transcript data
      try {
        const baseFileName = fileData.fileName.split('.')[0];
        const response = await axios.get(`${API_URL}/api/transcription/transcripts/${baseFileName}`);
        
        if (response.data.success) {
          // Update file with transcript data
          const transcript = response.data.metadata;
          setUploadedFiles(prev => 
            prev.map(f => 
              f === fileData 
                ? { ...f, transcript }
                : f
            )
          );
          
          setTranscriptChunks(transcript.chunks || []);
        }
      } catch (error) {
        console.error('Error fetching transcript:', error);
        addLog(`Error fetching transcript for ${fileData.fileName}`, true);
      }
    }
  };

  const fetchChunkContent = async (chunkFile: string) => {
    if (!selectedFile?.transcript) return;
    
    try {
      const index = selectedFile.transcript.chunks.indexOf(chunkFile);
      if (index >= 0 && selectedFile.transcript.chunk_files[index]) {
        const response = await axios.get(`${API_URL}${selectedFile.transcript.chunk_files[index].replace(/^\./, '')}`);
        setChunkContent(response.data);
      }
    } catch (error) {
      console.error('Error fetching chunk content:', error);
      setChunkContent('Error loading transcript chunk');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Files</h1>
          <p className="mt-1 text-sm text-gray-500">
            Add your audio or video files for transcription
          </p>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-2xl transition-colors ${
          isDragging
            ? 'border-purple-600 bg-purple-50'
            : 'border-gray-200 hover:border-purple-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="p-8">
          <div className="max-w-xl mx-auto text-center">
            <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <UploadIcon className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Drag and drop your files here
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              or click to browse from your computer
              {socketId ? (
                <span className="ml-2 text-green-600 text-xs">• Connected</span>
              ) : (
                <span className="ml-2 text-amber-600 text-xs">• Connecting...</span>
              )}
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
              disabled={!socketId}
            >
              Browse Files
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInput}
              accept=".mp3,.wav,.m4a,.mp4"
              className="hidden"
              multiple
            />
          </div>
        </div>
        <div className="border-t border-gray-100 px-8 py-4">
          <p className="text-xs text-gray-500">
            Supported formats: MP3, WAV, M4A, MP4 (max 500MB)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Uploaded Files List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900">Uploaded Files</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {uploadedFiles.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No files uploaded yet
              </div>
            ) : (
              uploadedFiles.map(({ file, progress, status, error }) => (
                <div
                  key={file.name}
                  className="flex items-center px-6 py-4 hover:bg-gray-50/50"
                >
                  <div className="p-2 bg-purple-50 rounded-lg mr-4">
                    <FileText className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {status === 'error' ? (
                        <span className="text-red-500 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" /> {error}
                        </span>
                      ) : (
                        <>
                          <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                          {status === 'done' ? (
                            <span className="ml-2 text-green-600 flex items-center">
                              <CheckCircle className="w-3 h-3 mr-1" /> Completed
                            </span>
                          ) : status === 'processing' ? (
                            <span className="ml-2 text-amber-600 flex items-center">
                              <Loader className="w-3 h-3 mr-1 animate-spin" /> Processing {progress}%
                            </span>
                          ) : (
                            <span className="ml-2">Uploading {progress}%</span>
                          )}
                        </>
                      )}
                    </p>
                    {(status === 'uploading' || status === 'processing') && (
                      <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            status === 'processing' ? 'bg-amber-500' : 'bg-purple-600'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2 ml-4">
                    {status === 'done' && (
                      <button
                        onClick={() => viewTranscript({ file, progress, status, error })}
                        className="p-1 text-purple-600 hover:text-purple-800 rounded-lg"
                        title="View Transcript"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => removeFile(file)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded-lg"
                      title="Remove File"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Logs or Transcript Display */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          {selectedFile ? (
            // Transcript view
            <div>
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-medium text-gray-900">
                  Transcript: {selectedFile.file.name}
                </h2>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                {transcriptChunks.length > 0 ? (
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Chunk selector */}
                    <div className="md:w-1/3">
                      <h3 className="font-medium text-sm mb-2">5-Minute Segments</h3>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {transcriptChunks.map((chunk, index) => (
                          <button 
                            key={chunk}
                            onClick={() => {
                              setSelectedChunk(chunk);
                              fetchChunkContent(chunk);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm rounded-lg ${
                              selectedChunk === chunk 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'hover:bg-gray-100'
                            }`}
                          >
                            {chunk.replace('_', '-')} minutes
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Chunk content */}
                    <div className="md:w-2/3">
                      <h3 className="font-medium text-sm mb-2">
                        {selectedChunk 
                          ? `Transcript (${selectedChunk.replace('_', '-')} minutes)` 
                          : 'Select a segment to view transcript'
                        }
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-3 max-h-72 overflow-y-auto">
                        {chunkContent ? (
                          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">{chunkContent}</pre>
                        ) : (
                          <p className="text-gray-500 italic text-center py-8">
                            {selectedChunk ? 'Loading transcript...' : 'Select a segment to view transcript'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No transcript segments available
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Logs view
            <div>
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-medium text-gray-900">Process Logs</h2>
              </div>
              <div 
                ref={logContainerRef}
                className="p-4 max-h-72 overflow-y-auto bg-gray-800 text-gray-200 font-mono text-sm"
              >
                {logs.length === 0 ? (
                  <div className="text-gray-400 italic text-center py-4">
                    No logs yet. Upload a file to begin.
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <div 
                      key={index} 
                      className={`py-1 ${log.isError ? 'text-red-400' : ''}`}
                    >
                      <span className="text-gray-500 mr-2">
                        [{log.timestamp.toLocaleTimeString()}]
                      </span>
                      {log.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Upload;

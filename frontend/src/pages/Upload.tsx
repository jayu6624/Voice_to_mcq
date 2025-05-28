import React, { useState, useRef, useEffect } from 'react';
import { HiUpload } from 'react-icons/hi';
import { Upload as UploadIcon, FileText, X, AlertCircle, CheckCircle, Loader, History as HistoryIcon } from 'lucide-react';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import { API_URL, getSocket, isConnected } from '../utils/socketManager';
import History from '../components/History';
import ConfirmDialog from '../components/ConfirmDialog';

const ALLOWED_FILE_TYPES = [
  'audio/wav',
  'audio/mpeg',
  'audio/mp4',
  'video/mp4',
  'audio/m4a',
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const Upload: React.FC = () => {
  const { 
    socketId, 
    isConnected, 
    uploadedFiles, 
    logs, 
    addFile, 
    updateFile,
    removeFile,
    deleteFile,
    addLog 
  } = useSocket();
  
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [transcriptChunks, setTranscriptChunks] = useState<string[]>([]);
  const [selectedChunk, setSelectedChunk] = useState<string | null>(null);
  const [chunkContent, setChunkContent] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false); // New state for history panel
  
  // For deletion confirmation
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    file: null as any,
    action: '' as 'remove' | 'delete'
  });

  // Auto-scroll logs and force reconnect if needed
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
    
    // Force ensure we have a socket
    getSocket();
  }, [logs]);

  // Listen for transcription completion events
  useEffect(() => {
    if (!isConnected) return;
    
    // Socket event when transcription is complete - with enhanced file matching
    const handleTranscriptionComplete = (data: any) => {
      console.log('Transcription complete event received in component:', data);
      const { fileName, originalName } = data;
      
      // Find the file in our list with improved matching logic
      const file = uploadedFiles.find(f => {
        // Extract base names for better matching
        const fileBaseName = f.file.name.split('.')[0].toLowerCase();
        const serverBaseName = fileName?.split('/').pop()?.split('.')[0].toLowerCase() || '';
        const originalBaseName = originalName?.split('.')[0].toLowerCase() || '';
        
        // More comprehensive matching to handle server-renamed files
        return f.fileName === fileName || 
              f.file.name === originalName || 
              serverBaseName.includes(fileBaseName) ||
              originalBaseName.includes(fileBaseName) ||
              fileBaseName.includes(serverBaseName) ||
              (f.status === 'processing'); // Also check for any files in processing status
      });
      
      if (file) {
        console.log(`Found matching file ${file.file.name} for transcription completion`);
        // First update to 100% progress
        updateFile(file.file.name, { progress: 100 });
        
        // Small delay before changing status to "done" for better visual transition
        setTimeout(() => {
          updateFile(file.file.name, { 
            status: 'done', 
            transcript: data.transcript || file.transcript
          });
          addLog(`Transcription completed for ${file.file.name}`);
        }, 500);
      } else {
        console.warn('Could not find matching file for completion event:', data);
        // Check if this is a processing file that wasn't properly matched
        const processingFiles = uploadedFiles.filter(f => f.status === 'processing');
        if (processingFiles.length > 0) {
          // Update the first processing file we find
          const fileToUpdate = processingFiles[0];
          updateFile(fileToUpdate.file.name, { 
            status: 'done',
            progress: 100,
            transcript: data.transcript,
            fileName: fileName || fileToUpdate.fileName // Keep track of server filename
          });
          addLog(`Transcription completed for ${fileToUpdate.file.name}`);
        }
      }
    };
    
    // Add socket event listener - handle both event naming formats
    const socket = getSocket();
    socket.on('transcription_complete', handleTranscriptionComplete);
    socket.on('transcription-complete', handleTranscriptionComplete);
    
    // Also handle reconnection events to check file status when server restarts
    const handleReconnect = (socketIdOrEvent: string | Event) => {
      // Handle both direct socketId string and Event object cases
      const socketId = typeof socketIdOrEvent === 'string' 
        ? socketIdOrEvent 
        : ((socketIdOrEvent as CustomEvent<string>).detail || '');
        
      console.log('Socket reconnected with ID:', socketId);
      addLog(`Socket reconnected, checking status of processing files...`);
      
      // Wait a moment for the server to stabilize after restart
      setTimeout(() => {
        // Check status of any 'processing' files on reconnection
        uploadedFiles.forEach(file => {
          if (file.status === 'processing' && file.fileName) {
            // Verify the actual status by checking with the server
            checkFileStatus(file);
          }
        });
      }, 1500);
    };
    
    socket.on('connect', () => handleReconnect(socket.id || ''));
    window.addEventListener('socketReconnected', handleReconnect as EventListener);
    
    return () => {
      socket.off('transcription_complete', handleTranscriptionComplete);
      socket.off('transcription-complete', handleTranscriptionComplete);
      socket.off('connect', () => handleReconnect(socket.id || ''));
    };
  }, [isConnected, uploadedFiles]);
  
  // Check processing files on initial load, regardless of socket status
  useEffect(() => {
    // Immediately check any files in processing state when component mounts
    const checkProcessingFiles = async () => {
      const processingFiles = uploadedFiles.filter(f => f.status === 'processing');
      
      if (processingFiles.length > 0) {
        console.log('Found processing files on page load, checking status:', processingFiles.length);
        
        // Check each processing file
        for (const file of processingFiles) {
          await checkFileStatus(file);
        }
      }
    };
    
    checkProcessingFiles();
  }, []); // Empty dependency array ensures this runs once on mount

  // Significantly enhanced checkFileStatus function 
  const checkFileStatus = async (fileObj: any) => {
    if (!fileObj.fileName) return;
    
    try {
      // Extract the base filename from the path
      const fullPath = fileObj.fileName;
      const baseFileName = fullPath.split('/').pop()?.split('.')[0] || fullPath.split('.')[0];
      
      console.log(`Checking status for file: ${baseFileName}`);
      
      // Check if transcript exists
      const response = await axios.get(`${API_URL}/api/transcription/status/${baseFileName}`);
      
      console.log(`Status response for ${baseFileName}:`, response.data);
      
      // If we got a response and the file is completed or we get any transcript data back
      if (response.data.completed || response.data.transcript || response.data.metadata) {
        console.log(`File ${baseFileName} is completed, updating status to done`);
        
        // First set to 100%
        updateFile(fileObj.file.name, { progress: 100 });
        
        // Then update status after a small delay
        setTimeout(() => {
          updateFile(fileObj.file.name, { 
            status: 'done',
            transcript: response.data.transcript || response.data.metadata
          });
          addLog(`Confirmed transcription is complete for ${fileObj.file.name}`);
        }, 300);
        return;
      }
      
      // If the server reports progress, update it
      if (response.data.progress !== undefined) {
        const progress = parseFloat(response.data.progress);
        if (!isNaN(progress)) {
          console.log(`Server reported progress ${progress}% for ${baseFileName}`);
          updateFile(fileObj.file.name, { progress });
          return;
        }
      }
      
      // If the server knows about the file but it's not done yet
      if (response.data.status === 'processing') {
        console.log(`File ${baseFileName} is still processing according to server`);
        updateFile(fileObj.file.name, {
          status: 'processing',
          error: undefined // Clear any previous errors
        });
        return;
      }
            
      // Default case - file exists but status is unclear
      updateFile(fileObj.file.name, { 
        status: 'processing',
        error: undefined // Clear any previous errors
      });
      
    } catch (error: any) {
      console.error('Error checking file status:', error);
      
      // If it's a network error, don't update status as it might be temporary
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        addLog(`Temporary network error, will retry status check later`, true);
        return;
      }
      
      // Check for 404 specifically (file not found on server)
      if (error.response && error.response.status === 404) {
        console.log(`File ${fileObj.file.name} not found on server after restart`);
        
        // Just update with error but don't change status yet
        // as this could be due to server restart
        updateFile(fileObj.file.name, { 
          error: 'File not found on server - it may still be processing'
        });
        return;
      }
      
      // For all other errors, just log but don't immediately change status
      // as this could be due to server restart
      addLog(`Could not verify status for ${fileObj.file.name}, will retry later`, true);
    }
  };

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
      formData.append('videoFile', file); // Updated field name to 'videoFile'
      formData.append('socketId', socketId);

      // Create a new uploadedFile entry
      const fileEntry = {
        file,
        progress: 0,
        status: 'uploading' as const,
        timestamp: Date.now()
      };
      
      addFile(fileEntry);
      
      // Show initial "preparing" state for better UX
      addLog(`Preparing ${file.name} for upload...`);
      
      // Add a longer initial delay for better visual feedback
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate initial progress to improve UX with smoother transition
      let simulatedProgress = 0;
      const progressInterval = setInterval(() => {
        simulatedProgress += 1; // Slower increment
        if (simulatedProgress <= 10) {
          updateFile(file.name, { progress: simulatedProgress });
        } else {
          clearInterval(progressInterval);
        }
      }, 200); // Slower updates
      
      addLog(`Beginning upload for ${file.name}...`);
      
      const response = await axios.post(`${API_URL}/api/transcription/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            // Start from 10% (where our simulation left off) and go to 90%
            const actualProgress = Math.round((progressEvent.loaded * 80) / progressEvent.total) + 10;
            const progress = Math.min(actualProgress, 90);
            
            // Clear our simulation interval if it's still running
            clearInterval(progressInterval);
            
            updateFile(file.name, { progress });
          }
        },
      });

      if (response.data.success) {
        console.log('File uploaded successfully:', response.data);
        addLog(`File ${file.name} uploaded successfully as ${response.data.fileName}, transcription started.`);
        
        // Update file status and name - set to 95% during processing
        updateFile(file.name, { 
          fileName: response.data.fileName,
          status: 'processing',
          progress: 95 // Processing but not complete yet
        });
        
        // Start a periodic check for this file specifically
        const checkStatusInterval = setInterval(async () => {
          try {
            const fileObj = uploadedFiles.find(f => f.file.name === file.name);
            if (!fileObj || fileObj.status === 'done') {
              clearInterval(checkStatusInterval);
              return;
            }
            
            await checkFileStatus(fileObj);
          } catch (error) {
            console.error('Error in status check interval:', error);
          }
        }, 3000);
        
        // Clear interval after 5 minutes (max processing time expected)
        setTimeout(() => clearInterval(checkStatusInterval), 5 * 60 * 1000);
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      updateFile(file.name, {
        status: 'error',
        error: errorMessage
      });
      addLog(`Error uploading ${file.name}: ${errorMessage}`, true);
    }
  };

  const handleFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const error = validateFile(file);
      if (error) {
        addFile({
          file,
          progress: 0,
          status: 'error',
          error,
        });
        addLog(`Validation failed for ${file.name}: ${error}`, true);
        return;
      }

      // Start actual upload - the file will be added in uploadFile
      uploadFile(file);
    });
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleRemoveFile = (file: any) => {
    setConfirmDialog({
      isOpen: true,
      file,
      action: 'remove'
    });
  };

  const handleDeleteFile = (file: any) => {
    setConfirmDialog({
      isOpen: true,
      file,
      action: 'delete'
    });
  };

  const confirmRemoveFile = async () => {
    const file = confirmDialog.file;
    if (!file) return;
    
    if (confirmDialog.action === 'delete') {
      // Delete from server and state
      const deleted = await deleteFile(file.file.name, file.fileName);
      if (deleted) {
        addLog(`File ${file.file.name} deleted successfully`);
      } else {
        addLog(`Error deleting ${file.file.name}`, true);
      }
    } else {
      // Just remove from UI state
      removeFile(file.file.name);
      addLog(`File ${file.file.name} removed from list`);
    }
    
    // If this was the selected file, clear selection
    if (selectedFile?.file === file.file) {
      setSelectedFile(null);
      setTranscriptChunks([]);
      setSelectedChunk(null);
      setChunkContent('');
    }
    
    // Close dialog
    setConfirmDialog({ isOpen: false, file: null, action: 'remove' });
  };

  const viewTranscript = async (fileData: any) => {
    setSelectedFile(fileData);
    
    if (fileData.transcript) {
      // If we already have the transcript data
      if (fileData.transcript.chunks) {
        setTranscriptChunks(fileData.transcript.chunks);
        return;
      }
    }
    
    if (fileData.fileName) {
      try {
        // Extract the base filename from the path
        const fullPath = fileData.fileName;
        const baseFileName = fullPath.split('/').pop()?.split('.')[0] || fullPath.split('.')[0];
        
        addLog(`Fetching transcript data for ${baseFileName}...`);
        const response = await axios.get(`${API_URL}/api/transcription/transcripts/${baseFileName}`);
        
        if (response.data.success) {
          const transcript = response.data.metadata;
          addLog(`Transcript data received with ${transcript.chunks?.length || 0} segments`);
          
          // Update the file in context with transcript data
          updateFile(fileData.file.name, { transcript });
          
          // Update local state for display
          setTranscriptChunks(transcript.chunks || []);
        }
      } catch (error) {
        console.error('Error fetching transcript:', error);
        addLog(`Error fetching transcript: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
      }
    }
  };

  const fetchChunkContent = async (chunkFile: string) => {
    if (!selectedFile?.transcript) return;
    
    try {
      const index = selectedFile.transcript.chunks.indexOf(chunkFile);
      if (index >= 0 && selectedFile.transcript.chunk_files && selectedFile.transcript.chunk_files[index]) {
        const chunkPath = selectedFile.transcript.chunk_files[index];
        const response = await axios.get(`${API_URL}${chunkPath.replace(/^\./, '')}`);
        setChunkContent(response.data);
      } else {
        setChunkContent(`No content available for segment ${chunkFile}`);
      }
    } catch (error) {
      console.error('Error fetching chunk content:', error);
      setChunkContent(`Error loading transcript: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Header with History Icon */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Files</h1>
          <p className="mt-1 text-sm text-gray-500">
            Add your audio or video files for transcription
          </p>
        </div>
        <button
          onClick={() => setIsHistoryOpen(!isHistoryOpen)}
          className={`p-2.5 rounded-full transition-colors ${isHistoryOpen ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          title="Upload History"
        >
          <HistoryIcon className="w-5 h-5" />
          <span className="sr-only">History</span>
        </button>
      </div>

      {/* Collapsible History Panel */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-30 flex justify-end" onClick={() => setIsHistoryOpen(false)}>
          <div 
            className="bg-white h-full w-full max-w-sm shadow-lg transform transition-transform animate-slide-in overflow-hidden" 
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 flex justify-between items-center border-b border-gray-100">
              <h2 className="font-medium text-gray-900 flex items-center">
                <HistoryIcon className="w-4 h-4 mr-2" />
                Upload History
              </h2>
              <button 
                onClick={() => setIsHistoryOpen(false)}
                className="text-gray-400 hover:text-gray-600 rounded-full p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="h-[calc(100%-60px)] overflow-y-auto pb-safe">
              <History 
                onViewTranscript={(file) => {
                  viewTranscript(file);
                  setIsHistoryOpen(false);
                }}
                onDeleteFile={handleDeleteFile}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Main Upload Area + Current Files */}
        <div className="space-y-6">
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
                  {isConnected ? (
                    <span className="ml-2 text-green-600 text-xs">• Connected (ID: {socketId?.substring(0, 6)})</span>
                  ) : (
                    <span className="ml-2 text-amber-600 text-xs animate-pulse">• Connecting...</span>
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
            {/* Currently Uploaded Files List (shows only recent files) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-medium text-gray-900">Recent Uploads</h2>
              </div>
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {uploadedFiles.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    No files uploaded yet
                  </div>
                ) : (
                  uploadedFiles
                    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                    .slice(0, 5) // Show only the 5 most recent uploads
                    .map(({ file, progress, status, error }) => (
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
                                style={{ 
                                  width: `${progress}%`,
                                  // Add transition properties for smoother progress bar updates
                                  transition: 'width 0.5s ease-in-out, background-color 0.3s ease'
                                }}
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
                            onClick={() => handleRemoveFile({ file, progress, status, error })}
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
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.action === 'delete' ? "Delete File" : "Remove File"}
        message={
          confirmDialog.action === 'delete' 
            ? "Are you sure you want to permanently delete this file? This will remove the file from the server and can't be undone."
            : "Remove this file from your list? The file will remain on the server."
        }
        confirmLabel={confirmDialog.action === 'delete' ? "Delete" : "Remove"}
        type={confirmDialog.action === 'delete' ? "danger" : "warning"}
        onConfirm={confirmRemoveFile}
        onCancel={() => setConfirmDialog({ isOpen: false, file: null, action: 'remove' })}
      />
    </div>
  );
};

export default Upload;

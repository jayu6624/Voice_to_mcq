import React, { useState, useRef } from 'react';
import { HiUpload } from 'react-icons/hi';
import { Upload as UploadIcon, Plus, FileText, X } from 'lucide-react';

const ALLOWED_FILE_TYPES = [
  'audio/wav',
  'audio/mpeg',
  'audio/mp4',
  'video/mp4',
  'audio/m4a',
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

interface UploadedFile {
  file: File;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

const Upload: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        return;
      }

      // Simulate upload progress
      setUploadedFiles((prev) => [
        ...prev,
        {
          file,
          progress: 0,
          status: 'uploading',
        },
      ]);

      // Simulate file upload
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.file === file
              ? { ...f, progress, status: progress === 100 ? 'done' : 'uploading' }
              : f
          )
        );
        if (progress === 100) clearInterval(interval);
      }, 500);
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
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
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

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900">Uploaded Files</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {uploadedFiles.map(({ file, progress, status, error }) => (
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
                      <span className="text-red-500">{error}</span>
                    ) : (
                      `${(file.size / (1024 * 1024)).toFixed(2)} MB • ${
                        status === 'done' ? 'Completed' : `${progress}%`
                      }`
                    )}
                  </p>
                  {status === 'uploading' && (
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeFile(file)}
                  className="ml-4 p-1 text-gray-400 hover:text-red-500 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;

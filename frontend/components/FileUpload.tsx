import React, { useState, useRef } from 'react';
import axios from 'axios';

interface FileUploadProps {
  socketId: string | null;
  onUploadStart: (fileName: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ socketId, onUploadStart }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type !== 'video/mp4') {
        setError('Please select an MP4 video file');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !socketId) {
      setError('No file selected or socket connection not established');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('socketId', socketId);

      const response = await axios.post('http://localhost:3001/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        onUploadStart(response.data.fileName);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setError('Upload failed');
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Error uploading file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-upload">
      <h2>Upload Video for Transcription</h2>
      <div className="upload-container">
        <input 
          type="file"
          accept="video/mp4"
          onChange={handleFileSelect}
          disabled={uploading}
          ref={fileInputRef}
        />
        <button 
          onClick={handleUpload} 
          disabled={!selectedFile || uploading || !socketId}
        >
          {uploading ? 'Uploading...' : 'Upload & Transcribe'}
        </button>
      </div>
      {selectedFile && (
        <div className="file-info">
          <p>Selected file: {selectedFile.name}</p>
          <p>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      )}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default FileUpload;

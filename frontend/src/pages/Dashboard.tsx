import React, { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { FileText, Upload as UploadIcon, HelpCircle, Loader } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../utils/socketManager';

interface Stats {
  totalFiles: number;
  totalTranscriptMinutes: number;
  totalMcqs: number;
}

interface TranscriptItem {
  fileId: string;
  fileName: string;
  originalFileName: string;
  createdAt: string;
}

const Dashboard: React.FC = () => {
  const { uploadedFiles, isConnected } = useSocket();
  const [stats, setStats] = useState<Stats>({
    totalFiles: 0,
    totalTranscriptMinutes: 0,
    totalMcqs: 0
  });
  const [recentTranscripts, setRecentTranscripts] = useState<TranscriptItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fix duplicate function - only keep one fetchStats function
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/transcription/stats`);
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  // Add a function to fetch transcripts
  const fetchTranscripts = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/transcription/transcripts`);
      if (response.data.success && response.data.transcripts) {
        // Sort by created date and take 5 most recent
        const sorted = response.data.transcripts
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);
        setRecentTranscripts(sorted);
      }
    } catch (error) {
      console.error('Error fetching transcripts:', error);
    }
  };

  // Fetch both stats and transcripts on component mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchTranscripts()]);
      setLoading(false);
    };
    
    fetchData();
  }, []);

  // Use uploaded files from context as a fallback
  useEffect(() => {
    if (uploadedFiles.length > 0 && stats.totalFiles === 0) {
      setStats(prev => ({
        ...prev,
        totalFiles: uploadedFiles.length
      }));
    }
  }, [uploadedFiles, stats.totalFiles]);

  // Get recent files from uploadedFiles for the Recent Uploads section
  const recentFiles = uploadedFiles
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Files</p>
              <h3 className="text-2xl font-semibold text-gray-900">
                {loading ? '...' : stats.totalFiles}
              </h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <UploadIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Transcript Minutes</p>
              <h3 className="text-2xl font-semibold text-gray-900">
                {loading ? '...' : stats.totalTranscriptMinutes}
              </h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <HelpCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Questions</p>
              <h3 className="text-2xl font-semibold text-gray-900">
                {loading ? '...' : stats.totalMcqs}
              </h3>
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent Transcriptions - New Section */}
      <div className="bg-white rounded-xl shadow border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-medium text-gray-900">Recent Transcriptions</h2>
          <Link 
            to="/transcripts"
            className="text-sm text-purple-600 hover:text-purple-800"
          >
            View All
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-6 text-center">
              <Loader className="w-6 h-6 text-purple-600 animate-spin mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Loading transcripts...</p>
            </div>
          ) : recentTranscripts.length > 0 ? (
            recentTranscripts.map(transcript => (
              <div key={transcript.fileId} className="p-6 flex items-center space-x-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/transcripts?fileId=${transcript.fileId}`} className="text-sm font-medium text-gray-900 truncate hover:text-purple-600">
                    {transcript.originalFileName || transcript.fileName}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {new Date(transcript.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Link to={`/transcripts?fileId=${transcript.fileId}`} className="text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200">
                    View Transcript
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-gray-500">
              No transcripts found. Upload files to create transcriptions.
            </div>
          )}
        </div>
      </div>
      
      {/* Recent Uploads - Existing Section */}
      <div className="bg-white rounded-xl shadow border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-medium text-gray-900">Recent Files</h2>
          <Link 
            to="/upload"
            className="text-sm text-purple-600 hover:text-purple-800"
          >
            Upload New
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {recentFiles.length > 0 ? (
            recentFiles.map(file => (
              <div key={file.file.name} className="p-6 flex items-center space-x-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FileText className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(file.timestamp || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    file.status === 'done' ? 'bg-green-100 text-green-800' : 
                    file.status === 'processing' ? 'bg-yellow-100 text-yellow-800' : 
                    file.status === 'error' ? 'bg-red-100 text-red-800' : 
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {file.status === 'done' ? 'Completed' : 
                     file.status === 'processing' ? 'Processing' :
                     file.status === 'error' ? 'Error' :
                     'Uploading'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-gray-500">
              No files uploaded yet. Go to the Upload page to get started.
            </div>
          )}
        </div>
      </div>
      
      {/* Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link 
          to="/upload"
          className="bg-white rounded-xl shadow border border-gray-100 p-6 flex items-center hover:bg-gray-50"
        >
          <div className="p-3 bg-purple-100 rounded-lg mr-4">
            <UploadIcon className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">Upload Files</h3>
            <p className="text-sm text-gray-500">Upload audio/video for transcription</p>
          </div>
        </Link>
        
        <Link 
          to="/transcripts"
          className="bg-white rounded-xl shadow border border-gray-100 p-6 flex items-center hover:bg-gray-50"
        >
          <div className="p-3 bg-blue-100 rounded-lg mr-4">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">View Transcripts</h3>
            <p className="text-sm text-gray-500">Manage transcripts and create MCQs</p>
          </div>
        </Link>
      </div>
      
      <div className="text-center text-xs text-gray-500 mt-12">
        <p>Connection status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      </div>
    </div>
  );
};

export default Dashboard;

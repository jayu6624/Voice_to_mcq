import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../utils/socketManager'; // Adjust this path as needed

interface Transcript {
  fileId: string;
  fileName: string;
  fullTranscript: string;
  segments: {
    segmentId: string;
    text: string;
  }[];
  createdAt: string;
}

const TranscriptionView: React.FC = () => {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTranscript, setSelectedTranscript] = useState<string | null>(null);
  const [transcriptContent, setTranscriptContent] = useState<string>('');

  useEffect(() => {
    const fetchTranscriptions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await axios.get(`${API_URL}/api/transcription/all-transcriptions`);
        
        if (response.data.success) {
          setTranscripts(response.data.transcripts);
        } else {
          setError('Failed to load transcriptions');
        }
      } catch (err) {
        console.error('Error fetching transcriptions:', err);
        setError('An error occurred while fetching transcriptions');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTranscriptions();
  }, []);

  const handleTranscriptSelect = async (fileId: string) => {
    if (selectedTranscript === fileId) {
      setSelectedTranscript(null);
      setTranscriptContent('');
      return;
    }
    
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/transcription/transcription/${fileId}`);
      
      if (response.data.success) {
        setSelectedTranscript(fileId);
        setTranscriptContent(response.data.transcript.fullTranscript || 
          response.data.transcript.segments.map((seg: any) => seg.text).join('\n\n'));
      } else {
        setError('Failed to load transcript content');
      }
    } catch (err) {
      console.error('Error loading transcript content:', err);
      setError('An error occurred while loading transcript content');
    } finally {
      setLoading(false);
    }
  };

  if (loading && transcripts.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error && transcripts.length === 0) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Transcriptions</h1>
      
      {transcripts.length === 0 ? (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p>No transcriptions found. Please upload a video first.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transcripts.map(transcript => (
            <div key={transcript.fileId} className="border rounded-lg overflow-hidden">
              <div 
                className="p-4 bg-gray-100 cursor-pointer flex justify-between items-center"
                onClick={() => handleTranscriptSelect(transcript.fileId)}
              >
                <div>
                  <h3 className="font-medium">{transcript.fileName || 'Unnamed transcript'}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(transcript.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <button 
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    {selectedTranscript === transcript.fileId ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              
              {selectedTranscript === transcript.fileId && (
                <div className="p-4">
                  {loading ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded whitespace-pre-wrap font-mono text-sm">
                      {transcriptContent || 'No transcript content available'}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TranscriptionView;

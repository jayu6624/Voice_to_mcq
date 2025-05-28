import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, ChevronDown, ChevronRight, ArrowRight, RefreshCw, Trash2 } from 'lucide-react';
import { API_URL } from '../utils/socketManager';

interface Segment {
  segmentId: string;
  text: string;
  filePath?: string;
}

interface Transcript {
  fileId: string;
  fileName: string;
  originalFileName: string;
  fullTranscript?: string;
  segments?: Segment[];
  createdAt: string;
}

const TranscriptionView: React.FC = () => {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTranscript, setExpandedTranscript] = useState<string | null>(null);
  const [activeTranscript, setActiveTranscript] = useState<Transcript | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchTranscripts();
  }, []);

  const fetchTranscripts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try multiple endpoints - first try 'all-transcriptions', fallback to 'transcripts'
      let response;
      try {
        console.log("Fetching from all-transcriptions endpoint");
        response = await axios.get(`${API_URL}/api/transcription/all-transcriptions`);
      } catch (err) {
        console.log('Falling back to /transcripts endpoint');
        response = await axios.get(`${API_URL}/api/transcription/transcripts`);
      }
      
      if (response.data.success) {
        console.log("Transcripts fetched successfully:", response.data.transcripts);
        setTranscripts(response.data.transcripts);
      } else {
        console.error("API returned success: false");
        setError('Failed to load transcriptions');
      }
    } catch (err) {
      console.error('Error fetching transcriptions:', err);
      setError('An error occurred while fetching transcriptions. Check the server connection and logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTranscripts();
    setRefreshing(false);
  };

  const toggleTranscript = async (fileId: string) => {
    if (expandedTranscript === fileId) {
      setExpandedTranscript(null);
      setActiveTranscript(null);
      return;
    }
    
    setExpandedTranscript(fileId);
    
    const transcript = transcripts.find(t => t.fileId === fileId);
    if (transcript) {
      // If we already have the full transcript or segments, just use them
      if (transcript.fullTranscript || (transcript.segments && transcript.segments.length > 0)) {
        setActiveTranscript(transcript);
      } else {
        // Otherwise fetch the transcript details
        try {
          setLoading(true);
          const response = await axios.get(`${API_URL}/api/transcription/transcription/${fileId}`);
          
          if (response.data.success) {
            const updatedTranscript = {
              ...transcript,
              fullTranscript: response.data.transcript.fullTranscript,
              segments: response.data.transcript.segments
            };
            
            setTranscripts(prev => 
              prev.map(t => t.fileId === fileId ? updatedTranscript : t)
            );
            setActiveTranscript(updatedTranscript);
          }
        } catch (err) {
          console.error('Error loading transcript content:', err);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleDeleteTranscript = async (fileId: string) => {
    if (!confirm(`Are you sure you want to delete this transcript? This action cannot be undone.`)) {
      return;
    }
    
    try {
      setDeleteLoading(fileId);
      const response = await axios.delete(`${API_URL}/api/transcription/transcript/${fileId}`);
      
      if (response.data.success) {
        setTranscripts(prev => prev.filter(t => t.fileId !== fileId));
        
        // If this was the active transcript, clear it
        if (expandedTranscript === fileId) {
          setExpandedTranscript(null);
          setActiveTranscript(null);
        }
      }
    } catch (err) {
      console.error('Error deleting transcript:', err);
      alert('Failed to delete transcript. Please try again.');
    } finally {
      setDeleteLoading(null);
    }
  };

  if (loading && transcripts.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Transcriptions</h1>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className={`flex items-center space-x-2 px-4 py-2 text-sm rounded-lg 
            ${refreshing ? 'bg-gray-200 text-gray-500' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error</p>
          <p>{error}</p>
          <p className="text-sm mt-2">Check that the server is running and the API routes are properly configured.</p>
        </div>
      )}

      {transcripts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No transcriptions found</h3>
          <p className="mt-2 text-sm text-gray-500">
            Upload a video to generate transcriptions.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {transcripts.map(transcript => (
            <div 
              key={transcript.fileId} 
              className="bg-white rounded-lg shadow overflow-hidden border border-gray-100"
            >
              <div className="flex justify-between items-center p-4 hover:bg-gray-50 transition-colors">
                <div 
                  className="flex items-center space-x-3 flex-grow cursor-pointer"
                  onClick={() => toggleTranscript(transcript.fileId)}
                >
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {transcript.originalFileName || transcript.fileName || 'Unnamed transcript'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {new Date(transcript.createdAt).toLocaleDateString()} at {new Date(transcript.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <button
                    onClick={() => handleDeleteTranscript(transcript.fileId)}
                    disabled={deleteLoading === transcript.fileId}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg"
                    title="Delete transcript"
                  >
                    {deleteLoading === transcript.fileId ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                  <div className="text-gray-400 ml-2">
                    {expandedTranscript === transcript.fileId ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>
                </div>
              </div>

              {expandedTranscript === transcript.fileId && (
                <div className="border-t border-gray-100 p-4">
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
                    </div>
                  ) : (
                    <>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Transcript Content</h4>
                      <div className="bg-gray-50 p-4 rounded-lg max-h-[500px] overflow-y-auto mb-4">
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                          {activeTranscript?.fullTranscript || 
                           (activeTranscript?.segments && activeTranscript.segments.map(s => 
                             `[${s.segmentId}]\n${s.text}\n\n`).join('')
                           ) || 
                           'No transcript content available'}
                        </pre>
                      </div>
                      {activeTranscript?.segments && activeTranscript.segments.length > 0 && (
                        <div className="mt-4 border-t border-gray-100 pt-4">
                          <h4 className="text-sm font-medium text-gray-500 mb-2">Segments</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {activeTranscript.segments.map((segment) => (
                              <button
                                key={segment.segmentId}
                                onClick={() => window.open(`/dashboard/quiz?fileId=${transcript.fileId}&segmentId=${segment.segmentId}`, '_blank')}
                                className="text-left p-2 border border-gray-200 rounded hover:bg-purple-50 hover:border-purple-200"
                              >
                                <p className="font-medium text-sm">Segment {segment.segmentId}</p>
                                <p className="text-xs text-gray-500 truncate">{segment.text?.substring(0, 50)}...</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between mt-4">
                        <p className="text-xs text-gray-500">
                          ID: {transcript.fileId}
                        </p>
                        <button 
                          onClick={() => window.open(`/dashboard/quiz?fileId=${transcript.fileId}`, '_blank')}
                          className="flex items-center space-x-1 text-sm text-purple-600 hover:text-purple-800"
                        >
                          <span>Take Quiz</span>
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </>
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

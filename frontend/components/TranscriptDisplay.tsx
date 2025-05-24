import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Chunk {
  start: number;
  end: number;
  text: string;
}

interface TranscriptMetadata {
  video_file: string;
  model_size: string;
  chunks: string[];
  chunk_files: string[];
  full_transcript: string;
}

interface TranscriptDisplayProps {
  fileName: string;
}

const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({ fileName }) => {
  const [metadata, setMetadata] = useState<TranscriptMetadata | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<string | null>(null);
  const [chunkContent, setChunkContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileName) return;
    
    const fetchTranscriptMetadata = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const baseFileName = fileName.split('.')[0];
        const response = await axios.get(`http://localhost:3001/api/transcripts/${baseFileName}`);
        
        if (response.data.success) {
          setMetadata(response.data.metadata);
        } else {
          setError('Failed to fetch transcript metadata');
        }
      } catch (err) {
        console.error('Error fetching transcript metadata:', err);
        setError('Error fetching transcript data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTranscriptMetadata();
  }, [fileName]);
  
  const fetchChunkContent = async (chunkFile: string) => {
    try {
      setLoading(true);
      const response = await axios.get(`http://localhost:3001${chunkFile.replace(/^./, '')}`);
      setChunkContent(response.data);
    } catch (err) {
      console.error('Error fetching chunk content:', err);
      setError('Error fetching chunk content');
    } finally {
      setLoading(false);
    }
  };
  
  const handleChunkSelect = (chunk: string, index: number) => {
    setSelectedChunk(chunk);
    if (metadata && metadata.chunk_files[index]) {
      fetchChunkContent(metadata.chunk_files[index]);
    }
  };

  if (!fileName) {
    return <div className="transcript-placeholder">No transcription in progress</div>;
  }

  return (
    <div className="transcript-display">
      <h2>Transcript: {fileName}</h2>
      
      {loading && <div className="loading">Loading transcript data...</div>}
      
      {error && <div className="error-message">{error}</div>}
      
      {metadata && (
        <div className="transcript-content">
          <div className="chunk-selector">
            <h3>5-Minute Segments</h3>
            <div className="chunk-list">
              {metadata.chunks.map((chunk, index) => (
                <button 
                  key={chunk} 
                  className={selectedChunk === chunk ? 'selected' : ''}
                  onClick={() => handleChunkSelect(chunk, index)}
                >
                  {chunk.replace('_', '-')} min
                </button>
              ))}
            </div>
          </div>
          
          <div className="chunk-content">
            {selectedChunk ? (
              <div>
                <h3>Transcript ({selectedChunk.replace('_', '-')} minutes)</h3>
                <pre>{chunkContent || 'Select a chunk to view content'}</pre>
              </div>
            ) : (
              <div className="select-prompt">Select a segment to view transcript</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptDisplay;

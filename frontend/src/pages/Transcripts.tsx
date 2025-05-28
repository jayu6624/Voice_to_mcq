import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Code, Check, X, Download, Edit, Save, Loader, PlayCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { API_URL } from '../utils/socketManager';
import { useSocket } from '../contexts/SocketContext';

const Transcripts: React.FC = () => {
  const { uploadedFiles, addLog } = useSocket();
  const location = useLocation();
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [selectedTranscript, setSelectedTranscript] = useState<any>(null);
  const [segments, setSegments] = useState<string[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [segmentContent, setSegmentContent] = useState<string>('');
  const [mcqs, setMcqs] = useState<any[]>([]);
  const [loadingMcqs, setLoadingMcqs] = useState(false);
  const [editingMcq, setEditingMcq] = useState<number | null>(null);
  const [editedMcq, setEditedMcq] = useState<any>(null);

  // Load all transcripts when component mounts
  useEffect(() => {
    fetchTranscripts();
  }, []);

  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fileId = params.get('fileId');
    const segment = params.get('segment');
    
    if (fileId) {
      // Find the transcript in already loaded transcripts
      const transcript = transcripts.find(t => t.fileId === fileId);
      if (transcript) {
        handleSelectTranscript(transcript);
        
        // Select segment if provided
        if (segment) {
          setTimeout(() => {
            handleSelectSegment(segment);
          }, 500);
        }
      }
    }
  }, [location, transcripts]);
  
  // Fetch all transcripts from server
  const fetchTranscripts = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/transcription/transcripts`);
      if (response.data.success) {
        setTranscripts(response.data.transcripts);
      }
    } catch (error) {
      console.error('Error fetching transcripts:', error);
      addLog('Failed to fetch transcripts', true);
    }
  };

  // Select a transcript to view
  const handleSelectTranscript = async (transcript: any) => {
    setSelectedTranscript(transcript);
    setSelectedSegment(null);
    setSegmentContent('');
    setMcqs([]);
    
    // Fetch segments for this transcript
    try {
      const response = await axios.get(`${API_URL}/api/transcription/metadata/${transcript.fileId}`);
      if (response.data.success && response.data.metadata) {
        setSegments(response.data.metadata.chunks || []);
      }
    } catch (error) {
      console.error('Error fetching transcript metadata:', error);
      addLog('Failed to fetch transcript segments', true);
    }
  };

  // Fetch segment content and MCQs
  const handleSelectSegment = async (segment: string) => {
    setSelectedSegment(segment);
    setLoadingMcqs(true);
    
    try {
      // Fetch segment content
      const contentResponse = await axios.get(
        `${API_URL}/api/transcription/segment/${selectedTranscript.fileId}/${segment}`
      );
      
      if (contentResponse.data.success) {
        setSegmentContent(contentResponse.data.content);
      }
      
      // Fetch generated MCQs for this segment
      const mcqResponse = await axios.get(
        `${API_URL}/api/transcription/mcqs/${selectedTranscript.fileId}/${segment}`
      );
      
      if (mcqResponse.data.success) {
        setMcqs(mcqResponse.data.mcqs);
      } else {
        // No MCQs found, reset the array
        setMcqs([]);
      }
    } catch (error) {
      console.error('Error fetching segment data:', error);
      addLog(`Failed to fetch segment ${segment} data`, true);
    } finally {
      setLoadingMcqs(false);
    }
  };

  // Generate MCQs for current segment with improved error handling
  const generateMCQs = async () => {
    if (!selectedTranscript || !selectedSegment) return;
    
    setLoadingMcqs(true);
    try {
      addLog(`Generating MCQs for segment ${selectedSegment}...`);
      
      const response = await axios.post(`${API_URL}/api/transcription/generate-mcqs`, {
        fileId: selectedTranscript.fileId,
        segment: selectedSegment
      });
      
      if (response.data.success) {
        setMcqs(response.data.mcqs);
        addLog(`Generated ${response.data.mcqs.length} MCQs for segment ${selectedSegment}`);
      } else {
        addLog(`Failed to generate MCQs: ${response.data.error || 'Unknown error'}`, true);
      }
    } catch (error) {
      console.error('Error generating MCQs:', error);
      addLog('Failed to generate MCQs. Server error.', true);
    } finally {
      setLoadingMcqs(false);
    }
  };

  // Handle MCQ edit start
  const startEditingMcq = (index: number) => {
    setEditingMcq(index);
    setEditedMcq({...mcqs[index]});
  };

  // Handle MCQ edit save
  const saveMcqEdit = async () => {
    if (editingMcq === null || !editedMcq) return;
    
    try {
      const response = await axios.put(
        `${API_URL}/api/transcription/mcqs/${selectedTranscript.fileId}/${selectedSegment}/${editedMcq._id}`,
        editedMcq
      );
      
      if (response.data.success) {
        // Update local state
        const updatedMcqs = [...mcqs];
        updatedMcqs[editingMcq] = editedMcq;
        setMcqs(updatedMcqs);
        addLog('MCQ updated successfully');
      }
    } catch (error) {
      console.error('Error updating MCQ:', error);
      addLog('Failed to update MCQ', true);
    } finally {
      setEditingMcq(null);
      setEditedMcq(null);
    }
  };

  // Handle MCQ option change
  const handleOptionChange = (optionIndex: number, value: string) => {
    if (!editedMcq) return;
    
    const updatedOptions = [...editedMcq.options];
    updatedOptions[optionIndex] = value;
    setEditedMcq({...editedMcq, options: updatedOptions});
  };

  // Export MCQs as JSON
  const exportMcqs = () => {
    if (!mcqs.length) return;
    
    const dataStr = JSON.stringify(mcqs, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `${selectedTranscript.fileName}_${selectedSegment}_mcqs.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Get completion status for a transcript
  const getTranscriptStatus = (transcript: any) => {
    const file = uploadedFiles.find(f => f.fileName && f.fileName.includes(transcript.fileId));
    return file?.status || 'unknown';
  };

  // Render Quiz button
  const renderQuizButton = () => {
    if (!selectedTranscript || !selectedSegment) return null;
    
    return (
      <Link
        to={`/quiz?fileId=${selectedTranscript.fileId}&segment=${selectedSegment}`}
        className="flex items-center text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 ml-2"
      >
        <PlayCircle className="w-3 h-3 mr-1" />
        Quiz Mode
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transcripts & MCQs</h1>
        <p className="mt-1 text-sm text-gray-500">
          View transcripts and generate multiple-choice questions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transcripts List */}
        <div className="bg-white rounded-xl shadow border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900">Available Transcripts</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-[calc(100vh-250px)] overflow-y-auto">
            {transcripts.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No transcripts available
              </div>
            ) : (
              transcripts.map((transcript) => (
                <div 
                  key={transcript.fileId}
                  className={`flex items-center px-6 py-4 hover:bg-gray-50 cursor-pointer ${
                    selectedTranscript?.fileId === transcript.fileId ? 'bg-purple-50' : ''
                  }`}
                  onClick={() => handleSelectTranscript(transcript)}
                >
                  <div className="p-2 bg-purple-50 rounded-lg mr-4">
                    <FileText className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {transcript.fileName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(transcript.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                ))
            )}
          </div>
        </div>

        {/* Segments & Content */}
        <div className="bg-white rounded-xl shadow border border-gray-100">
          {selectedTranscript ? (
            <>
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-medium text-gray-900">Segments</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Select a segment to view content and generate MCQs
                </p>
              </div>
              <div className="grid grid-cols-1 divide-y divide-gray-100">
                {/* Segment Selector */}
                <div className="p-4 max-h-60 overflow-y-auto">
                  {segments.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {segments.map((segment) => (
                        <button
                          key={segment}
                          onClick={() => handleSelectSegment(segment)}
                          className={`px-3 py-2 text-sm rounded-lg ${
                            selectedSegment === segment
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          {segment.replace('_', '-')} min
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500">No segments available</p>
                  )}
                </div>
                
                {/* Segment Content */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900">
                      {selectedSegment ? `Transcript (${selectedSegment.replace('_', '-')} minutes)` : 'Select a segment'}
                    </h3>
                    <div className="flex">
                      {selectedSegment && (
                        <>
                          <button
                            onClick={generateMCQs}
                            disabled={loadingMcqs}
                            className="flex items-center text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                          >
                            {loadingMcqs ? (
                              <Loader className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Code className="w-3 h-3 mr-1" />
                            )}
                            Generate MCQs
                          </button>
                          {renderQuizButton()}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-[300px] overflow-y-auto">
                    {segmentContent ? (
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{segmentContent}</pre>
                    ) : (
                      <p className="text-center text-gray-500 py-8">
                        {selectedSegment ? 'Loading...' : 'Select a segment to view content'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Select a transcript to view segments
            </div>
          )}
        </div>

        {/* MCQs */}
        <div className="bg-white rounded-xl shadow border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-medium text-gray-900">Generated Questions</h2>
            {mcqs.length > 0 && (
              <button
                onClick={exportMcqs}
                className="flex items-center text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                <Download className="w-3 h-3 mr-1" />
                Export
              </button>
            )}
          </div>
          <div className="p-4 max-h-[calc(100vh-250px)] overflow-y-auto">
            {loadingMcqs ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-8 h-8 text-purple-500 animate-spin" />
                <span className="ml-2 text-gray-500">Generating questions...</span>
              </div>
            ) : mcqs.length > 0 ? (
              <div className="space-y-6">
                {mcqs.map((mcq, index) => (
                  <div key={mcq._id || index} className="bg-gray-50 rounded-lg p-4">
                    {editingMcq === index ? (
                      // Edit mode
                      <>
                        <div className="mb-2">
                          <label className="block text-xs text-gray-500 mb-1">Question</label>
                          <textarea
                            value={editedMcq?.question}
                            onChange={(e) => setEditedMcq({...editedMcq, question: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            rows={2}
                          />
                        </div>
                        <div className="mb-2">
                          <label className="block text-xs text-gray-500 mb-1">Options</label>
                          {editedMcq?.options.map((option: string, optionIndex: number) => (
                            <div key={optionIndex} className="flex items-center mb-1">
                              <input
                                type="radio"
                                checked={editedMcq.correct === optionIndex}
                                onChange={() => setEditedMcq({...editedMcq, correct: optionIndex})}
                                className="mr-2"
                              />
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => handleOptionChange(optionIndex, e.target.value)}
                                className="flex-1 p-1 border border-gray-300 rounded text-sm"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setEditingMcq(null)}
                            className="flex items-center text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Cancel
                          </button>
                          <button
                            onClick={saveMcqEdit}
                            className="flex items-center text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            <Save className="w-3 h-3 mr-1" />
                            Save
                          </button>
                        </div>
                      </>
                    ) : (
                      // View mode
                      <>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-sm font-medium text-gray-900">
                            Q{index + 1}: {mcq.question}
                          </h4>
                          <button
                            onClick={() => startEditingMcq(index)}
                            className="text-gray-400 hover:text-purple-600"
                            title="Edit question"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-1">
                          {mcq.options.map((option: string, optionIndex: number) => (
                            <div 
                              key={optionIndex}
                              className={`flex items-start p-2 rounded-md ${
                                mcq.correct === optionIndex ? 'bg-green-100' : 'bg-white'
                              }`}
                            >
                              <div className="flex-none mr-2">
                                {mcq.correct === optionIndex ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full border border-gray-300 bg-white" />
                                )}
                              </div>
                              <div className="text-sm">{option}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                {selectedSegment ? 'No questions generated yet' : 'Select a segment to generate questions'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Transcripts;

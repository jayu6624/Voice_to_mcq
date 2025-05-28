import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FileText, CheckCircle, XCircle, ChevronRight, Timer, Award, RefreshCw, AlertTriangle } from 'lucide-react';
import { API_URL } from '../utils/socketManager';
import { useSocket } from '../contexts/SocketContext';
import { useLocation } from 'react-router-dom';

interface McqQuestion {
  _id: string;
  question: string;
  options: string[];
  correct: number;
  fileId: string;
  segmentId: string;
}

interface TranscriptOption {
  fileId: string;
  fileName: string;
  segments: string[];
}

interface QuizState {
  questions: McqQuestion[];
  currentIndex: number;
  answers: number[];
  showResults: boolean;
  timeStarted: Date | null;
  timeCompleted: Date | null;
}

const Quiz: React.FC = () => {
  const { addLog } = useSocket();
  const location = useLocation();
  const [transcripts, setTranscripts] = useState<TranscriptOption[]>([]);
  const [selectedTranscript, setSelectedTranscript] = useState<string>('');
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [quizState, setQuizState] = useState<QuizState>({
    questions: [],
    currentIndex: 0,
    answers: [],
    showResults: false,
    timeStarted: null,
    timeCompleted: null,
  });
  
  // Fix infinite loop by adding proper dependency management
  const [autoStarted, setAutoStarted] = useState(false);
  
  // Add a flag to prevent infinite loops
  const [autoStartAttempted, setAutoStartAttempted] = useState(false);

  // Fetch available transcripts on component mount
  useEffect(() => {
    fetchTranscripts();
  }, []);
  
  // Parse query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fileId = params.get('fileId');
    const segment = params.get('segment');
    
    if (fileId) {
      setSelectedTranscript(fileId);
      if (segment) {
        setSelectedSegments([segment]);
      }
    }
  }, [location]);
  
  // Modified effect that only runs once when transcript and segments are selected from URL
  useEffect(() => {
    // Only auto-start quiz once when params are loaded
    if (selectedTranscript && 
        selectedSegments.length > 0 && 
        !loading && 
        quizState.questions.length === 0 && 
        !autoStartAttempted) {
      
      // Set flag to prevent retries if it fails
      setAutoStartAttempted(true);
      startQuiz();
    }
  }, [selectedTranscript, selectedSegments, loading, quizState.questions.length, autoStartAttempted]);
  
  // Fetch all available transcripts
  const fetchTranscripts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/transcription/transcripts`);
      if (response.data.success) {
        setTranscripts(response.data.transcripts.map((t: any) => ({
          fileId: t.fileId,
          fileName: t.fileName,
          segments: []
        })));
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching transcripts:', error);
      addLog('Failed to fetch transcripts for quiz', true);
      setLoading(false);
    }
  };
  
  // Fetch segments when a transcript is selected
  const handleTranscriptChange = async (fileId: string) => {
    setSelectedTranscript(fileId);
    setSelectedSegments([]);
    
    if (!fileId) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/transcription/metadata/${fileId}`);
      if (response.data.success && response.data.metadata) {
        const transcript = transcripts.find(t => t.fileId === fileId);
        if (transcript) {
          transcript.segments = response.data.metadata.chunks || [];
          setTranscripts([...transcripts]);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching segments:', error);
      addLog(`Failed to fetch segments for transcript ${fileId}`, true);
      setLoading(false);
    }
  };
  
  // Handle segment selection/deselection
  const toggleSegment = (segmentId: string) => {
    if (selectedSegments.includes(segmentId)) {
      setSelectedSegments(selectedSegments.filter(id => id !== segmentId));
    } else {
      setSelectedSegments([...selectedSegments, segmentId]);
    }
  };
  
  // Memoized startQuiz function to prevent recreation on each render
  const startQuiz = useCallback(async () => {
    if (!selectedTranscript || selectedSegments.length === 0) {
      addLog('Please select a transcript and at least one segment', true);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Collect MCQs for all selected segments
      const allQuestions: McqQuestion[] = [];
      let errorCount = 0;
      
      // Try with each segment but don't retry failed segments
      for (const segmentId of selectedSegments) {
        try {
          // First try to get existing MCQs
          const mcqResponse = await axios.get(
            `${API_URL}/api/transcription/mcqs/${selectedTranscript}/${segmentId}`
          );
          
          if (mcqResponse.data.success && mcqResponse.data.mcqs.length > 0) {
            console.log(`Found ${mcqResponse.data.mcqs.length} existing MCQs for segment ${segmentId}`);
            allQuestions.push(...mcqResponse.data.mcqs);
          } else {
            // Get segment content first to check if it exists
            const contentResponse = await axios.get(
              `${API_URL}/api/transcription/segment/${selectedTranscript}/${segmentId}`
            );
            
            if (contentResponse.data.success && contentResponse.data.content) {
              try {
                // No retry if this fails - prevents infinite loop
                const genResponse = await axios.post(`${API_URL}/api/transcription/generate-mcqs`, {
                  fileId: selectedTranscript,
                  segment: segmentId
                });
                
                if (genResponse.data.success) {
                  allQuestions.push(...genResponse.data.mcqs);
                }
              } catch (err) {
                console.error(`Error generating MCQs for segment ${segmentId}:`, err);
                errorCount++;
              }
            }
          }
        } catch (err) {
          console.error(`Error processing segment ${segmentId}:`, err);
          errorCount++;
          // Continue with other segments
        }
      }
      
      if (allQuestions.length === 0) {
        setError(`Could not load or generate any questions (${errorCount} errors occurred). Please try another segment.`);
        setLoading(false);
        return;
      }
      
      // Shuffle and limit questions
      const shuffledQuestions = allQuestions
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(allQuestions.length, 10));
      
      // Initialize answers array with -1 (unanswered)
      const initialAnswers = Array(shuffledQuestions.length).fill(-1);
      
      setQuizState({
        questions: shuffledQuestions,
        currentIndex: 0,
        answers: initialAnswers,
        showResults: false,
        timeStarted: new Date(),
        timeCompleted: null,
      });
      
      addLog(`Started quiz with ${shuffledQuestions.length} questions`);
    } catch (error: any) {
      console.error('Error starting quiz:', error);
      addLog(`Failed to prepare quiz questions: ${error.message}`, true);
      setError('Error loading questions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedTranscript, selectedSegments, addLog]);
  
  // Handle answer selection
  const selectAnswer = (optionIndex: number) => {
    const newAnswers = [...quizState.answers];
    newAnswers[quizState.currentIndex] = optionIndex;
    
    setQuizState({
      ...quizState,
      answers: newAnswers
    });
  };
  
  // Move to the next question
  const goToNextQuestion = () => {
    if (quizState.currentIndex < quizState.questions.length - 1) {
      setQuizState({
        ...quizState,
        currentIndex: quizState.currentIndex + 1
      });
    }
  };
  
  // Move to the previous question
  const goToPreviousQuestion = () => {
    if (quizState.currentIndex > 0) {
      setQuizState({
        ...quizState,
        currentIndex: quizState.currentIndex - 1
      });
    }
  };
  
  // Complete the quiz and show results
  const finishQuiz = () => {
    setQuizState({
      ...quizState,
      showResults: true,
      timeCompleted: new Date()
    });
  };
  
  // Reset quiz
  const resetQuiz = () => {
    setQuizState({
      questions: [],
      currentIndex: 0,
      answers: [],
      showResults: false,
      timeStarted: null,
      timeCompleted: null
    });
  };
  
  // Calculate quiz score
  const calculateScore = () => {
    let correctAnswers = 0;
    quizState.questions.forEach((q, i) => {
      if (quizState.answers[i] === q.correct) {
        correctAnswers++;
      }
    });
    
    return {
      correct: correctAnswers,
      total: quizState.questions.length,
      percentage: Math.round((correctAnswers / quizState.questions.length) * 100)
    };
  };
  
  // Calculate quiz duration
  const calculateDuration = () => {
    if (!quizState.timeStarted || !quizState.timeCompleted) return '0';
    
    const durationMs = quizState.timeCompleted.getTime() - quizState.timeStarted.getTime();
    const durationSec = Math.floor(durationMs / 1000);
    
    if (durationSec < 60) {
      return `${durationSec} seconds`;
    }
    
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    return `${minutes}m ${seconds}s`;
  };
  
  // Render the quiz selection form
  const renderQuizSelection = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900">Select Quiz Content</h2>
          </div>
          <div className="p-6 space-y-4">
            {/* Error message */}
            {error && (
              <div className="mx-6 my-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
                <p>{error}</p>
              </div>
            )}
            
            {/* Transcript selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transcript
              </label>
              <select
                value={selectedTranscript}
                onChange={(e) => handleTranscriptChange(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                disabled={loading}
              >
                <option value="">Select a transcript</option>
                {transcripts.map((transcript) => (
                  <option key={transcript.fileId} value={transcript.fileId}>
                    {transcript.fileName}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Segment selection */}
            {selectedTranscript && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Segments (select at least one)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {transcripts
                    .find(t => t.fileId === selectedTranscript)?.segments
                    .map((segment) => (
                      <label
                        key={segment}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer ${
                          selectedSegments.includes(segment)
                            ? 'bg-purple-50 border-purple-500'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                          checked={selectedSegments.includes(segment)}
                          onChange={() => toggleSegment(segment)}
                        />
                        <span className="ml-2 text-sm">
                          {segment.replace('_', '-')} minutes
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            )}
            
            {/* Start quiz button */}
            <div className="pt-4">
              <button
                onClick={startQuiz}
                disabled={!selectedTranscript || selectedSegments.length === 0 || loading}
                className={`w-full py-2.5 px-5 rounded-lg text-black font-medium ${
                  !selectedTranscript || selectedSegments.length === 0 || loading
                    ? 'bg-gray-300 text-black cursor-allowed'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {loading ? 'Preparing Quiz...' : 'Start Quiz'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render a question
  const renderQuestion = () => {
    const currentQuestion = quizState.questions[quizState.currentIndex];
    const userAnswer = quizState.answers[quizState.currentIndex];
    
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-medium text-gray-900">
              Question {quizState.currentIndex + 1} of {quizState.questions.length}
            </h2>
            <span className="text-xs text-gray-500">
              {quizState.answers.filter(a => a !== -1).length} of {quizState.questions.length} answered
            </span>
          </div>
          <div className="p-6">
            <div className="mb-6">
              <p className="text-gray-900 font-medium mb-4">{currentQuestion.question}</p>
              <div className="space-y-2">
                {currentQuestion.options.map((option, optionIndex) => (
                  <button
                    key={optionIndex}
                    onClick={() => selectAnswer(optionIndex)}
                    className={`w-full text-left p-3 rounded-lg ${
                      userAnswer === optionIndex
                        ? 'bg-purple-100 border-purple-500 border text-black'
                        : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-black'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center mr-3 ${
                        userAnswer === optionIndex
                          ? 'bg-purple-600 text-white'
                          : 'bg-white border border-gray-300'
                      }`}>
                        {userAnswer === optionIndex && <span>✓</span>}
                      </div>
                      <span>{option}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <button
                onClick={goToPreviousQuestion}
                disabled={quizState.currentIndex === 0}
                className={`px-4 py-2 rounded ${
                  quizState.currentIndex === 0
                    ? 'bg-gray-100 text-gray-400'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Previous
              </button>
              {quizState.currentIndex < quizState.questions.length - 1 ? (
                <button
                  onClick={goToNextQuestion}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={finishQuiz}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Finish Quiz
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render quiz results
  const renderResults = () => {
    const score = calculateScore();
    const duration = calculateDuration();
    
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900">Quiz Results</h2>
          </div>
          <div className="p-6">
            <div className="mb-8 text-center">
              <div className={`inline-block rounded-full p-6 mb-4 ${
                score.percentage >= 70
                  ? 'bg-green-100'
                  : score.percentage >= 40
                    ? 'bg-yellow-100'
                    : 'bg-red-100'
              }`}>
                <Award className={`h-12 w-12 ${
                  score.percentage >= 70
                    ? 'text-green-600'
                    : score.percentage >= 40
                      ? 'text-yellow-600'
                      : 'text-red-600'
                }`} />
              </div>
              <h3 className="text-2xl font-bold">{score.percentage}%</h3>
              <p className="text-gray-500">You got {score.correct} out of {score.total} questions correct</p>
              <div className="flex justify-center items-center mt-2 text-sm text-gray-500">
                <Timer className="h-4 w-4 mr-1" />
                <span>Completed in {duration}</span>
              </div>
            </div>
            
            <div className="space-y-4">
              {quizState.questions.map((question, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start mb-3">
                    <div className={`p-1 rounded-full mr-2 ${
                      quizState.answers[index] === question.correct
                        ? 'bg-green-100'
                        : 'bg-red-100'
                    }`}>
                      {quizState.answers[index] === question.correct ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <h4 className="text-sm font-medium flex-1">
                      {question.question}
                    </h4>
                  </div>
                  <div className="pl-8 space-y-1">
                    {question.options.map((option, optionIndex) => (
                      <div
                        key={optionIndex}
                        className={`text-sm p-2 rounded ${
                          optionIndex === question.correct
                            ? 'bg-green-50 text-green-800'
                            : optionIndex === quizState.answers[index]
                              ? 'bg-red-50 text-red-800'
                              : 'text-gray-500'
                        }`}
                      >
                        {option}
                        {optionIndex === question.correct && ' ✓'}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6">
              <button
                onClick={resetQuiz}
                className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Create New Quiz
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Determine which view to render
  const renderContent = () => {
    if (quizState.questions.length === 0) {
      return renderQuizSelection();
    }
    
    if (quizState.showResults) {
      return renderResults();
    }
    
    return renderQuestion();
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quiz Mode</h1>
        <p className="mt-1 text-sm text-gray-500">
          Test your knowledge from the transcripts with multiple-choice questions
        </p>
      </div>
      
      {renderContent()}
    </div>
  );
};

export default Quiz;

import React, { useState, useEffect } from 'react';
import { Star, Clock, FileText, MessageCircle, User, BarChart, Loader } from 'lucide-react';
import { getProfile } from '../lib/api';
import axios from 'axios';
import { API_URL } from '../utils/socketManager';

interface SegmentReview {
  segmentId: string;
  timeRange: string;
  score: number;
  totalQuestions: number;
  questionResults: {
    question: string;
    correct: boolean;
    userAnswer: string;
    correctAnswer: string;
  }[];
}

interface ReviewData {
  id: string | number;
  title: string;
  date: string;
  duration: string;
  userId: string;
  userName: string;
  userEmail: string;
  segments: SegmentReview[];
  overallScore: number;
}

// Keep demo data as fallback
const demoReviews: ReviewData[] = [
  {
    id: 1,
    title: 'Introduction to AI Concepts',
    date: '2 hours ago',
    duration: '45:20',
    userId: '1',
    userName: 'Loading...',
    userEmail: 'loading@example.com',
    segments: [
      {
        segmentId: '00_05',
        timeRange: '0:00 - 5:00',
        score: 80,
        totalQuestions: 5,
        questionResults: [
          {
            question: 'What is machine learning?',
            correct: true,
            userAnswer: 'A type of AI that learns from data',
            correctAnswer: 'A type of AI that learns from data',
          },
          // ... more questions
        ],
      },
      {
        segmentId: '05_10',
        timeRange: '5:00 - 10:00',
        score: 90,
        totalQuestions: 5,
        questionResults: [],
      },
    ],
    overallScore: 85,
  },
];

const Review: React.FC = () => {
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const data = await getProfile();
        setUserData(data);
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      }
    };

    const fetchAllTranscriptsAndQuizzes = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get all transcripts
        const response = await axios.get(`${API_URL}/api/transcription/transcripts`);
        
        if (response.data.success && response.data.transcripts.length > 0) {
          const reviewsData: ReviewData[] = [];
          
          // Process each transcript
          for (const transcript of response.data.transcripts) {
            try {
              // Get metadata with all segments
              const metaResponse = await axios.get(
                `${API_URL}/api/transcription/metadata/${transcript.fileId}`
              );
              
              if (metaResponse.data.success && metaResponse.data.metadata) {
                const metadata = metaResponse.data.metadata;
                const segments: SegmentReview[] = [];
                
                // Create entries for ALL segments
                for (const chunk of metadata.chunks || []) {
                  try {
                    // Try to get quiz results for this segment if available
                    const quizResponse = await axios.get(
                      `${API_URL}/api/transcription/mcqs/${transcript.fileId}/${chunk}`
                    );
                    
                    const mcqs = quizResponse.data.success ? quizResponse.data.mcqs : [];
                    const questionResults = mcqs.map((q: any) => ({
                      question: q.question,
                      correct: true, // Default to true for now
                      userAnswer: q.options[q.correct],
                      correctAnswer: q.options[q.correct]
                    }));
                    
                    // Add segment with proper time range formatting
                    segments.push({
                      segmentId: chunk,
                      timeRange: `${chunk.split('_')[0]}:00 - ${chunk.split('_')[1]}:00`,
                      score: Math.floor(Math.random() * 20) + 70, // Random score for now
                      totalQuestions: mcqs.length,
                      questionResults: questionResults.slice(0, 3) // Limit to 3 questions for display
                    });
                  } catch (err) {
                    // If failed to get quiz results, still add segment with empty results
                    segments.push({
                      segmentId: chunk,
                      timeRange: `${chunk.split('_')[0]}:00 - ${chunk.split('_')[1]}:00`,
                      score: Math.floor(Math.random() * 20) + 70,
                      totalQuestions: 0,
                      questionResults: []
                    });
                  }
                }
                
                // Calculate overall score from all segments
                const overallScore = segments.length > 0 
                  ? Math.round(segments.reduce((sum, s) => sum + s.score, 0) / segments.length) 
                  : 0;
                
                // Add review data for this transcript
                reviewsData.push({
                  id: transcript.fileId,
                  title: transcript.fileName || 'Untitled Video',
                  date: new Date(transcript.createdAt || Date.now()).toLocaleString(),
                  duration: `${metadata.chunks?.length * 5 || 0} min`,
                  userId: userData?.id || '1',
                  userName: userData?.fullname 
                    ? `${userData.fullname.firstname} ${userData.fullname.lastname}`
                    : 'Anonymous User',
                  userEmail: userData?.email || 'user@example.com',
                  segments,
                  overallScore
                });
              }
            } catch (err) {
              console.error('Error processing transcript:', err);
            }
          }
          
          if (reviewsData.length > 0) {
            setReviews(reviewsData);
          } else {
            setReviews(demoReviews); // Fall back to demo data if no real data
          }
        } else {
          setReviews(demoReviews); // Fall back to demo data if no transcripts
        }
      } catch (err) {
        console.error('Error fetching transcripts and quizzes:', err);
        setError('Failed to load review data. Please try again later.');
        setReviews(demoReviews); // Fall back to demo data
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
    fetchAllTranscriptsAndQuizzes();
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading review data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
        <h3 className="font-medium mb-2">Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Quiz Performance Review</h2>
        <p className="text-sm text-gray-500 mt-1">Review your quiz results by video segments</p>
      </div>

      {reviews.map((review) => (
        <div key={review.id} className="bg-white rounded-xl shadow-sm border border-gray-100">
          {/* Header - same as before */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{review.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{review.date}</p>
              </div>
              <div className={`px-4 py-2 rounded-lg text-lg font-semibold ${getScoreColor(review.overallScore)}`}>
                {review.overallScore}%
              </div>
            </div>

            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                {review.duration}
              </div>
              <div className="flex items-center">
                <User className="w-4 h-4 mr-2" />
                {userData && userData.fullname ? 
                  `${userData.fullname.firstname} ${userData.fullname.lastname}` : 
                  'Loading...'}
              </div>
            </div>
          </div>

          {/* Segments - now handling potentially many segments */}
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {review.segments.map((segment) => (
              <div key={segment.segmentId} className="p-6">
                <button
                  onClick={() =>
                    setExpandedSegment(
                      expandedSegment === segment.segmentId ? null : segment.segmentId
                    )
                  }
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-sm font-medium text-gray-900">
                        Segment {segment.timeRange}
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          getScoreColor(segment.score)
                        }`}
                      >
                        {segment.score}%
                      </div>
                    </div>
                    <BarChart className="w-5 h-5 text-gray-400" />
                  </div>
                </button>

                {expandedSegment === segment.segmentId && (
                  <div className="mt-4 space-y-4">
                    {segment.questionResults.length > 0 ? (
                      segment.questionResults.map((result, index) => (
                        <div key={index} className="pl-4 border-l-2 border-gray-100">
                          <p className="text-sm font-medium text-gray-900">{result.question}</p>
                          <div
                            className={`mt-1 text-sm ${
                              result.correct ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {result.correct ? '✓ Correct' : `✗ Incorrect - Correct answer: ${result.correctAnswer}`}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="pl-4 border-l-2 border-gray-100">
                        <p className="text-sm text-gray-500 italic">No quiz questions available for this segment</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Review;

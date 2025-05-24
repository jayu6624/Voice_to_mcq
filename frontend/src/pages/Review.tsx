import React, { useState, useEffect } from 'react';
import { Star, Clock, FileText, MessageCircle, User, BarChart } from 'lucide-react';
import { getProfile } from '../lib/api';

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
  id: number;
  title: string;
  date: string;
  duration: string;
  userId: string;
  userName: string;
  userEmail: string;
  segments: SegmentReview[];
  overallScore: number;
}

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
  const [reviews] = useState<ReviewData[]>(demoReviews);
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const data = await getProfile();
        setUserData(data);
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      }
    };

    fetchUserProfile();
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Quiz Performance Review</h2>
        <p className="text-sm text-gray-500 mt-1">Review your quiz results by video segments</p>
      </div>

      {reviews.map((review) => (
        <div key={review.id} className="bg-white rounded-xl shadow-sm border border-gray-100">
          {/* Header */}
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
                {userData ? `${userData.fullname.firstname} ${userData.fullname.lastname}` : 'Loading...'}
              </div>
            </div>
          </div>

          {/* Segments */}
          <div className="divide-y divide-gray-100">
            {review.segments.map((segment) => (
              <div key={segment.segmentId} className="p-6">
                <button
                  onClick={() =>
                    setExpandedSegment(
                      expandedSegment === segment.segmentId ? null : segment.segmentId
                    )
                  }
                  className="w-full"
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
                    {segment.questionResults.map((result, index) => (
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
                    ))}
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

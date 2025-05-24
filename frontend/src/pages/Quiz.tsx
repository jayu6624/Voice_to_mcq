import React, { useState } from 'react';
import { 
  BookOpen, 
  PlusCircle, 
  Edit2, 
  Trash2, 
  CheckCircle,
  Clock,
  Users
} from 'lucide-react';

interface Quiz {
  id: number;
  title: string;
  status: 'draft' | 'published';
  questions: number;
  participants: number;
  duration: string;
  lastModified: string;
}

const demoQuizzes: Quiz[] = [
  {
    id: 1,
    title: "Introduction to Audio Processing",
    status: "published",
    questions: 15,
    participants: 24,
    duration: "20 mins",
    lastModified: "2 days ago"
  },
  {
    id: 2,
    title: "Speech Recognition Basics",
    status: "draft",
    questions: 10,
    participants: 0,
    duration: "15 mins",
    lastModified: "1 hour ago"
  },
  // Add more demo quizzes...
];

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  segment: string;
  timestamp: string;
}

const demoQuestions: Question[] = [
  {
    id: 1,
    question: "What is the main purpose of audio transcription?",
    options: [
      "Converting text to speech",
      "Converting speech to text",
      "Audio editing",
      "Sound mixing"
    ],
    correctAnswer: 1,
    segment: "00_05",
    timestamp: "00:02:15"
  },
  {
    id: 2,
    question: "Which model is commonly used for speech recognition?",
    options: [
      "GPT-3",
      "BERT",
      "Whisper",
      "DALL-E"
    ],
    correctAnswer: 2,
    segment: "05_10",
    timestamp: "00:07:30"
  },
  // ... more demo questions
];

const Quiz: React.FC = () => {
  const [quizzes] = useState<Quiz[]>(demoQuizzes);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleAnswer = (questionId: number, answerIndex: number) => {
    if (!isSubmitted) {
      setSelectedAnswers(prev => ({
        ...prev,
        [questionId]: answerIndex
      }));
    }
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    // Calculate score and send to review
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Video Comprehension Quiz</h2>
        <span className="text-sm text-gray-500">Questions: {demoQuestions.length}</span>
      </div>

      {demoQuestions.map((q, qIndex) => (
        <div 
          key={q.id} 
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4"
        >
          <div className="flex justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              {qIndex + 1}. {q.question}
            </h3>
            <span className="text-sm text-gray-500">{q.timestamp}</span>
          </div>

          <div className="space-y-2">
            {q.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(q.id, index)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedAnswers[q.id] === index
                    ? isSubmitted
                      ? index === q.correctAnswer
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-purple-50 border-purple-200 text-purple-700'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          {isSubmitted && selectedAnswers[q.id] !== undefined && (
            <p className={`text-sm ${
              selectedAnswers[q.id] === q.correctAnswer 
                ? 'text-green-600' 
                : 'text-red-600'
            }`}>
              {selectedAnswers[q.id] === q.correctAnswer 
                ? '✓ Correct!' 
                : `✗ Incorrect. The correct answer is: ${q.options[q.correctAnswer]}`}
            </p>
          )}
        </div>
      ))}

      {!isSubmitted && (
        <button
          onClick={handleSubmit}
          className="fixed bottom-8 right-8 bg-purple-600 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-purple-700 transition-colors"
        >
          Submit Quiz
        </button>
      )}
    </div>
  );
};

export default Quiz;

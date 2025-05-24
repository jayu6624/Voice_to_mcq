const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: String,
  options: [String],
  correctAnswer: Number,
  segment: String,
  timestamp: String
});

const quizSchema = new mongoose.Schema({
  title: String,
  videoId: String,
  questions: [questionSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);

const Quiz = require('../models/Quiz');

exports.createQuiz = async (req, res) => {
  try {
    const quiz = new Quiz({
      ...req.body,
      createdBy: req.user._id
    });
    await quiz.save();
    res.status(201).json(quiz);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find().populate('createdBy', 'fullname email');
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

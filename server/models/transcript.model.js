const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({
  segmentId: {
    type: String,
    required: true
  },
  start: Number,
  end: Number,
  text: String,
  filePath: String
});

const transcriptSchema = new mongoose.Schema({
  fileId: {
    type: String,
    required: true,
    unique: true
  },
  fileName: String,
  originalFileName: String,
  fullPath: String,
  fullTranscript: String,
  metadata: Object,
  processed: {
    type: Boolean,
    default: false
  },
  segments: [segmentSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
});

// Make sure this doesn't throw an error if model already exists
let Transcript;
try {
  Transcript = mongoose.model('Transcript');
} catch (e) {
  Transcript = mongoose.model('Transcript', transcriptSchema);
}

module.exports = Transcript;

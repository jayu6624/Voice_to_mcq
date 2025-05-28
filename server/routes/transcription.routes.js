const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const transcriptionController = require("../controllers/transcription.controller");
const mcqController = require("../controllers/mcq.controller");

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
  }
});

const upload = multer({ storage: storage });

// Fix the file upload route to use a consistent field name 'videoFile'
router.post("/upload", upload.single("videoFile"), transcriptionController.handleVideoUpload);

// Make sure these specific routes are defined in this order
router.get("/all-transcriptions", transcriptionController.getAllTranscriptions);
router.get("/transcription/:fileId", transcriptionController.getTranscriptionById);
router.get("/full-transcript/:fileId", transcriptionController.getFullTranscript);
router.delete("/transcript/:fileId", transcriptionController.deleteTranscript); // Add delete endpoint

// These routes are for the original transcript functionality
router.get("/transcripts", mcqController.getAllTranscripts);
router.get("/metadata/:fileId", mcqController.getTranscriptMetadata);
router.get("/segment/:fileId/:segmentId", mcqController.getSegmentContent);
router.get("/mcqs/:fileId/:segmentId", mcqController.getMCQsBySegment);
router.post("/generate-mcqs", mcqController.generateMCQs); // MCQ generation route

// Stats and other routes
router.get('/stats', transcriptionController.getStats);
router.get('/scan', transcriptionController.scanTranscripts);

// Video deletion route
router.delete("/video/:fileName", transcriptionController.deleteVideo);
router.get("/transcript/:fileName", transcriptionController.getTranscriptById);
router.get("/file-status/:fileName", transcriptionController.getFileStatus);

module.exports = router;

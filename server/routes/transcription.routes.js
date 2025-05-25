const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  handleVideoUpload,
  getTranscriptById,
} = require("../controllers/transcription.controller");

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["video/mp4", "audio/mpeg", "audio/wav", "audio/m4a"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only MP4, MP3, WAV, and M4A files are allowed."
        )
      );
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
});

// Socket-based transcription upload endpoint
router.post("/upload", upload.single("video"), handleVideoUpload);

// Get transcript by filename
router.get("/transcripts/:fileName", getTranscriptById);

module.exports = router;

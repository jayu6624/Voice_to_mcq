const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const {
  handleVideoUpload,
} = require("../controllers/transcription.controller");

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
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

router.post("/upload", upload.single("video"), handleVideoUpload);

module.exports = router;

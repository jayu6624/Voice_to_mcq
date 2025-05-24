const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs").promises;

const generateMCQs = async (transcript) => {
  // This is where we'll integrate with local LLM
  // For now, returning mock MCQs
  return {
    questions: [
      {
        question: "Sample question from transcript",
        options: ["A", "B", "C", "D"],
        correct: 0,
      },
    ],
  };
};

exports.handleVideoUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No video file provided" });
    }

    const videoPath = req.file.path;
    const outputDir = path.join(__dirname, "../transcripts");

    // Start transcription process
    const pythonProcess = spawn("python", [
      path.join(__dirname, "../main.py"),
      videoPath,
      outputDir,
      "small",
    ]);

    let transcriptionOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      transcriptionOutput += data.toString();
    });

    pythonProcess.on("close", async (code) => {
      if (code !== 0) {
        return res.status(500).json({ message: "Transcription failed" });
      }

      // Read the segmented transcripts
      const baseName = path.basename(videoPath, path.extname(videoPath));
      const metadataPath = path.join(outputDir, `${baseName}_metadata.json`);
      const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));

      // Generate MCQs for each segment
      const segmentMCQs = [];
      for (const chunkFile of metadata.chunk_files) {
        const transcript = await fs.readFile(chunkFile, "utf8");
        const mcqs = await generateMCQs(transcript);
        segmentMCQs.push({
          segment: path.basename(chunkFile),
          mcqs,
        });
      }

      res.json({
        success: true,
        message: "Video processed successfully",
        metadata,
        mcqs: segmentMCQs,
      });
    });
  } catch (error) {
    console.error("Error processing video:", error);
    res.status(500).json({ message: "Server error" });
  }
};

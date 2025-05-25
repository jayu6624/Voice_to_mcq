const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");

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

    const socketId = req.body.socketId;
    const fileName = req.file.filename;
    const filePath = req.file.path;
    const io = req.app.get('io');

    // Send initial response
    res.json({
      success: true,
      message: 'File uploaded successfully, transcription started',
      fileName
    });

    // Start transcription process
    const outputDir = path.join(__dirname, "../transcripts");
    if (!fsSync.existsSync(outputDir)) {
      fsSync.mkdirSync(outputDir, { recursive: true });
    }

    // Notify client that transcription has started
    if (socketId) {
      io.to(socketId).emit('transcription-status', { status: 'started', fileName });
    }

    // Start transcription with Python script
    const pythonScript = path.join(__dirname, "../../main.py");
    const pythonProcess = spawn("python", [
      pythonScript,
      filePath,
      outputDir,
      "small",
    ]);

    let transcriptionOutput = "";
    let transcriptionError = "";

    // Track progress (if socketId provided)
    if (socketId) {
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 5;
        if (progress > 95) {
          clearInterval(progressInterval);
          progress = 95;
        }
        io.to(socketId).emit('transcription-progress', { progress, fileName });
      }, 2000);

      // Handle stdout from Python process
      pythonProcess.stdout.on("data", (data) => {
        transcriptionOutput += data.toString();
        io.to(socketId).emit('transcription-log', { log: data.toString(), fileName });
      });

      // Handle stderr from Python process
      pythonProcess.stderr.on("data", (data) => {
        transcriptionError += data.toString();
        io.to(socketId).emit('transcription-log', { log: data.toString(), fileName, isError: true });
      });

      // Process completion
      pythonProcess.on("close", async (code) => {
        clearInterval(progressInterval);
        
        if (code === 0) {
          // Success
          const baseName = path.basename(filePath, path.extname(filePath));
          const metadataPath = path.join(outputDir, `${baseName}_metadata.json`);
          
          try {
            if (fsSync.existsSync(metadataPath)) {
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

              // Send completion notification with metadata and MCQs
              io.to(socketId).emit('transcription-complete', {
                status: 'completed',
                fileName,
                metadata,
                mcqs: segmentMCQs
              });
            } else {
              io.to(socketId).emit('transcription-complete', {
                status: 'completed',
                fileName,
                error: 'Metadata file not found'
              });
            }
          } catch (error) {
            io.to(socketId).emit('transcription-complete', {
              status: 'failed',
              fileName,
              error: `Error processing metadata: ${error.message}`
            });
          }
        } else {
          // Error
          io.to(socketId).emit('transcription-complete', {
            status: 'failed',
            fileName,
            error: `Process exited with code ${code}`
          });
        }
      });
    } else {
      // Non-socket based processing (original implementation)
      pythonProcess.stdout.on("data", (data) => {
        transcriptionOutput += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        transcriptionError += data.toString();
      });

      pythonProcess.on("close", async (code) => {
        if (code !== 0) {
          console.error("Transcription failed:", transcriptionError);
          return;
        }

        try {
          // Read the segmented transcripts
          const baseName = path.basename(filePath, path.extname(filePath));
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

          console.log("Transcription and MCQ generation completed successfully");
        } catch (err) {
          console.error("Error processing transcription results:", err);
        }
      });
    }
  } catch (error) {
    console.error("Error processing video:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get transcript by ID
exports.getTranscriptById = async (req, res) => {
  try {
    const transcriptDir = path.join(__dirname, "../transcripts");
    const fileName = req.params.fileName;
    const metadataPath = path.join(transcriptDir, `${fileName}_metadata.json`);
    
    try {
      const stats = await fs.stat(metadataPath);
      if (!stats.isFile()) {
        return res.status(404).json({ error: 'Transcript not found' });
      }
      
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      res.json({ success: true, metadata });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'Transcript not found' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({ error: 'Server error while fetching transcript' });
  }
};

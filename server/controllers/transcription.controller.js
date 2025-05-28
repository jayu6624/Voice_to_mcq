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

    const videoPath = req.file.path;
    const fileName = path.basename(videoPath);
    const outputDir = path.join(__dirname, "../transcripts");
    const io = req.app.get('io');
    const socketId = req.body.socketId;

    // Send immediate response to free up the connection
    res.json({
      success: true,
      message: 'File uploaded successfully, transcription started',
      fileName
    });

    // Ensure output directory exists
    if (!fsSync.existsSync(outputDir)) {
      await fs.mkdir(outputDir, { recursive: true });
    }

    // Notify client that transcription has started
    if (socketId && io) {
      io.to(socketId).emit('transcription-status', { 
        status: 'started', 
        fileName 
      });
      
      // Send an immediate progress update
      io.to(socketId).emit('transcription-progress', { 
        progress: 5, 
        fileName 
      });
    }

    // Improved progress estimation
    let progressInterval;
    if (socketId && io) {
      const fileSize = fsSync.statSync(videoPath).size;
      const estimatedTimePerMB = 1000; // milliseconds
      const estimatedTotalTime = Math.max((fileSize / (1024 * 1024)) * estimatedTimePerMB, 30000);
      const updateFrequency = Math.min(estimatedTotalTime / 20, 3000); // More frequent updates
      
      let progress = 5;
      const startTime = Date.now();
      
      progressInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const estimatedProgress = Math.min(Math.floor((elapsedTime / estimatedTotalTime) * 100), 95);
        
        // Only send if progress has increased
        if (estimatedProgress > progress) {
          progress = estimatedProgress;
          io.to(socketId).emit('transcription-progress', { 
            progress, 
            fileName 
          });
        }
      }, updateFrequency);
    }

    // Start transcription with Python script
    const pythonScript = path.join(__dirname, "../../main.py");
    const pythonProcess = spawn("python", [
      pythonScript,
      videoPath,
      outputDir,
      "small",
    ]);

    let transcriptionOutput = "";
    let transcriptionError = "";

    // Handle stdout from Python process
    pythonProcess.stdout.on("data", (data) => {
      transcriptionOutput += data.toString();
      if (socketId && io) {
        io.to(socketId).emit('transcription-log', { 
          log: data.toString(), 
          fileName 
        });
      }
    });

    // Handle stderr from Python process
    pythonProcess.stderr.on("data", (data) => {
      transcriptionError += data.toString();
      if (socketId && io) {
        io.to(socketId).emit('transcription-log', { 
          log: data.toString(), 
          fileName, 
          isError: true 
        });
      }
    });

    // Process completion
    pythonProcess.on("close", async (code) => {
      // Clear the interval regardless of outcome
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      
      if (code === 0) {
        // Success - Read metadata and store in MongoDB
        try {
          // Read the segmented transcripts
          const baseName = path.basename(videoPath, path.extname(videoPath));
          const metadataPath = path.join(outputDir, `${baseName}_metadata.json`);
          
          if (fsSync.existsSync(metadataPath)) {
            const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));
            const fullTranscriptPath = path.join(outputDir, `${baseName}_full.txt`);
            
            // Read full transcript if available
            let fullTranscript = '';
            try {
              if (fsSync.existsSync(fullTranscriptPath)) {
                fullTranscript = await fs.readFile(fullTranscriptPath, 'utf8');
              }
            } catch (err) {
              console.error('Error reading full transcript file:', err);
            }
            
            // Save to MongoDB
            const Transcript = require('../models/transcript.model');
            
            // Check if transcript already exists
            let transcript = await Transcript.findOne({ fileId: baseName });
            
            if (!transcript) {
              // Create new transcript record
              transcript = new Transcript({
                fileId: baseName,
                fileName: fileName,
                originalFileName: path.basename(videoPath),
                fullPath: metadataPath,
                fullTranscript: fullTranscript,
                metadata: metadata,
                processed: true,
                segments: [],
                updatedAt: new Date()
              });
            } else {
              // Update existing transcript
              transcript.fileName = fileName;
              transcript.fullTranscript = fullTranscript;
              transcript.metadata = metadata;
              transcript.processed = true;
              transcript.updatedAt = new Date();
              transcript.segments = [];
            }
            
            // Add segments
            if (metadata.chunks && metadata.chunk_files) {
              for (let i = 0; i < metadata.chunks.length; i++) {
                const chunk = metadata.chunks[i];
                const chunkFile = metadata.chunk_files[i];
                
                try {
                  const segmentText = await fs.readFile(chunkFile, 'utf8');
                  
                  transcript.segments.push({
                    segmentId: chunk,
                    start: 0, // Could calculate from chunk info
                    end: 0,   // Could calculate from chunk info
                    text: segmentText,
                    filePath: chunkFile
                  });
                } catch (err) {
                  console.error(`Error reading segment file ${chunkFile}:`, err);
                  transcript.segments.push({
                    segmentId: chunk,
                    filePath: chunkFile
                  });
                }
              }
            }
            
            await transcript.save();
            console.log(`Transcript saved to MongoDB for ${fileName}`);

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

            // Important: Send explicit 100% progress update BEFORE sending completion
            if (socketId && io) {
              // First send 100% progress
              console.log(`Sending 100% progress update for ${fileName}`);
              io.to(socketId).emit('transcription-progress', { 
                progress: 100, 
                fileName 
              });
              
              // Small delay to ensure UI updates before sending completion
              setTimeout(() => {
                console.log(`Sending completion event for ${fileName}`);
                io.to(socketId).emit('transcription-complete', {
                  status: 'completed',
                  fileName,
                  metadata,
                  mcqs: segmentMCQs,
                  timestamp: Date.now()
                });
              }, 1000);
            }
            
            console.log(`Transcription completed for ${fileName}`);
          } else {
            // Metadata file not found
            if (socketId && io) {
              io.to(socketId).emit('transcription-complete', {
                status: 'failed',
                fileName,
                error: 'Metadata file not found'
              });
            }
            console.error(`Metadata file not found for ${fileName}`);
          }
        } catch (error) {
          console.error("Error processing transcription results:", error);
          if (socketId && io) {
            io.to(socketId).emit('transcription-complete', {
              status: 'failed',
              fileName,
              error: `Error processing results: ${error.message}`
            });
          }
        }
      } else {
        // Process failed
        console.error(`Transcription process failed with code ${code}`);
        if (socketId && io) {
          io.to(socketId).emit('transcription-complete', {
            status: 'failed',
            fileName,
            error: `Process exited with code ${code}: ${transcriptionError}`
          });
        }
      }
    });
  } catch (error) {
    console.error("Error processing video:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add a new endpoint to delete videos
exports.deleteVideo = async (req, res) => {
  try {
    const { fileName } = req.params;
    
    if (!fileName) {
      return res.status(400).json({ success: false, message: "File name is required" });
    }
    
    // Check if the file exists in uploads
    const uploadsDir = path.join(__dirname, "../uploads");
    const filePath = path.join(uploadsDir, fileName);
    
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ success: false, message: "File not found" });
    }
    
    // Delete the file
    await fs.unlink(filePath);
    
    // Also delete any associated transcript files
    const transcriptsDir = path.join(__dirname, "../transcripts");
    const baseFileName = fileName.split('.')[0];
    
    // Find and delete all related transcript files
    const files = await fs.readdir(transcriptsDir);
    for (const file of files) {
      if (file.startsWith(baseFileName)) {
        await fs.unlink(path.join(transcriptsDir, file));
      }
    }
    
    res.json({ success: true, message: "File and associated transcripts deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ success: false, message: "Server error while deleting file" });
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

// Get file status
exports.getFileStatus = async (req, res) => {
  try {
    const { fileName } = req.params;
    
    if (!fileName) {
      return res.status(400).json({ error: 'File name is required' });
    }
    
    // First check if this transcript is in our MongoDB
    const Transcript = require('../models/transcript.model');
    const transcript = await Transcript.findOne({ 
      $or: [
        { fileId: fileName },
        { fileName: { $regex: fileName, $options: 'i' } }
      ]
    });
    
    if (transcript) {
      return res.json({
        completed: true,
        status: 'done',
        progress: 100,
        metadata: transcript.metadata
      });
    }
    
    // If not in DB, check in the filesystem
    const transcriptDir = path.join(__dirname, "../transcripts");
    const metadataPath = path.join(transcriptDir, `${fileName}_metadata.json`);
    const fullTranscriptPath = path.join(transcriptDir, `${fileName}_full.txt`);
    
    // Check if metadata and full transcript exist
    try {
      await fs.access(metadataPath);
      await fs.access(fullTranscriptPath);
      
      // Both exist, transcript is completed
      const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));
      
      // Store in MongoDB for future use
      const newTranscript = new Transcript({
        fileId: fileName,
        fileName: fileName,
        originalFileName: path.basename(metadata.video_file || 'unknown.mp4'),
        fullPath: metadataPath,
        metadata,
        processed: true,
        segments: metadata.chunks.map((chunk, idx) => ({
          segmentId: chunk,
          start: 0,
          end: 0,
          text: '',
          filePath: metadata.chunk_files ? metadata.chunk_files[idx] : null
        }))
      });
      
      await newTranscript.save();
      
      return res.json({
        completed: true,
        status: 'done',
        progress: 100,
        metadata
      });
    } catch (error) {
      // One of the files doesn't exist
      if (error.code === 'ENOENT') {
        const videoPath = path.join(__dirname, "../uploads", fileName);
        
        // Check if the original video exists
        try {
          await fs.access(videoPath);
          // Video exists but transcript isn't complete
          return res.json({
            completed: false,
            status: 'processing',
            progress: 50 // Estimate
          });
        } catch (e) {
          // Video doesn't exist
          return res.status(404).json({ error: 'File not found' });
        }
      }
      
      throw error;
    }
  } catch (error) {
    console.error('Error checking file status:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Add a scan function for transcripts
exports.scanTranscripts = async (req, res) => {
  try {
    const transcriptDir = path.join(__dirname, "../transcripts");
    
    // Ensure directory exists
    try {
      await fs.access(transcriptDir);
    } catch (err) {
      await fs.mkdir(transcriptDir, { recursive: true });
    }
    
    const files = await fs.readdir(transcriptDir);
    const metadataFiles = files.filter((file) => file.endsWith('_metadata.json'));
    console.log(`Found ${metadataFiles.length} metadata files`);
    
    const Transcript = require('../models/transcript.model');
    const results = {
      total: metadataFiles.length,
      imported: 0,
      failed: 0,
      existing: 0
    };
    
    for (const metadataFile of metadataFiles) {
      try {
        const fileId = metadataFile.replace('_metadata.json', '');
        
        // Skip if already in database
        const existing = await Transcript.findOne({ fileId });
        if (existing) {
          results.existing++;
          continue;
        }
        
        // Read metadata and import
        const metadataPath = path.join(transcriptDir, metadataFile);
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
        
        // Find segments and create transcript
        const newTranscript = new Transcript({
          fileId,
          fileName: fileId,
          originalFileName: path.basename(metadata.video_file || 'unknown.mp4'),
          fullPath: path.join(transcriptDir, `${fileId}_full.txt`),
          metadata,
          processed: true,
          segments: (metadata.chunks || []).map(chunk => ({
            segmentId: chunk,
            start: 0,
            end: 0,
            text: '',
            filePath: path.join(transcriptDir, `${fileId}_${chunk}.txt`)
          }))
        });
        
        await newTranscript.save();
        results.imported++;
      } catch (error) {
        console.error(`Error importing transcript ${metadataFile}:`, error);
        results.failed++;
      }
    }
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error scanning transcripts:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error while scanning transcripts'
    });
  }
};

// Add a stats endpoint for dashboard
exports.getStats = async (req, res) => {
  try {
    // Import models if not already imported
    const Transcript = require('../models/transcript.model');
    const MCQ = require('../models/mcq.model');
    
    // Get count of transcripts
    const totalFiles = await Transcript.countDocuments();
    
    // Calculate total minutes of transcription
    // Each segment is roughly 5 minutes
    const transcripts = await Transcript.find().select('segments');
    let totalSegments = 0;
    transcripts.forEach(transcript => {
      totalSegments += transcript.segments?.length || 0;
    });
    const totalTranscriptMinutes = totalSegments * 5; // Assuming each segment is 5 minutes
    
    // Get count of MCQs
    const totalMcqs = await MCQ.countDocuments();
    
    res.json({
      success: true,
      stats: {
        totalFiles,
        totalTranscriptMinutes,
        totalMcqs
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while getting stats'
    });
  }
};

// Add a new endpoint to get full transcript
exports.getFullTranscript = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({ success: false, error: 'File ID is required' });
    }
    
    // First check if transcript exists in database
    const Transcript = require('../models/transcript.model');
    const transcript = await Transcript.findOne({ fileId });
    
    if (transcript) {
      // If we have it in DB, check for full transcript text
      const transcriptDir = path.join(__dirname, "../transcripts");
      const fullTranscriptPath = path.join(transcriptDir, `${fileId}_full.txt`);
      
      let fullText = '';
      try {
        fullText = await fs.readFile(fullTranscriptPath, 'utf8');
      } catch (err) {
        // If full transcript file doesn't exist, combine segments
        if (transcript.segments && transcript.segments.length > 0) {
          for (const segment of transcript.segments) {
            if (segment.filePath) {
              try {
                const segmentContent = await fs.readFile(segment.filePath, 'utf8');
                fullText += `[${segment.segmentId}]\n${segmentContent}\n\n`;
              } catch (segErr) {
                console.error(`Error reading segment file: ${segment.filePath}`, segErr);
              }
            }
          }
        }
      }
      
      return res.json({
        success: true,
        fileId,
        fileName: transcript.fileName || fileId,
        metadata: transcript.metadata,
        transcript: fullText || 'Transcript content not available',
        videoPath: transcript.metadata?.video_file || null
      });
    }
    
    // If not in DB, try to read directly from filesystem
    const transcriptDir = path.join(__dirname, "../transcripts");
    const metadataPath = path.join(transcriptDir, `${fileId}_metadata.json`);
    const fullTranscriptPath = path.join(transcriptDir, `${fileId}_full.txt`);
    
    try {
      await fs.access(metadataPath);
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      
      let fullText = '';
      try {
        fullText = await fs.readFile(fullTranscriptPath, 'utf8');
      } catch (err) {
        // If full transcript doesn't exist, try to combine segments
        if (metadata.chunk_files && metadata.chunk_files.length > 0) {
          for (const chunkFile of metadata.chunk_files) {
            try {
              const segmentContent = await fs.readFile(chunkFile, 'utf8');
              const segmentId = path.basename(chunkFile).replace(`${fileId}_`, '').replace('.txt', '');
              fullText += `[${segmentId}]\n${segmentContent}\n\n`;
            } catch (segErr) {
              console.error(`Error reading segment file: ${chunkFile}`, segErr);
            }
          }
        }
      }
      
      res.json({
        success: true,
        fileId,
        fileName: path.basename(metadata.video_file || 'unknown.mp4', path.extname(metadata.video_file || '.mp4')),
        metadata,
        transcript: fullText || 'Transcript content not available',
        videoPath: metadata.video_file || null
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ 
          success: false, 
          error: 'Transcript not found' 
        });
      }
      throw err;
    }
  } catch (error) {
    console.error('Error getting full transcript:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error while fetching transcript' 
    });
  }
};

// Update method to fetch all transcriptions
exports.getAllTranscriptions = async (req, res) => {
  try {
    // First try to get from MongoDB
    const Transcript = require('../models/transcript.model');
    const mongoTranscripts = await Transcript.find({ processed: true })
      .select('fileId fileName originalFileName fullTranscript createdAt');
    
    // If we have data in MongoDB, return it
    if (mongoTranscripts && mongoTranscripts.length > 0) {
      return res.json({
        success: true,
        transcripts: mongoTranscripts
      });
    }
    
    // Otherwise, fallback to file system
    const transcriptDir = path.join(__dirname, "../transcripts");
    
    // Ensure directory exists
    try {
      await fs.access(transcriptDir);
    } catch (err) {
      await fs.mkdir(transcriptDir, { recursive: true });
      // Return empty array if directory was just created
      return res.json({
        success: true,
        transcripts: []
      });
    }
    
    const files = await fs.readdir(transcriptDir);
    const metadataFiles = files.filter(file => file.endsWith('_metadata.json'));
    console.log(`Found ${metadataFiles.length} metadata files`);
    
    const transcripts = [];
    
    // Process each metadata file
    for (const metaFile of metadataFiles) {
      try {
        const fileId = metaFile.replace('_metadata.json', '');
        const metadataPath = path.join(transcriptDir, metaFile);
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
        
        const fullTranscriptPath = metadata.full_transcript || path.join(transcriptDir, `${fileId}_full.txt`);
        let fullTranscript = '';
        
        // Try to read the full transcript file
        try {
          if (fsSync.existsSync(fullTranscriptPath)) {
            fullTranscript = await fs.readFile(fullTranscriptPath, 'utf8');
          }
        } catch (err) {
          console.error(`Error reading full transcript for ${fileId}:`, err);
        }
        
        // Save to MongoDB for future queries
        const newTranscript = new Transcript({
          fileId,
          fileName: path.basename(metadata.video_file || ''),
          originalFileName: path.basename(metadata.video_file || ''),
          fullPath: metadataPath,
          fullTranscript,
          metadata,
          processed: true,
          createdAt: new Date(),
          segments: (metadata.chunks || []).map((chunk, idx) => ({
            segmentId: chunk,
            start: 0,
            end: 0,
            text: '',
            filePath: metadata.chunk_files ? metadata.chunk_files[idx] : null
          }))
        });
        
        try {
          await newTranscript.save();
          console.log(`Saved transcript ${fileId} to MongoDB`);
        } catch (saveErr) {
          console.error(`Error saving transcript ${fileId} to MongoDB:`, saveErr);
        }
        
        transcripts.push({
          fileId,
          fileName: path.basename(metadata.video_file || ''),
          originalFileName: path.basename(metadata.video_file || ''),
          fullTranscript,
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        console.error(`Error processing metadata file ${metaFile}:`, err);
      }
    }
    
    res.json({
      success: true,
      transcripts
    });
  } catch (error) {
    console.error('Error fetching transcriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching transcriptions'
    });
  }
};

// Add method to get a specific transcription
exports.getTranscriptionById = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      });
    }
    
    const transcriptDir = path.join(__dirname, "../transcripts");
    const metadataPath = path.join(transcriptDir, `${fileId}_metadata.json`);
    
    try {
      if (!fsSync.existsSync(metadataPath)) {
        return res.status(404).json({
          success: false,
          error: 'Transcription not found'
        });
      }
      
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      
      let fullTranscript = '';
      const fullTranscriptPath = metadata.full_transcript;
      
      // Try to read full transcript
      try {
        if (fsSync.existsSync(fullTranscriptPath)) {
          fullTranscript = await fs.readFile(fullTranscriptPath, 'utf8');
        }
      } catch (err) {
        console.error(`Error reading full transcript for ${fileId}:`, err);
      }
      
      // Get segments
      const segments = [];
      if (metadata.chunks && metadata.chunk_files) {
        for (let i = 0; i < metadata.chunks.length; i++) {
          const segmentId = metadata.chunks[i];
          const chunkFile = metadata.chunk_files[i];
          
          try {
            const text = await fs.readFile(chunkFile, 'utf8');
            segments.push({
              segmentId,
              text,
              filePath: chunkFile
            });
          } catch (err) {
            console.error(`Error reading segment file ${chunkFile}:`, err);
            segments.push({
              segmentId,
              text: '',
              filePath: chunkFile
            });
          }
        }
      }
      
      res.json({
        success: true,
        transcript: {
          fileId,
          fileName: path.basename(metadata.video_file || ''),
          originalFileName: path.basename(metadata.video_file || ''),
          fullTranscript,
          segments,
          metadata,
          createdAt: new Date().toISOString()
        }
      });
      
    } catch (err) {
      console.error(`Error processing metadata for ${fileId}:`, err);
      res.status(500).json({
        success: false,
        error: 'Error processing transcript data'
      });
    }
  } catch (error) {
    console.error('Error fetching transcription by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching transcription'
    });
  }
};

// Add a new controller method to delete a transcript
exports.deleteTranscript = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({ 
        success: false, 
        message: "File ID is required" 
      });
    }
    
    // First try to remove from MongoDB
    const Transcript = require('../models/transcript.model');
    const result = await Transcript.findOneAndDelete({ fileId });
    
    if (!result) {
      console.log(`Transcript ${fileId} not found in MongoDB`);
    } else {
      console.log(`Transcript ${fileId} removed from MongoDB`);
    }
    
    // Also delete transcript files from filesystem
    const transcriptDir = path.join(__dirname, "../transcripts");
    
    try {
      // Get a list of all files in the transcript directory
      const files = await fs.readdir(transcriptDir);
      let deletedCount = 0;
      
      // Delete all files that start with the fileId
      for (const file of files) {
        if (file.startsWith(fileId)) {
          await fs.unlink(path.join(transcriptDir, file));
          deletedCount++;
        }
      }
      
      console.log(`Deleted ${deletedCount} transcript files for ${fileId} from filesystem`);
      
      return res.json({
        success: true,
        message: `Transcript ${fileId} deleted successfully`,
        deletedFromMongo: !!result,
        deletedFiles: deletedCount
      });
      
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Directory doesn't exist - that's ok
        return res.json({
          success: true,
          message: `Transcript ${fileId} deleted from database. No files found.`,
          deletedFromMongo: !!result,
          deletedFiles: 0
        });
      }
      
      throw err;
    }
  } catch (error) {
    console.error('Error deleting transcript:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting transcript'
    });
  }
};

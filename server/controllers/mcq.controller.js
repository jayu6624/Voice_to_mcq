const axios = require("axios");
const path = require("path");
const fs = require("fs").promises;
const Transcript = require("../models/transcript.model");
const MCQ = require("../models/mcq.model");

// LLM service configurations
const LLM_API_URL = "http://localhost:5001"; // URL for the LLM service running on port 5001

// Get all transcripts
exports.getAllTranscripts = async (req, res) => {
  try {
    const transcripts = await Transcript.find().sort({ createdAt: -1 });
    res.json({ success: true, transcripts });
  } catch (error) {
    console.error("Error fetching transcripts:", error);
    res.status(500).json({ success: false, error: "Failed to fetch transcripts" });
  }
};

// Get transcript metadata
exports.getTranscriptMetadata = async (req, res) => {
  try {
    const transcript = await Transcript.findOne({ fileId: req.params.fileId });
    
    if (!transcript) {
      // Try to get metadata from file system if not in database
      const metadataPath = path.join(__dirname, '../transcripts', `${req.params.fileId}_metadata.json`);
      
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);
        return res.json({ success: true, metadata });
      } catch (err) {
        return res.status(404).json({ success: false, error: "Transcript not found" });
      }
    }
    
    res.json({ success: true, metadata: transcript.metadata });
  } catch (error) {
    console.error("Error fetching transcript metadata:", error);
    res.status(500).json({ success: false, error: "Failed to fetch transcript metadata" });
  }
};

// Get segment content
exports.getSegmentContent = async (req, res) => {
  try {
    const { fileId, segmentId } = req.params;
    
    console.log(`Requesting segment content for fileId: ${fileId}, segmentId: ${segmentId}`);
    
    // Try to get from transcript collection
    const transcript = await Transcript.findOne({ fileId });
    
    if (transcript) {
      const segment = transcript.segments.find(s => s.segmentId === segmentId);
      if (segment && segment.text) {
        console.log(`Found segment content in database for ${fileId}_${segmentId}`);
        return res.json({ success: true, content: segment.text });
      }
    }
    
    // Fallback to file system with exact file ID match
    const segmentPath = path.join(__dirname, '../transcripts', `${fileId}_${segmentId}.txt`);
    console.log(`Looking for segment file at: ${segmentPath}`);
    
    try {
      const content = await fs.readFile(segmentPath, 'utf-8');
      console.log(`Found segment file at: ${segmentPath}`);
      return res.json({ success: true, content });
    } catch (err) {
      console.log(`Segment file not found at: ${segmentPath}`);
      
      // If exact match fails, try to find a partial match in the directory
      try {
        // Get list of files in transcripts directory
        const transcriptsDir = path.join(__dirname, '../transcripts');
        const files = await fs.readdir(transcriptsDir);
        console.log(`Searching among ${files.length} files in transcripts directory`);
        
        // Find files that might match by date part and segment ID
        const datePart = fileId.split('-').slice(1).join('-'); // Get the date part of the fileId
        const potentialMatches = files.filter(file => {
          return file.includes(datePart) && file.includes(`_${segmentId}.txt`);
        });
        
        if (potentialMatches.length > 0) {
          // Use the first match
          const matchPath = path.join(transcriptsDir, potentialMatches[0]);
          console.log(`Found potential match: ${matchPath}`);
          const content = await fs.readFile(matchPath, 'utf-8');
          return res.json({ success: true, content });
        }
        
        // If no matches by date, just look for any file with the segment ID
        const segmentMatches = files.filter(file => file.includes(`_${segmentId}.txt`));
        
        if (segmentMatches.length > 0) {
          // Use the first match
          const matchPath = path.join(transcriptsDir, segmentMatches[0]);
          console.log(`Found segment match: ${matchPath}`);
          const content = await fs.readFile(matchPath, 'utf-8');
          return res.json({ success: true, content });
        }
        
        // If still no match, return 404
        console.log(`No matching segment files found for ${segmentId}`);
        return res.status(404).json({ 
          success: false, 
          error: "Segment content not found", 
          fileId, 
          segmentId,
          availableFiles: files.filter(f => f.endsWith('.txt')).slice(0, 10) // Show first 10 txt files
        });
      } catch (dirErr) {
        console.error("Error reading transcripts directory:", dirErr);
        return res.status(404).json({ success: false, error: "Segment content not found" });
      }
    }
  } catch (error) {
    console.error("Error fetching segment content:", error);
    res.status(500).json({ success: false, error: "Failed to fetch segment content" });
  }
};

// Get MCQs by segment
exports.getMCQsBySegment = async (req, res) => {
  try {
    const { fileId, segmentId } = req.params;
    const mcqs = await MCQ.find({ fileId, segmentId });
    res.json({ success: true, mcqs });
  } catch (error) {
    console.error("Error fetching MCQs:", error);
    res.status(500).json({ success: false, error: "Failed to fetch MCQs" });
  }
};

// Generate MCQs for a segment using the LLM service
exports.generateMCQs = async (req, res) => {
  const io = req.app.get('io'); // Get socket.io instance for real-time updates
  
  try {
    const { fileId, segment } = req.body;
    
    if (!fileId || !segment) {
      return res.status(400).json({
        success: false,
        error: "fileId and segment are required"
      });
    }
    
    console.log(`Generating MCQs for ${fileId}, segment ${segment}`);
    if (io) io.emit('mcq-status', { fileId, segment, status: 'started', message: 'Starting MCQ generation' });
    
    // First check if LLM service is running
    try {
      console.log('Checking LLM service health...');
      const healthCheck = await axios.get(`${LLM_API_URL}/health`, { timeout: 5000 });
      console.log('LLM service health check response:', healthCheck.data);
      
      if (healthCheck.data?.status !== 'ok') {
        console.error('LLM service is not healthy');
        if (io) io.emit('mcq-status', { fileId, segment, status: 'error', message: 'LLM service is not healthy' });
        return res.status(503).json({
          success: false,
          error: "LLM service is not available or not healthy"
        });
      }
    } catch (error) {
      console.error('LLM service health check failed:', error.message);
      if (io) io.emit('mcq-status', { fileId, segment, status: 'error', message: 'LLM service not available' });
      return res.status(503).json({
        success: false,
        error: "LLM service is not running",
        details: error.message
      });
    }
    
    // Get segment content
    let segmentContent = "";
    let segmentFound = false;
    
    try {
      // First try to get from database
      const transcript = await Transcript.findOne({ fileId });
      
      if (transcript) {
        const segmentObj = transcript.segments.find(s => s.segmentId === segment);
        if (segmentObj && segmentObj.text) {
          segmentContent = segmentObj.text;
          segmentFound = true;
          console.log(`Found segment content in database for ${fileId}_${segment}`);
        }
      }
      
      if (!segmentContent) {
        // Try reading from file with exact match
        try {
          const segmentPath = path.join(__dirname, '../transcripts', `${fileId}_${segment}.txt`);
          console.log(`Looking for segment file at: ${segmentPath}`);
          segmentContent = await fs.readFile(segmentPath, 'utf-8');
          segmentFound = true;
          console.log(`Found segment file at exact path: ${segmentPath}`);
        } catch (exactPathErr) {
          console.log(`Segment not found at exact path, trying alternative paths...`);
          
          // If exact match fails, try to find any segment file with matching segment ID
          const transcriptsDir = path.join(__dirname, '../transcripts');
          const files = await fs.readdir(transcriptsDir);
          
          // Try to find by segment ID only
          const segmentMatches = files.filter(file => file.includes(`_${segment}.txt`));
          
          if (segmentMatches.length > 0) {
            // Use the first match
            const matchPath = path.join(transcriptsDir, segmentMatches[0]);
            console.log(`Found alternative segment match: ${matchPath}`);
            segmentContent = await fs.readFile(matchPath, 'utf-8');
            segmentFound = true;
          } else {
            console.log(`No matching segment files found for segment ${segment}`);
          }
        }
      }
    } catch (error) {
      console.error("Error reading segment content:", error);
      if (io) io.emit('mcq-status', { fileId, segment, status: 'error', message: 'Segment content not found' });
      return res.status(404).json({
        success: false,
        error: "Segment content not found"
      });
    }
    
    if (!segmentFound || !segmentContent || segmentContent.trim() === "") {
      console.error(`Segment content is empty or not found for ${fileId}_${segment}`);
      if (io) io.emit('mcq-status', { fileId, segment, status: 'error', message: 'Segment content is empty' });
      return res.status(404).json({
        success: false,
        error: "Segment content is empty or not found"
      });
    }
    
    console.log(`Got segment content (${segmentContent.length} chars), calling LLM service...`);
    if (io) io.emit('mcq-status', { fileId, segment, status: 'processing', message: 'Generating questions with LLM...' });
    
    try {
      // Call the LLM service API to generate MCQs
      console.log(`Making request to LLM service at ${LLM_API_URL}/generate`);
      
      const llmResponse = await axios.post(`${LLM_API_URL}/generate`, {
        text: segmentContent,
        num_questions: 5, // Request 5 questions
        segment_id: segment,
        file_id: fileId
      }, { 
        timeout: 120000, // Increase timeout to 2 minutes for LLM processing
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('LLM service response status:', llmResponse.status);
      console.log('LLM service response:', JSON.stringify(llmResponse.data).substring(0, 200) + '...');
      
      if (!llmResponse.data.success) {
        console.error('LLM service reported failure:', llmResponse.data.message);
        if (io) io.emit('mcq-status', { fileId, segment, status: 'error', message: llmResponse.data.message || 'LLM service failed' });
        throw new Error(llmResponse.data.message || "LLM service failed to generate MCQs");
      }
      
      const generatedMcqs = llmResponse.data.mcqs;
      
      if (!generatedMcqs || !Array.isArray(generatedMcqs) || generatedMcqs.length === 0) {
        console.error('LLM service returned no MCQs');
        if (io) io.emit('mcq-status', { fileId, segment, status: 'error', message: 'No questions were generated' });
        throw new Error("LLM service returned no valid MCQs");
      }
      
      console.log(`LLM service generated ${generatedMcqs.length} MCQs`);
      if (io) io.emit('mcq-status', { fileId, segment, status: 'saving', message: `Saving ${generatedMcqs.length} questions...` });
      
      // Save the generated MCQs to the database
      const savedMcqs = [];
      
      for (const mcq of generatedMcqs) {
        try {
          // Validate MCQ format
          if (!mcq.question || !Array.isArray(mcq.options) || mcq.options.length !== 4 || 
              typeof mcq.correct !== 'number' || mcq.correct < 0 || mcq.correct > 3) {
            console.warn('Skipping invalid MCQ format:', JSON.stringify(mcq).substring(0, 100));
            continue;
          }
          
          // Create new MCQ
          const newMcq = new MCQ({
            fileId,
            segmentId: segment,
            question: mcq.question,
            options: mcq.options,
            correct: mcq.correct,
            isAutoGenerated: true,
            metadata: {
              gpu_used: llmResponse.data.gpu_used || false,
              model: llmResponse.data.model || 'unknown',
              generated_at: new Date()
            }
          });
          
          await newMcq.save();
          savedMcqs.push(newMcq);
        } catch (error) {
          console.error("Error saving MCQ:", error);
        }
      }
      
      if (savedMcqs.length === 0) {
        console.error('Failed to save any MCQs to database');
        if (io) io.emit('mcq-status', { fileId, segment, status: 'error', message: 'Failed to save questions' });
        return res.status(500).json({
          success: false,
          error: "Failed to save any MCQs to database"
        });
      }
      
      console.log(`Successfully saved ${savedMcqs.length} MCQs to database`);
      if (io) io.emit('mcq-status', { fileId, segment, status: 'completed', message: `Generated ${savedMcqs.length} questions` });
      
      return res.json({
        success: true,
        mcqs: savedMcqs,
        message: `Generated ${savedMcqs.length} MCQs`
      });
    } catch (error) {
      console.error("Error calling LLM service:", error);
      if (io) io.emit('mcq-status', { fileId, segment, status: 'error', message: `LLM error: ${error.message}` });
      return res.status(500).json({
        success: false,
        error: `Error calling LLM service: ${error.message}`
      });
    }
  } catch (error) {
    console.error("Error generating MCQs:", error);
    if (io) io.emit('mcq-status', { fileId, segment: req.body?.segment, status: 'error', message: `Server error: ${error.message}` });
    res.status(500).json({
      success: false,
      error: `Server error while generating MCQs: ${error.message}`
    });
  }
};

// Update MCQ
exports.updateMCQ = async (req, res) => {
  try {
    const { mcqId } = req.params;
    const mcqData = req.body;
    
    const mcq = await MCQ.findByIdAndUpdate(mcqId, mcqData, { new: true });
    
    if (!mcq) {
      return res.status(404).json({ success: false, error: "MCQ not found" });
    }
    
    res.json({ success: true, mcq });
  } catch (error) {
    console.error("Error updating MCQ:", error);
    res.status(500).json({ success: false, error: "Failed to update MCQ" });
  }
};

// Delete MCQ
exports.deleteMCQ = async (req, res) => {
  try {
    const { mcqId } = req.params;
    await MCQ.findByIdAndDelete(mcqId);
    res.json({ success: true, message: "MCQ deleted successfully" });
  } catch (error) {
    console.error("Error deleting MCQ:", error);
    res.status(500).json({ success: false, error: "Failed to delete MCQ" });
  }
};

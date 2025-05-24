import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { spawn } from 'child_process';
import fs from 'fs';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use('/transcripts', express.static(path.join(__dirname, '../../transcripts')));

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// Set up multer for file uploads
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'video/mp4') {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error('Only MP4 files are allowed!'));
    }
  }
});

// Upload endpoint
app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded or invalid file type' });
    }

    const socketId = req.body.socketId;
    const fileName = req.file.filename;
    const filePath = req.file.path;
    
    // Send initial response
    res.json({ 
      success: true, 
      message: 'File uploaded successfully, transcription started', 
      fileName 
    });
    
    // Start transcription process
    // const transcriptDir = path.join(__dirname, '../../transcripts');
    // const pythonScript = path.join(__dirname, '../../main.py');
    
    // Emit to specific socket that transcription has started
    io.to(socketId).emit('transcription-status', { status: 'started', fileName });
    
    // const pythonProcess = spawn('python', [pythonScript, filePath, transcriptDir, 'small']);
    
    let progress = 0;
    const progressInterval = setInterval(() => {
      // Simulate progress until we get real feedback (in a real app this would be more accurate)
      progress += 5;
      if (progress > 95) {
        clearInterval(progressInterval);
        progress = 95;
      }
      io.to(socketId).emit('transcription-progress', { progress, fileName });
    }, 2000);
    
    // pythonProcess.stdout.on('data', (data) => {
    //   console.log(`stdout: ${data}`);
    //   io.to(socketId).emit('transcription-log', { log: data.toString(), fileName });
    // });
    
    // pythonProcess.stderr.on('data', (data) => {
    //   console.error(`stderr: ${data}`);
    //   io.to(socketId).emit('transcription-log', { log: data.toString(), fileName, isError: true });
    // });
    
    // pythonProcess.on('close', (code) => {
    //   clearInterval(progressInterval);
    //   console.log(`Python process exited with code ${code}`);
      
    //   if (code === 0) {
    //     // Success
    //     const baseName = path.basename(filePath).split('.')[0];
    //     const metadataPath = path.join(transcriptDir, `${baseName}_metadata.json`);
        
        if (fs.existsSync(metadataPath)) {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          io.to(socketId).emit('transcription-complete', { 
            status: 'completed', 
            fileName,
            metadata
          });
        } else {
          io.to(socketId).emit('transcription-complete', { 
            status: 'completed', 
            fileName,
            error: 'Metadata file not found'
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
  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).json({ error: 'Server error during file processing' });
  }
});

// Get transcript chunks
app.get('/api/transcripts/:fileName', (req, res) => {
  try {
    const transcriptDir = path.join(__dirname, '../../transcripts');
    const fileName = req.params.fileName;
    const metadataPath = path.join(transcriptDir, `${fileName}_metadata.json`);
    
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: 'Transcript not found' });
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    res.json({ success: true, metadata });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({ error: 'Server error while fetching transcript' });
  }
});

// Socket connections for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.emit('connection-established', { socketId: socket.id });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

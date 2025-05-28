import { io, Socket } from 'socket.io-client';

export const API_URL = 'http://localhost:5000';

// Store socket instance in module scope to persist across component unmounts
let socket: Socket | null = null;
let listeners: Record<string, Function[]> = {};
let reconnecting = false;

export const initializeSocket = () => {
  if (socket) return socket;
  
  socket = io(API_URL, {
    // Configure better reconnection logic
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    // Force transports for better reliability
    transports: ['websocket', 'polling'],
    // Avoid cross-domain security issues
    withCredentials: true
  });
  
  // Set up debug logging
  socket.on('connect', () => {
    console.log('Socket connected with ID:', socket?.id);
    reconnecting = false; // Reset reconnecting flag on successful connection
    
    // Notify all connection listeners
    if (socket) {
      emitLocalEvent('socketConnected', socket.id);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Socket disconnected, trying to reconnect...');
    reconnecting = true;
    emitLocalEvent('socketDisconnected');
  });
  
  socket.on('connect_error', (err) => {
    console.log('Connection error:', err.message);
    emitLocalEvent('socketError', err.message);
  });
  
  // Enhanced reconnection events for better handling of server restarts
  socket.on('reconnect', (attemptNumber) => {
    console.log(`Socket reconnected after ${attemptNumber} attempts with ID: ${socket?.id}`);
    reconnecting = false;
    if (socket) {
      emitLocalEvent('socketReconnected', socket.id, attemptNumber);
    }
  });
  
  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`Socket reconnection attempt ${attemptNumber}`);
    emitLocalEvent('socketReconnecting', attemptNumber);
  });
  
  socket.on('reconnect_error', (error) => {
    console.error('Socket reconnection error:', error);
    emitLocalEvent('socketReconnectError', error);
  });

  // Forward all transcription events to local listeners with improved logging
  socket.on('connection-established', (data) => {
    console.log('Received connection established with ID:', data.socketId);
    emitLocalEvent('connection-established', data);
  });
  
  socket.on('transcription-status', (data) => {
    console.log('Transcription status update:', data);
    emitLocalEvent('transcription-status', data);
  });
  
  socket.on('transcription-progress', (data) => {
    console.log('Transcription progress:', data);
    emitLocalEvent('transcription-progress', data);
  });
  
  socket.on('transcription-log', (data) => {
    console.log('Transcription log:', data);
    emitLocalEvent('transcription-log', data);
  });
  
  // Enhanced handlers for transcription complete events
  socket.on('transcription_complete', (data) => {
    console.log('Transcription_complete event received with full details:', data);
    handleTranscriptionComplete(data);
  });
  
  socket.on('transcription-complete', (data) => {
    console.log('Transcription-complete event received with full details:', data);
    handleTranscriptionComplete(data);
  });
  
  // Central handler for transcription complete events with improved completion handling
  const handleTranscriptionComplete = (data: any) => {
    // Make sure we have a valid data object
    if (!data || !data.fileName) {
      console.error('Received invalid transcription complete data:', data);
      return;
    }
    
    console.log(`Processing completion for: ${data.fileName}`);
    
    // Dispatch both events to ensure we catch it regardless of connection state
    // This helps when server restarts during processing
    
    // 1. First force 100% progress
    emitLocalEvent('transcription-progress', { 
      fileName: data.fileName, 
      originalName: data.originalName,
      progress: 100 
    });
    
    // 2. Then send the completion event
    emitLocalEvent('transcription-complete', {
      ...data,
      timestamp: Date.now() // Add timestamp for tracking when this happened
    });
    
    // 3. Also dispatch a DOM event as a backup mechanism (helps with server restarts)
    try {
      const event = new CustomEvent('transcriptionCompleted', { 
        detail: {
          ...data,
          progress: 100,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    } catch (e) {
      console.error('Failed to dispatch DOM event:', e);
    }
  };
  
  return socket;
};

// Returns socket status
export const isConnected = () => {
  return socket?.connected || false;
};

// Returns true if currently attempting to reconnect
export const isReconnecting = () => {
  return reconnecting;
};

// Get the existing socket or create a new one
export const getSocket = () => {
  if (!socket) return initializeSocket();
  return socket;
};

// Add a local event listener
export const addEventListener = (event: string, callback: Function) => {
  if (!listeners[event]) {
    listeners[event] = [];
  }
  listeners[event].push(callback);
  
  return () => {
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  };
};

// Trigger local event listeners
const emitLocalEvent = (event: string, ...args: any[]) => {
  if (listeners[event]) {
    listeners[event].forEach(callback => {
      callback(...args);
    });
  }
};

// Add a keep-alive ping to prevent socket disconnections
setInterval(() => {
  if (socket && socket.connected) {
    socket.emit('ping');
  }
}, 30000); // 30 second ping

// Cleanup function - generally not needed as we want the socket to persist
export const closeSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    listeners = {};
  }
};

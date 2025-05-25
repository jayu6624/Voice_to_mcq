import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let socketReady = false;

export const initializeSocket = (serverUrl: string = 'http://localhost:5000') => {
  if (socket) return socket;

  socket = io(serverUrl);
  
  socket.on('connect', () => {
    console.log('Socket connected');
    socketReady = true;
  });
  
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
    socketReady = false;
  });

  return socket;
};

export const getSocket = () => {
  return socket;
};

export const isSocketReady = () => {
  return socketReady;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketReady = false;
  }
};

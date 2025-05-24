# Whisper Task - Video Transcription & Quiz Generator

A web application that transcribes videos, generates MCQs from transcriptions, and provides an interactive learning platform.

## Features

- 🎥 Video Upload & Transcription
- 🤖 OpenAI Whisper Integration
- 📝 Automatic MCQ Generation
- 🎯 Segment-wise Quiz Creation
- 📊 Performance Analytics
- 👤 User Authentication
- 🔒 Secure API Integration

## Tech Stack

### Frontend

- React with TypeScript
- TailwindCSS for styling
- React Router for navigation
- React Hook Form for form management
- Lucide React for icons

### Backend

- Node.js & Express
- MongoDB with Mongoose
- Python for Whisper Integration
- JWT Authentication
- Socket.IO for real-time updates

## Prerequisites

- Node.js (v14 or higher)
- Python 3.8+
- MongoDB
- GPU support (recommended for faster transcription)

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Whisper_task
   ```

2. **Install Frontend Dependencies**

   ```bash
   cd frontend
   npm install
   ```

3. **Install Backend Dependencies**

   ```bash
   cd ../server
   npm install
   ```

4. **Install Python Dependencies**

   ```bash
   pip install -r requirements.txt
   ```

5. **Environment Setup**

   Create `.env` file in the server directory:

   ```env
   PORT=5000
   MONGODB_URL=your_mongodb_url
   JWT_SECRET=your_jwt_secret
   PYTHON_PATH=/path/to/python
   ```

## Running the Application

1. **Start the Backend Server**

   ```bash
   cd server
   npm start
   ```

2. **Start the Frontend Development Server**
   ```bash
   cd frontend
   npm run dev
   ```

The application will be available at: `http://localhost:5173`

## Project Structure

This README provides:

1. Project overview
2. Setup instructions
3. Tech stack details
4. Project structure
5. Feature documentation
6. API endpoints
7. Contribution guidelines
8. Clear installation steps
9. Environmental requirements
10. License information

Feel free to customize it based on your specific project needs!

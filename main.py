import os
import sys
import torch
import whisper
import json
import tempfile
import subprocess
import concurrent.futures
import numpy as np
import shutil
from datetime import timedelta
from pydub import AudioSegment

# Try to import MoviePy, but don't fail if it's not available
try:
    from moviepy.editor import VideoFileClip
    MOVIEPY_AVAILABLE = True
except ImportError:
    MOVIEPY_AVAILABLE = False
    print("MoviePy not available, will use ffmpeg directly for audio extraction")
    
# Check if ffmpeg is available
FFMPEG_AVAILABLE = shutil.which('ffmpeg') is not None
if not FFMPEG_AVAILABLE:
    print("WARNING: ffmpeg not found in PATH. Audio extraction may fail.")

def extract_audio(video_file_path, output_audio_path=None):
    """Extract audio from video file"""
    if output_audio_path is None:
        output_audio_path = os.path.splitext(video_file_path)[0] + ".wav"
    
    # Try ffmpeg first if available
    if FFMPEG_AVAILABLE:
        try:
            print("Extracting audio using ffmpeg...")
            cmd = ["ffmpeg", "-i", video_file_path, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", output_audio_path, "-y"]
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            return output_audio_path
        except Exception as e:
            print(f"ffmpeg audio extraction failed: {e}")
    else:
        print("ffmpeg not available, skipping ffmpeg extraction attempt")
        
    # Try MoviePy if available
    if MOVIEPY_AVAILABLE:
        try:
            print("Trying MoviePy for audio extraction...")
            video = VideoFileClip(video_file_path)
            video.audio.write_audiofile(output_audio_path, codec='pcm_s16le', verbose=False, logger=None)
            return output_audio_path
        except Exception as e:
            print(f"MoviePy audio extraction failed: {e}")
    
    # If we get here, both methods failed or weren't available
    raise Exception("Could not extract audio: both ffmpeg and MoviePy methods failed or unavailable")

def split_audio(audio_file_path, num_chunks=2):
    """Split audio file into equal parts"""
    audio = AudioSegment.from_file(audio_file_path)
    chunk_length = len(audio) // num_chunks
    
    temp_dir = tempfile.mkdtemp()
    chunk_files = []
    
    for i in range(num_chunks):
        start_time = i * chunk_length
        end_time = (i + 1) * chunk_length if i < num_chunks - 1 else len(audio)
        chunk = audio[start_time:end_time]
        
        chunk_path = os.path.join(temp_dir, f"chunk_{i}.wav")
        chunk.export(chunk_path, format="wav")
        chunk_files.append({
            "path": chunk_path,
            "start_time": start_time / 1000.0,  # Convert to seconds
            "end_time": end_time / 1000.0  # Convert to seconds
        })
    
    return chunk_files

def transcribe_chunk(chunk_data, model_size, device):
    """Transcribe a single audio chunk with its own model instance"""
    chunk_path = chunk_data["path"]
    start_offset = chunk_data["start_time"]
    
    # Load a new model instance for this thread
    model = whisper.load_model(model_size, device=device)
    
    # Use whisper to transcribe the chunk
    result = model.transcribe(chunk_path, verbose=False)
    
    # Adjust timestamps based on chunk offset
    for segment in result["segments"]:
        segment["start"] += start_offset
        segment["end"] += start_offset
    
    return result["segments"]

def transcribe_video(video_file_path, output_dir="transcripts", model_size="small"):
    # Check if CUDA is available
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")
    
    # Calculate optimal number of chunks based on available GPU memory
    num_chunks = 2  # Default to 2 chunks
    if device == "cuda":
        # Check available GPU memory and adjust number of chunks if needed
        free_memory = torch.cuda.get_device_properties(0).total_memory - torch.cuda.memory_allocated(0)
        free_memory_gb = free_memory / (1024**3)
        print(f"Available GPU memory: {free_memory_gb:.2f} GB")
        
        # Adjust chunks based on available memory (rough estimate)
        if free_memory_gb < 4:
            num_chunks = 4
        elif free_memory_gb > 8:
            num_chunks = 2
        else:
            num_chunks = 3
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Get base filename without extension
    base_name = os.path.basename(video_file_path).rsplit('.', 1)[0]
    
    # Extract audio from video
    print(f"Extracting audio from {video_file_path}")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio:
        audio_path = temp_audio.name
    
    try:
        extract_audio(video_file_path, audio_path)
        
        # Split audio into chunks
        print(f"Splitting audio into {num_chunks} chunks for parallel processing")
        audio_chunks = split_audio(audio_path, num_chunks)
        
        # Load the model for verification, but we'll create separate instances per worker
        _ = whisper.load_model(model_size, device=device)
        print(f"Model {model_size} loaded successfully")
        
        # Process chunks in parallel - each thread will load its own model
        print(f"Starting parallel transcription with {num_chunks} workers")
        all_segments = []
        
        # Use ProcessPoolExecutor for true parallelism
        with concurrent.futures.ThreadPoolExecutor(max_workers=num_chunks) as executor:
            # Submit all tasks - each with model_size instead of model instance
            future_to_chunk = {executor.submit(transcribe_chunk, chunk, model_size, device): i 
                               for i, chunk in enumerate(audio_chunks)}
            
            # Process results as they complete
            for future in concurrent.futures.as_completed(future_to_chunk):
                chunk_idx = future_to_chunk[future]
                try:
                    chunk_segments = future.result()
                    print(f"Chunk {chunk_idx} transcription complete")
                    all_segments.extend(chunk_segments)
                except Exception as e:
                    print(f"Error processing chunk {chunk_idx}: {e}")
                    print(f"Full error: {str(e)}")
        
        # Sort segments by start time
        all_segments.sort(key=lambda x: x["start"])
        
        # Process and segment the transcript into 5-minute chunks
        chunks = {}
        
        for segment in all_segments:
            # Calculate which 5-minute chunk this segment belongs to
            start_time = segment["start"]
            chunk_index = int(start_time // 300)  # 300 seconds = 5 minutes
            
            chunk_start = chunk_index * 5  # in minutes
            chunk_end = (chunk_index + 1) * 5  # in minutes
            chunk_key = f"{chunk_start:02d}_{chunk_end:02d}"
            
            if chunk_key not in chunks:
                chunks[chunk_key] = []
            
            # Add segment to the appropriate chunk
            chunks[chunk_key].append({
                "start": segment["start"],
                "end": segment["end"],
                "text": segment["text"]
            })
        
        # Save the segmented transcript
        full_transcript = ""
        chunk_files = []
        
        for chunk_key, chunk_segments in chunks.items():
            chunk_text = "\n".join([s["text"] for s in chunk_segments])
            full_transcript += f"\n--- {chunk_key.replace('_', '-')} minutes ---\n{chunk_text}\n"
            
            # Save individual chunk file
            chunk_file = f"{output_dir}/{base_name}_{chunk_key}.txt"
            with open(chunk_file, "w", encoding="utf-8") as f:
                f.write(f"Transcript {chunk_key.replace('_', '-')} minutes:\n{chunk_text}")
            chunk_files.append(chunk_file)
        
        # Save full transcript
        full_output_path = f"{output_dir}/{base_name}_full.txt"
        with open(full_output_path, "w", encoding="utf-8") as f:
            f.write(full_transcript)
        
        # Save metadata
        metadata = {
            "video_file": video_file_path,
            "model_size": model_size,
            "chunks": list(chunks.keys()),
            "chunk_files": chunk_files,
            "full_transcript": full_output_path,
            "parallel_chunks": num_chunks
        }
        
        with open(f"{output_dir}/{base_name}_metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)
        
        print(f"Transcription complete. Results saved to {output_dir}/{base_name}_*.txt")
        return metadata
    
    finally:
        # Clean up temporary files
        try:
            os.unlink(audio_path)
            # Delete any temporary directories created for audio chunks
            for chunk in audio_chunks if 'audio_chunks' in locals() else []:
                try:
                    if os.path.exists(chunk["path"]):
                        os.unlink(chunk["path"])
                except:
                    pass
        except:
            pass

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python main.py <video_file_path> [output_dir] [model_size]")
        sys.exit(1)
    
    video_file = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "transcripts"
    model_size = sys.argv[3] if len(sys.argv) > 3 else "small"
    
    transcribe_video(video_file, output_dir, model_size)

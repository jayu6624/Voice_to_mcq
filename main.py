import os
import sys
import torch
import whisper
import json
from datetime import timedelta

def transcribe_video(video_file_path, output_dir="transcripts", model_size="small"):
    # Check if CUDA is available
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")
    
    # Load the Whisper model
    model = whisper.load_model(model_size, device=device)
    print(f"Model {model_size} loaded successfully")
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Get base filename without extension
    base_name = os.path.basename(video_file_path).rsplit('.', 1)[0]
    
    # Transcribe the audio
    print(f"Starting transcription of {video_file_path}")
    result = model.transcribe(video_file_path, verbose=True)
    
    # Process and segment the transcript into 5-minute chunks
    segments = result["segments"]
    chunks = {}
    
    for segment in segments:
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
        "full_transcript": full_output_path
    }
    
    with open(f"{output_dir}/{base_name}_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    
    print(f"Transcription complete. Results saved to {output_dir}/{base_name}_*.txt")
    return metadata

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python main.py <video_file_path> [output_dir] [model_size]")
        sys.exit(1)
    
    video_file = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "transcripts"
    model_size = sys.argv[3] if len(sys.argv) > 3 else "small"
    
    transcribe_video(video_file, output_dir, model_size)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn
import json
import os
from ollama_service import generate_mcqs, get_available_devices
from config import GPU_ENABLED, GPU_LAYERS, DEFAULT_MODEL

app = FastAPI(title="MCQ Generation API")

class TranscriptRequest(BaseModel):
    text: str
    num_questions: Optional[int] = 5
    segment_id: Optional[str] = None
    file_id: Optional[str] = None
    model: Optional[str] = None
    use_gpu: Optional[bool] = True

class MCQResponse(BaseModel):
    success: bool
    mcqs: List[Dict[str, Any]]
    message: Optional[str] = None
    gpu_used: bool = False

@app.post("/generate", response_model=MCQResponse)
async def create_mcqs(request: TranscriptRequest):
    """
    Generate MCQs from transcript text with optional GPU acceleration.
    """
    if not request.text or len(request.text.strip()) < 50:
        return MCQResponse(
            success=False,
            mcqs=[],
            message="Transcript text is too short or empty",
            gpu_used=False
        )
    
    # Determine if we should use GPU
    use_gpu = request.use_gpu and GPU_ENABLED
    
    try:
        # Generate MCQs with Ollama service
        mcqs = generate_mcqs(
            request.text,
            request.num_questions,
            model=request.model or DEFAULT_MODEL,
            use_gpu=use_gpu
        )
        
        # Cache results if file_id and segment_id are provided
        if request.file_id and request.segment_id:
            cache_folder = os.path.join(os.path.dirname(__file__), "cache")
            os.makedirs(cache_folder, exist_ok=True)
            
            cache_file = os.path.join(cache_folder, f"{request.file_id}_{request.segment_id}.json")
            with open(cache_file, "w") as f:
                json.dump(mcqs, f)
        
        return MCQResponse(
            success=True,
            mcqs=mcqs,
            message=f"Generated {len(mcqs)} questions using {'GPU' if use_gpu else 'CPU'}",
            gpu_used=use_gpu
        )
    except Exception as e:
        print(f"Error generating MCQs: {str(e)}")
        return MCQResponse(
            success=False,
            mcqs=[],
            message=f"Error generating MCQs: {str(e)}",
            gpu_used=False
        )

@app.get("/health")
async def health_check():
    """Health check endpoint with GPU availability information"""
    devices = get_available_devices()
    return {
        "status": "ok",
        "gpu": {
            "enabled": GPU_ENABLED,
            "layers": GPU_LAYERS,
            "available": devices.get("cuda_available", False) if devices.get("success") else False
        },
        "model": DEFAULT_MODEL
    }

if __name__ == "__main__":
    # Print GPU availability info at startup
    devices = get_available_devices()
    if devices["success"] and devices["cuda_available"]:
        print(f"[GPU] CUDA acceleration is available! Using {GPU_LAYERS} layers on GPU.")
    else:
        print("[WARNING] CUDA acceleration not available or disabled. Using CPU only.")
        
    uvicorn.run(app, host="0.0.0.0", port=5001)

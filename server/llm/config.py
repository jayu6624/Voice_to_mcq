import os
import torch

# Model configuration
DEFAULT_MODEL = os.environ.get("DEFAULT_MODEL", "gemma3:4b")

# GPU configuration - enable by default if CUDA is available
CUDA_AVAILABLE = torch.cuda.is_available()
GPU_ENABLED = os.environ.get("GPU_ENABLED", "1") == "1"
GPU_LAYERS = int(os.environ.get("GPU_LAYERS", "100"))

# API configuration
API_PORT = int(os.environ.get("API_PORT", "5001"))
# Fix: Use the correct Ollama API URL (port 11434 is the default for Ollama)
OLLAMA_API_URL = os.environ.get("OLLAMA_API_URL", "http://localhost:11434/api/generate")
OLLAMA_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", "60"))

# MCQ generation settings
DEFAULT_NUM_QUESTIONS = int(os.environ.get("DEFAULT_NUM_QUESTIONS", "5"))
MAX_NUM_QUESTIONS = int(os.environ.get("MAX_NUM_QUESTIONS", "10"))

def get_ollama_params(prompt: str, model: str = None) -> dict:
    """Generate parameters for Ollama API call with GPU acceleration if available"""
    params = {
        "model": model or DEFAULT_MODEL,
        "prompt": prompt,
        "stream": False,
    }
    
    # Add GPU configuration
    if GPU_ENABLED and GPU_LAYERS > 0:
        params["options"] = {
            "num_gpu": GPU_LAYERS
        }
    
    return params

print(f"CUDA Available: {CUDA_AVAILABLE}")
print(f"GPU Enabled: {GPU_ENABLED}")
print(f"Using Model: {DEFAULT_MODEL}")

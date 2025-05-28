import requests
import json
import re
import torch
import random
import os
from typing import List, Dict, Any, Union, Optional

# Configuration
DEFAULT_HOST = "http://localhost:11434"
DEFAULT_TIMEOUT = 120  # seconds

# Define the URL for the local Ollama API
OLLAMA_API_URL = "http://localhost:11434/api/generate"

# Add debug mode to help diagnose issues
DEBUG_MODE = os.environ.get("DEBUG_MODE", "1") == "1"

# Default model - can be overridden with environment variable
DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:4b")

# GPU configuration - set to 0 to disable, positive number for number of layers on GPU
# Can be overridden with environment variable OLLAMA_GPU_LAYERS
GPU_LAYERS = int(os.environ.get("OLLAMA_GPU_LAYERS", "50"))

def get_available_devices() -> Dict[str, Any]:
    """Check available devices for model inference"""
    try:
        cuda_available = torch.cuda.is_available()
        device_count = torch.cuda.device_count() if cuda_available else 0
        device_name = torch.cuda.get_device_name(0) if cuda_available and device_count > 0 else None
        
        return {
            "success": True,
            "cuda_available": cuda_available,
            "device_count": device_count,
            "device_name": device_name
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def generate_mcqs(transcript: str, num_questions: int = 5, model: str = None, use_gpu: bool = True) -> List[Dict[str, Any]]:
    """
    Generate MCQs using the local Ollama model with CUDA acceleration.
    
    Args:
        transcript: The transcript text to generate questions from
        num_questions: Number of questions to generate (default: 5)
        model: Override default model (default: gemma3:4b)
        use_gpu: Whether to use GPU acceleration (default: True)
        
    Returns:
        A list of MCQ objects with structure:
        {
            "question": str,
            "options": List[str],
            "correct": int (index of correct option)
        }
    """
    if not transcript or len(transcript.strip()) < 50:
        return []
    
    # Clean and prepare the transcript
    clean_transcript = clean_transcript_text(transcript)
    
    # Construct prompt for the LLM
    prompt = create_mcq_prompt(clean_transcript, num_questions)
    
    try:
        # Debug: Print important info
        if DEBUG_MODE:
            print(f"===== MCQ GENERATION REQUEST =====")
            print(f"Using model: {model or DEFAULT_MODEL}")
            print(f"API URL: {OLLAMA_API_URL}")
            print(f"GPU enabled: {use_gpu and GPU_LAYERS > 0}")
            print(f"Prompt length: {len(prompt)} characters")
        
        # Prepare request parameters
        request_params = {
            "model": model or DEFAULT_MODEL,
            "prompt": prompt,
            "stream": False,
        }
        
        # Add GPU configuration if requested
        if use_gpu and GPU_LAYERS > 0:
            request_params["options"] = {
                "num_gpu": GPU_LAYERS  # Number of layers to put on the GPU
            }
            print(f"Using GPU acceleration with {GPU_LAYERS} layers")
        
        # Debug: Log request
        if DEBUG_MODE:
            print(f"Sending request to Ollama API at {OLLAMA_API_URL}")
            print(f"Request parameters: {json.dumps(request_params, indent=2)}")
        
        # Make request to Ollama API
        response = requests.post(
            OLLAMA_API_URL,
            json=request_params,
            timeout=60
        )
        
        # Debug: Print response status
        if DEBUG_MODE:
            print(f"Response status code: {response.status_code}")
        
        response.raise_for_status()
        
        # Extract the text response
        result = response.json()
        generated_text = result.get("response", "")
        
        # Debug: Log generated text
        if DEBUG_MODE:
            print(f"===== RECEIVED RESPONSE =====")
            print(f"Response length: {len(generated_text)} characters")
            print(f"First 200 chars: {generated_text[:200]}...")
        
        # Find and parse JSON in the response
        if DEBUG_MODE:
            print("Attempting to parse JSON from response...")
        
        # First try to parse questions directly from text format
        mcqs = parse_mcqs_from_text(generated_text)
        
        # If text parsing failed, try to find JSON
        if not mcqs:
            if DEBUG_MODE:
                print("No MCQs found with text parsing, trying JSON extraction...")
            
            # Try with different regex patterns to find JSON
            json_patterns = [
                r'\[\s*{.+}\s*\]',  # Standard JSON array pattern
                r'{.+}',               # Single JSON object
                r'\[\s*\{"question":.+\}\s*\]'  # Specific MCQ JSON pattern
            ]
            
            json_str = None
            for pattern in json_patterns:
                json_match = re.search(pattern, generated_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                    if DEBUG_MODE:
                        print(f"Found JSON match with pattern: {pattern}")
                        print(f"JSON string found: {json_str[:100]}...")
                    break
            
            if not json_str:
                # If no JSON found, try to fix common issues
                if DEBUG_MODE:
                    print("No JSON found, attempting to fix JSON syntax...")
                fixed_text = fix_json_syntax(generated_text)
                
                for pattern in json_patterns:
                    json_match = re.search(pattern, fixed_text, re.DOTALL)
                    if json_match:
                        json_str = json_match.group(0)
                        if DEBUG_MODE:
                            print(f"Found JSON match after fixing with pattern: {pattern}")
                        break
            
            if not json_str:
                # Last resort - try to manually parse the MCQs from text
                if DEBUG_MODE:
                    print("No JSON found, falling back to text parsing...")
                mcqs = parse_mcqs_from_text(generated_text)
                
                if not mcqs:
                    if DEBUG_MODE:
                        print("Generating fallback MCQs since no valid MCQs could be extracted")
                    return generate_fallback_mcqs(transcript, num_questions)
            else:
                # Try to parse the found JSON
                try:
                    # Make sure it's a list
                    if json_str.strip()[0] != '[':
                        json_str = f"[{json_str}]"
                    
                    mcqs = json.loads(json_str)
                    
                    # If we got a single object instead of a list, wrap it
                    if isinstance(mcqs, dict):
                        mcqs = [mcqs]
                        
                except json.JSONDecodeError as e:
                    if DEBUG_MODE:
                        print(f"JSON decode error: {str(e)}")
                        print(f"Problem JSON: {json_str}")
                    
                    # Try one more fix attempt
                    try:
                        fixed_json = json_str.replace("'\n", "\n")
                        fixed_json = fixed_json.replace("'", "\"")
                        mcqs = json.loads(fixed_json)
                        if isinstance(mcqs, dict):
                            mcqs = [mcqs]
                    except:
                        # Fall back to text parsing
                        mcqs = parse_mcqs_from_text(generated_text)
                        
                        if not mcqs:
                            if DEBUG_MODE:
                                print("Generating fallback MCQs since JSON parsing failed")
                            return generate_fallback_mcqs(transcript, num_questions)
        
        # Validate the MCQs
        validated_mcqs = []
        for mcq in mcqs:
            if validate_mcq(mcq):
                validated_mcqs.append(mcq)
                if len(validated_mcqs) >= num_questions:
                    break
                    
        if not validated_mcqs:
            raise ValueError("No valid MCQs could be extracted from the response")
            
        return validated_mcqs
        
    except requests.RequestException as e:
        raise ConnectionError(f"Error connecting to Ollama API: {str(e)}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in model response: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"Error generating MCQs: {str(e)}")

def clean_transcript_text(transcript: str) -> str:
    """Clean and normalize transcript text."""
    # Remove timestamps or other non-text elements
    cleaned = re.sub(r'\[\d+:\d+\]|\(\d+:\d+\)', '', transcript)
    
    # Remove multiple spaces, newlines, etc.
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    
    # Additional custom cleaning can be added here
    
    return cleaned

def create_mcq_prompt(transcript: str, num_questions: int) -> str:
    """Create a prompt for the LLM to generate MCQs."""
    return f"""As an educational assessment expert, create {num_questions} multiple-choice questions based on the following transcript.
Each question should have 4 options with exactly one correct answer.

Format your response as follows for each question:
Q: [Question text]
A: [Option A]
B: [Option B]
C: [Option C]
D: [Option D]
Correct: [Letter of correct option]

Here is the transcript:
"{transcript}"

Generate questions that test understanding of key concepts, facts, and relationships presented in the transcript.
Questions should be diverse in difficulty and topic coverage.
Do not include explanations. Only include questions, options, and correct answers in the format specified.
"""

def parse_mcqs_from_text(text: str) -> List[Dict[str, Any]]:
    """Parse generated text into structured MCQs."""
    mcqs = []
    
    # Extract questions using regex
    question_blocks = re.findall(
        r'Q:(.+?)(?:\n|\r\n)A:(.+?)(?:\n|\r\n)B:(.+?)(?:\n|\r\n)C:(.+?)(?:\n|\r\n)D:(.+?)(?:\n|\r\n)Correct:(.+?)(?:\n|\r\n|$)',
        text,
        re.DOTALL
    )
    
    if not question_blocks:
        # Try alternative format
        question_blocks = re.findall(
            r'Question:(.+?)(?:\n|\r\n)A[).](.+?)(?:\n|\r\n)B[).](.+?)(?:\n|\r\n)C[).](.+?)(?:\n|\r\n)D[).](.+?)(?:\n|\r\n)(?:Correct Answer:|Answer:)(.+?)(?:\n|\r\n|$)',
            text,
            re.DOTALL
        )
    
    for block in question_blocks:
        question = block[0].strip()
        options = [opt.strip() for opt in block[1:5]]
        correct_answer = block[5].strip().upper()
        
        # Map the letter to index (0-based)
        correct_map = {"A": 0, "B": 1, "C": 2, "D": 3}
        correct_index = correct_map.get(correct_answer, 0)
        
        mcqs.append({
            "question": question,
            "options": options,
            "correct": correct_index
        })
    
    return mcqs

def validate_mcq(mcq: Dict[str, Any]) -> bool:
    """Validate that an MCQ has the required fields and structure."""
    if not isinstance(mcq, dict):
        return False
    
    if "question" not in mcq or "options" not in mcq or "correct" not in mcq:
        return False
    
    if not isinstance(mcq["question"], str) or len(mcq["question"].strip()) < 5:
        return False
    
    if not isinstance(mcq["options"], list) or len(mcq["options"]) != 4:
        return False
    
    if not all(isinstance(opt, str) and len(opt.strip()) > 0 for opt in mcq["options"]):
        return False
    
    if not isinstance(mcq["correct"], int) or mcq["correct"] < 0 or mcq["correct"] >= len(mcq["options"]):
        return False
    
    return True

def generate_fallback_mcqs(transcript: str, num_questions: int) -> List[Dict[str, Any]]:
    """Generate simple fallback MCQs when LLM generation fails."""
    # Extract sentences to create basic questions
    sentences = re.split(r'[.!?]\s+', transcript)
    sentences = [s for s in sentences if len(s.split()) > 5]
    
    mcqs = []
    
    # Create simple "What was mentioned in the transcript?" questions
    for i in range(min(num_questions, len(sentences))):
        sentence = sentences[i].strip()
        words = sentence.split()
        if len(words) < 5:
            continue
            
        # Find a key noun or concept
        key_word = random.choice(words[1:])
        
        # Create question
        question = f"According to the transcript, which of the following statements is true about {key_word}?"
        
        # Create one correct option based on the actual sentence
        correct_option = sentence
        
        # Create three incorrect options
        incorrect_options = []
        for _ in range(3):
            if len(sentences) > 5:
                other_sentence = random.choice([s for s in sentences if s != sentence])
                incorrect_options.append(other_sentence)
            else:
                # Create fabricated wrong answers
                incorrect_options.append(f"The transcript did not mention {key_word}.")
        
        # Randomize option order
        options = [correct_option] + incorrect_options
        random.shuffle(options)
        
        # Find the index of the correct option
        correct_index = options.index(correct_option)
        
        mcqs.append({
            "question": question,
            "options": options,
            "correct": correct_index
        })
    
    return mcqs[:num_questions]

def fix_json_syntax(text: str) -> str:
    """Attempt to fix common JSON syntax errors in the model output"""
    # Replace single quotes with double quotes
    text = re.sub(r"'([^']*)'", r'"\1"', text)
    
    # Fix missing commas between objects
    text = re.sub(r'}\s*{', '}, {', text)
    
    # Remove trailing commas in arrays
    text = re.sub(r',\s*]', ']', text)
    
    # Add brackets if missing
    if not text.strip().startswith('['):
        text = '[' + text
    if not text.strip().endswith(']'):
        text = text + ']'
        
    return text

if __name__ == "__main__":
    # Test with a sample transcript
    sample_transcript = """
    The cell membrane is a biological membrane that separates the interior of a cell from 
    its outer environment. It consists of a lipid bilayer with embedded proteins. 
    The cell membrane controls the movement of substances in and out of cells and organelles.
    It is selectively permeable to ions and organic molecules and regulates the movement 
    of substances in and out of cells.
    """
    
    # Check CUDA availability and print info
    devices = get_available_devices()
    if devices["success"]:
        if devices["cuda_available"]:
            print("CUDA is available for acceleration!")
            print(f"System info: {devices['device_name']}")
        else:
            print("CUDA is not available. Using CPU only.")
    else:
        print(f"Error checking devices: {devices['error']}")
    
    mcqs = generate_mcqs(sample_transcript, 2)
    print(json.dumps(mcqs, indent=2))

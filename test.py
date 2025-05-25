import torch
import requests
import sys

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

user_prompt = input("Enter your prompt: ")

with requests.post(
    'http://localhost:11434/api/generate',
    json={
        'model': 'gemma3:4b',
        'prompt': user_prompt,
        'stream': True
    },
    stream=True
) as response:
    for line in response.iter_lines():
        if line:
            # Each line is a JSON object
            data = line.decode('utf-8')
            try:
                import json
                chunk = json.loads(data)
                # Print the chunk of response as it arrives
                sys.stdout.write(chunk.get('response', ''))
                sys.stdout.flush()
            except Exception as e:
                pass  # Ignore malformed lines
print()  # For a newline after completion
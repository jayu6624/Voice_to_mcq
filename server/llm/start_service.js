const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

/**
 * Check if the Ollama server is running
 * @returns {Promise<boolean>} True if Ollama is running
 */
function checkOllamaServerStatus() {
  return new Promise((resolve) => {
    http.get('http://localhost:11434/api/version', (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Ollama server is running');
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const version = JSON.parse(data);
            console.log(`Ollama version: ${version.version}`);
          } catch (e) {
            console.log('Could not parse version information');
          }
          resolve(true);
        });
      } else {
        console.error(`❌ Ollama server responded with status: ${res.statusCode}`);
        resolve(false);
      }
    }).on('error', (err) => {
      console.error(`❌ Ollama server check failed: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * Check if the model is available in Ollama
 * @param {string} modelName - Name of the model to check
 * @returns {Promise<boolean>} True if model is available
 */
async function checkOllamaModelAvailability(modelName) {
  return new Promise((resolve) => {
    http.get('http://localhost:11434/api/tags', (res) => {
      if (res.statusCode === 200) {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const models = JSON.parse(data);
            const modelExists = models.models && models.models.some(m => m.name === modelName);
            
            if (modelExists) {
              console.log(`✅ Model ${modelName} is available in Ollama`);
              resolve(true);
            } else {
              console.error(`❌ Model ${modelName} is NOT available in Ollama`);
              console.log('Available models:', models.models ? models.models.map(m => m.name).join(', ') : 'none');
              resolve(false);
            }
          } catch (e) {
            console.error(`Error parsing Ollama models: ${e.message}`);
            resolve(false);
          }
        });
      } else {
        console.error(`Ollama /api/tags responded with status: ${res.statusCode}`);
        resolve(false);
      }
    }).on('error', (err) => {
      console.error(`Ollama model check failed: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * Starts the LLM service after verifying Ollama status
 */
async function startLlmService() {
  // Check if Ollama is running
  const ollamaRunning = await checkOllamaServerStatus();
  if (!ollamaRunning) {
    console.error('WARNING: Ollama server is not running or not accessible!');
    console.log('Attempting to continue, but MCQ generation may fail...');
  }
  
  // Check model availability
  const defaultModel = process.env.OLLAMA_MODEL || 'gemma3:4b';
  const modelAvailable = await checkOllamaModelAvailability(defaultModel);
  if (!modelAvailable) {
    console.error(`WARNING: Model ${defaultModel} is not available in Ollama!`);
    console.log('MCQ generation will fail until the model is available.');
    console.log(`You can pull the model using: ollama pull ${defaultModel}`);
  }
  
  // Path to the API service
  const apiServicePath = path.join(__dirname, 'api_service.py');
  
  console.log(`Starting LLM service from: ${apiServicePath}`);
  
  // Check if the file exists
  if (!fs.existsSync(apiServicePath)) {
    console.error(`LLM service file not found at: ${apiServicePath}`);
    throw new Error('LLM service file not found');
  }

  // Set environment variables for debugging
  const enhancedEnv = {
    ...process.env,
    PYTHONIOENCODING: 'utf-8',      // Ensure Python can handle Unicode
    PYTHONUNBUFFERED: '1',          // Make Python output unbuffered
    DEBUG_MODE: '1',                // Enable debug mode
    OLLAMA_MODEL: defaultModel      // Set the model name
  };

  // Start Python process with improved environment
  const llmProcess = spawn('python', [apiServicePath], {
    env: enhancedEnv,
    stdio: 'pipe'
  });
  
  // Handle process output
  llmProcess.stdout.on('data', (data) => {
    console.log(`LLM service: ${data.toString().trim()}`);
  });
  
  llmProcess.stderr.on('data', (data) => {
    console.error(`LLM service error: ${data.toString().trim()}`);
  });
  
  llmProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`LLM service process exited with code ${code}`);
      console.error('This will cause MCQ generation to fail. Check the logs for errors.');
    } else {
      console.log(`LLM service process stopped cleanly`);
    }
  });
  
  llmProcess.on('error', (err) => {
    console.error(`Failed to start LLM service: ${err.message}`);
    console.error('This will cause MCQ generation to fail. Check Python installation and dependencies.');
  });
  
  return llmProcess;
}

module.exports = { startLlmService };

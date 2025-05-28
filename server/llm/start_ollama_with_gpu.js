const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Script to ensure Ollama is running with GPU acceleration
 */

// Check if Ollama is installed and running
function checkOllamaStatus() {
  return new Promise((resolve, reject) => {
    console.log('Checking Ollama status...');
    
    const isWindows = process.platform === 'win32';
    const checkCmd = isWindows 
      ? 'powershell -Command "Get-Process ollama -ErrorAction SilentlyContinue"'
      : 'pgrep ollama';
    
    exec(checkCmd, (error, stdout, stderr) => {
      if (error) {
        console.log('⚠️ Ollama is not running');
        resolve({ running: false });
        return;
      }
      
      // Ollama is running, check if model is pulled
      const checkModelCmd = isWindows
        ? 'ollama list'
        : 'ollama list';
        
      exec(checkModelCmd, (err, modelOut, modelErr) => {
        if (err) {
          console.error('Error checking Ollama models:', err);
          resolve({ running: true, modelsAvailable: false });
          return;
        }
        
        const hasGemma = modelOut.toLowerCase().includes('gemma3:4b');
        resolve({ 
          running: true, 
          modelsAvailable: true,
          hasGemma
        });
      });
    });
  });
}

// Check if CUDA is available
function checkCUDAAvailable() {
  return new Promise((resolve, reject) => {
    console.log('Checking CUDA availability...');
    
    // Try to query Ollama API
    const http = require('http');
    
    const req = http.get('http://localhost:11434/api/info', res => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          const cudaAvailable = info.system && 
                               info.system.devices && 
                               info.system.devices.includes('cuda');
          
          console.log(cudaAvailable 
            ? '✅ CUDA is available' 
            : '⚠️ CUDA is not available');
            
          resolve({ 
            available: cudaAvailable,
            system: info.system || {}
          });
        } catch (e) {
          console.error('Error parsing Ollama response:', e);
          resolve({ available: false });
        }
      });
    });
    
    req.on('error', error => {
      console.error('Error checking Ollama API:', error.message);
      resolve({ available: false });
    });
    
    req.setTimeout(5000, () => {
      req.abort();
      console.error('Timeout checking Ollama API');
      resolve({ available: false });
    });
    
    req.end();
  });
}

// Start Ollama if not running
function startOllama() {
  return new Promise((resolve, reject) => {
    console.log('Starting Ollama...');
    
    const isWindows = process.platform === 'win32';
    const ollamaCmd = isWindows ? 'ollama.exe' : 'ollama';
    
    const ollamaProcess = spawn(ollamaCmd, ['serve'], {
      detached: true,
      stdio: 'ignore'
    });
    
    ollamaProcess.unref();
    
    // Give it a moment to start
    setTimeout(() => {
      resolve();
    }, 5000);
  });
}

// Pull necessary model if not available
function pullModel() {
  return new Promise((resolve, reject) => {
    console.log('Pulling Gemma 3 4B model...');
    
    const modelPull = spawn('ollama', ['pull', 'gemma3:4b']);
    
    modelPull.stdout.on('data', data => {
      console.log(`Model pull: ${data.toString().trim()}`);
    });
    
    modelPull.stderr.on('data', data => {
      console.error(`Model pull error: ${data.toString().trim()}`);
    });
    
    modelPull.on('close', code => {
      if (code === 0) {
        console.log('✅ Model gemma3:4b pulled successfully');
        resolve(true);
      } else {
        console.error(`⚠️ Model pull failed with code ${code}`);
        resolve(false);
      }
    });
  });
}

// Main function
async function main() {
  console.log('=== Ollama GPU Setup ===');
  
  // Check if Ollama is running
  const ollamaStatus = await checkOllamaStatus();
  
  // Start Ollama if not running
  if (!ollamaStatus.running) {
    await startOllama();
  }
  
  // Check CUDA availability (wait for Ollama to start first)
  const cudaStatus = await checkCUDAAvailable();
  
  if (!cudaStatus.available) {
    console.log('⚠️ CUDA not available. The service will run on CPU only.');
    console.log('To enable GPU acceleration:');
    console.log('1. Ensure you have a compatible NVIDIA GPU');
    console.log('2. Install NVIDIA drivers and CUDA toolkit');
    console.log('3. Restart Ollama');
  } else {
    console.log('✅ CUDA is available for acceleration!');
  }
  
  // Check if model is available
  if (!ollamaStatus.hasGemma) {
    console.log('⚠️ Gemma 3 4B model not found');
    const modelPulled = await pullModel();
  }
  
  console.log('Setup complete!');
}

// Run the main function
main().catch(err => {
  console.error('Error in Ollama GPU setup:', err);
});

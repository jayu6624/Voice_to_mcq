const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Setup script for LLM integration.
 * This will:
 * 1. Create a Python virtual environment
 * 2. Install required packages
 * 3. Check for Ollama installation and model availability
 */

const venvPath = path.join(__dirname, 'venv');
const requirementsPath = path.join(__dirname, 'requirements.txt');

// Create requirements.txt if it doesn't exist
if (!fs.existsSync(requirementsPath)) {
  fs.writeFileSync(requirementsPath, 
`fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.4.2
requests==2.31.0
python-dotenv==1.0.0
`);
}

// Determine platform-specific commands
const isWindows = process.platform === 'win32';
const pythonCmd = isWindows ? 'python' : 'python3';
const venvActivate = isWindows 
  ? path.join(venvPath, 'Scripts', 'activate')
  : path.join(venvPath, 'bin', 'activate');

// Create the virtual environment
console.log('Creating Python virtual environment...');
const createVenv = spawn(pythonCmd, ['-m', 'venv', venvPath]);

createVenv.stdout.on('data', data => console.log(data.toString()));
createVenv.stderr.on('data', data => console.error(data.toString()));

createVenv.on('close', code => {
  if (code !== 0) {
    console.error(`Failed to create virtual environment (exit code ${code})`);
    return;
  }
  
  console.log('Virtual environment created successfully');
  installDependencies();
});

function installDependencies() {
  console.log('Installing dependencies...');
  
  // In Windows we need to use pip directly from venv
  const pipPath = isWindows 
    ? path.join(venvPath, 'Scripts', 'pip') 
    : 'pip';
  
  // Use the appropriate pip and install requirements
  const installDeps = spawn(
    isWindows ? pipPath : pythonCmd, 
    isWindows ? ['install', '-r', requirementsPath] : ['-m', 'pip', 'install', '-r', requirementsPath],
    { shell: isWindows }
  );
  
  installDeps.stdout.on('data', data => console.log(data.toString()));
  installDeps.stderr.on('data', data => console.error(data.toString()));
  
  installDeps.on('close', code => {
    if (code !== 0) {
      console.error(`Failed to install dependencies (exit code ${code})`);
      return;
    }
    
    console.log('Dependencies installed successfully');
    checkOllama();
  });
}

function checkOllama() {
  console.log('Checking for Ollama installation...');
  
  // Try to reach the Ollama API
  const http = require('http');
  
  const req = http.get('http://localhost:11434/api/tags', res => {
    let data = '';
    
    res.on('data', chunk => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const models = JSON.parse(data);
        console.log('Ollama is running. Available models:');
        
        // Check if gemma3:4b is available
        const hasGemma = models.models && models.models.some(model => model.name === 'gemma3:4b');
        
        if (hasGemma) {
          console.log('✅ gemma3:4b model is available');
        } else {
          console.log('❌ gemma3:4b model is NOT available');
          console.log('Please install it by running: ollama pull gemma3:4b');
        }
      } catch (e) {
        console.error('Error parsing Ollama response:', e);
      }
    });
  });
  
  req.on('error', error => {
    console.error('❌ Ollama does not appear to be running:', error.message);
    console.log(`
To use the MCQ generation feature, please install Ollama:
1. Visit https://ollama.com/download and install Ollama
2. Run: ollama pull gemma3:4b
3. Ensure Ollama is running
    `);
  });
  
  req.end();
}

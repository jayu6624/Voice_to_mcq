import React, { useState } from 'react';
import { Save } from 'lucide-react';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState({
    llmEndpoint: 'http://localhost:5001',
    modelName: 'gemma3:4b',
    questionCount: 5,
    darkMode: false
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Save settings to local storage
    localStorage.setItem('voice_to_mcq_settings', JSON.stringify(settings));
    alert('Settings saved successfully');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <p className="text-gray-500">Configure application preferences</p>

      <div className="bg-white rounded-xl shadow border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-medium text-gray-900">Application Settings</h2>
        </div>
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="llmEndpoint" className="block text-sm font-medium text-gray-700 mb-1">
                LLM Service Endpoint
              </label>
              <input
                type="text"
                id="llmEndpoint"
                name="llmEndpoint"
                value={settings.llmEndpoint}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="mt-1 text-xs text-gray-500">URL of the LLM service for MCQ generation</p>
            </div>

            <div>
              <label htmlFor="modelName" className="block text-sm font-medium text-gray-700 mb-1">
                Model Name
              </label>
              <input
                type="text"
                id="modelName"
                name="modelName"
                value={settings.modelName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="mt-1 text-xs text-gray-500">Name of the Ollama model to use</p>
            </div>

            <div>
              <label htmlFor="questionCount" className="block text-sm font-medium text-gray-700 mb-1">
                Default Questions per Segment
              </label>
              <input
                type="number"
                id="questionCount"
                name="questionCount"
                min="1"
                max="20"
                value={settings.questionCount}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="darkMode"
                name="darkMode"
                checked={settings.darkMode}
                onChange={handleChange}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <label htmlFor="darkMode" className="ml-2 block text-sm text-gray-700">
                Dark Mode (Requires Page Reload)
              </label>
            </div>

            <div>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;

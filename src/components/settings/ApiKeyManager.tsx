import React, { useState, useEffect } from 'react';
import { z } from 'zod';

// API Key validation schema
const ApiKeySchema = z.object({
  openrouter: z.string().regex(/^[A-Za-z0-9_-]{10,}$/, 'Invalid OpenRouter API key format'),
  deepseek: z.string().regex(/^[A-Za-z0-9_-]{10,}$/, 'Invalid DeepSeek API key format'),
  gemini: z.string().regex(/^[A-Za-z0-9_-]{39}$/, 'Invalid Gemini API key format').optional(),
  serpapi: z.string().regex(/^[A-Za-z0-9]{32}$/, 'Invalid SerpAPI key format').optional(),
});

type ApiKeys = z.infer<typeof ApiKeySchema>;

interface Props {
  onSave: (keys: ApiKeys) => void;
  onClose: () => void;
}

export const ApiKeyManager: React.FC<Props> = ({ onSave, onClose }) => {
  const [keys, setKeys] = useState<ApiKeys>({
    openrouter: '',
    deepseek: '',
    gemini: '',
    serpapi: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ApiKeys, string>>>({});
  const [isEditing, setIsEditing] = useState<Partial<Record<keyof ApiKeys, boolean>>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load saved keys
    const savedKeys = localStorage.getItem('api_keys');
    if (savedKeys) {
      try {
        const parsed = JSON.parse(savedKeys);
        setKeys(parsed);
      } catch (error) {
        console.error('Failed to load API keys:', error);
      }
    }
  }, []);

  const validateKey = (key: string, type: keyof ApiKeys) => {
    try {
      const schema = ApiKeySchema.shape[type];
      schema.parse(key);
      setErrors(prev => ({ ...prev, [type]: undefined }));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({ ...prev, [type]: error.errors[0].message }));
      }
      return false;
    }
  };

  const handleChange = (type: keyof ApiKeys, value: string) => {
    setKeys(prev => ({ ...prev, [type]: value }));
    validateKey(value, type);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validate all keys
      const validationResult = ApiKeySchema.safeParse(keys);
      if (!validationResult.success) {
        const newErrors: Partial<Record<keyof ApiKeys, string>> = {};
        validationResult.error.errors.forEach(error => {
          const path = error.path[0] as keyof ApiKeys;
          newErrors[path] = error.message;
        });
        setErrors(newErrors);
        return;
      }

      // Save to local storage (encrypted in a real app)
      localStorage.setItem('api_keys', JSON.stringify(keys));
      
      // Notify parent
      onSave(keys);
      
      // Reset editing state
      setIsEditing({});
    } catch (error) {
      console.error('Failed to save API keys:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEdit = (type: keyof ApiKeys) => {
    setIsEditing(prev => ({ ...prev, [type]: !prev[type] }));
  };

  return (
    <div className="api-key-manager p-4 bg-gray-800 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white">API Keys</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(keys).map(([type, value]) => (
          <div key={type} className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              {type.charAt(0).toUpperCase() + type.slice(1)} API Key
            </label>
            
            <div className="flex space-x-2">
              <input
                type={isEditing[type as keyof ApiKeys] ? "text" : "password"}
                value={value}
                onChange={(e) => handleChange(type as keyof ApiKeys, e.target.value)}
                className={`flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors[type as keyof ApiKeys] ? 'border-red-500' : 'border-gray-600'
                }`}
                placeholder={`Enter ${type} API key`}
              />
              
              <button
                onClick={() => toggleEdit(type as keyof ApiKeys)}
                className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
              >
                {isEditing[type as keyof ApiKeys] ? '•••' : '👁'}
              </button>
            </div>

            {errors[type as keyof ApiKeys] && (
              <p className="text-sm text-red-500">
                {errors[type as keyof ApiKeys]}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end space-x-4">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          disabled={isSaving}
        >
          Cancel
        </button>
        
        <button
          onClick={handleSave}
          disabled={isSaving || Object.keys(errors).length > 0}
          className={`px-4 py-2 rounded-lg ${
            isSaving || Object.keys(errors).length > 0
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-500'
          }`}
        >
          {isSaving ? 'Saving...' : 'Save Keys'}
        </button>
      </div>
    </div>
  );
}; 
// Environment configuration with validation
export const CONFIG = {
  OPENROUTER_API_KEY: import.meta.env.VITE_OPENROUTER_API_KEY,
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  ENV: import.meta.env.MODE
} as const;

// Validate required environment variables
export const validateConfig = () => {
  const required = ['OPENROUTER_API_KEY'] as const;
  const missing = required.filter(key => !CONFIG[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }
  
  return CONFIG;
};

// Initialize config validation
validateConfig(); 
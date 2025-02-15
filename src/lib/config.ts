import { z } from 'zod';

const envSchema = z.object({
  API_BASE_URL: z.string().default('http://localhost:8080'),
  DEEPSEEK_API_KEY: z.string(),
  ELEVENLABS_API_KEY: z.string(),
  GEMINI_API_KEY: z.string(),
  SERPAPI_API_KEY: z.string(),
  JINA_API_KEY: z.string(),
  OPENROUTER_API_KEY: z.string(),
  MAX_FILE_SIZE: z.number().default(10485760),
  ALLOWED_FILE_TYPES: z.string().default('.pdf,.doc,.docx,.jpg,.jpeg,.png,.dcm,.nii'),
  DEEPSEEK_API_ENDPOINT: z.string().default('https://api.deepseek.com/v1/chat/completions'),
});

// Type for our config
export type Config = z.infer<typeof envSchema>;

// Updated getEnvVar function for Vite environments
const getEnvVar = (key: string): string => {
  const value = import.meta.env[`VITE_${key}`];
  if (!value && import.meta.env.PROD) { // Use Vite's built-in PROD check
    throw new Error(`Missing environment variable: VITE_${key}`);
  }
  return value || '';
};

// Parse and validate environment variables
export const config = envSchema.parse({
  API_BASE_URL: getEnvVar('API_BASE_URL'),
  DEEPSEEK_API_KEY: getEnvVar('DEEPSEEK_API_KEY'),
  ELEVENLABS_API_KEY: getEnvVar('ELEVENLABS_API_KEY'),
  GEMINI_API_KEY: getEnvVar('GEMINI_API_KEY'),
  SERPAPI_API_KEY: getEnvVar('SERPAPI_API_KEY'),
  JINA_API_KEY: getEnvVar('JINA_API_KEY'),
  OPENROUTER_API_KEY: getEnvVar('OPENROUTER_API_KEY'),
  MAX_FILE_SIZE: parseInt(getEnvVar('MAX_FILE_SIZE')),
  ALLOWED_FILE_TYPES: getEnvVar('ALLOWED_FILE_TYPES'),
  DEEPSEEK_API_ENDPOINT: getEnvVar('DEEPSEEK_API_ENDPOINT'),
});

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
import express from 'express';
import type { Request, Response, Router, RequestHandler } from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const router: Router = express.Router();

// Enable CORS for the frontend
router.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Title', 'OpenAI-Organization']
}));

interface SerpApiResponse {
  organic_results: Array<{
    link: string;
    snippet?: string;
    title?: string;
  }>;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// SerpAPI proxy
const serpApiHandler: RequestHandler = async (req, res, next) => {
  try {
    const { q } = req.query;
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    
    if (!apiKey || typeof q !== 'string') {
      res.status(401).json({ error: 'API key and query are required' });
      return;
    }

    console.log('Making SerpAPI request for query:', q);
    
    const response = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&api_key=${apiKey}&engine=google`,
      { 
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('SerpAPI error:', response.status, text);
      res.status(response.status).json({ error: `SerpAPI error: ${response.status} ${response.statusText}` });
      return;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      const text = await response.text();
      console.error('Unexpected response type:', contentType, 'Response:', text);
      res.status(500).json({ error: 'Invalid response format from SerpAPI' });
      return;
    }

    const rawData = await response.text();
    console.log('Raw SerpAPI response:', rawData);
    
    let data;
    try {
      data = JSON.parse(rawData);
    } catch (e) {
      console.error('Failed to parse SerpAPI response:', e);
      res.status(500).json({ error: 'Invalid JSON response from SerpAPI' });
      return;
    }

    if (!data.organic_results || !Array.isArray(data.organic_results)) {
      console.error('Unexpected SerpAPI response structure:', data);
      res.status(500).json({ error: 'Invalid response structure from SerpAPI' });
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('SerpAPI proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch from SerpAPI' });
  }
};

// OpenRouter proxy
const openRouterHandler: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({ error: 'Authorization header is required' });
      return;
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'X-Title': 'Deep Researcher',
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('OpenRouter error:', response.status, text);
      res.status(response.status).json({ error: `OpenRouter error: ${response.status} ${response.statusText}` });
      return;
    }

    const data = await response.json() as OpenRouterResponse;
    res.json(data);
  } catch (error) {
    console.error('OpenRouter proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch from OpenRouter' });
  }
};

// Jina proxy
const jinaHandler: RequestHandler = async (req, res, next) => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    const url = req.params[0];
    
    if (!apiKey) {
      res.status(401).json({ error: 'API key is required' });
      return;
    }

    const response = await fetch(`https://r.jina.ai/${url}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Jina error:', response.status, text);
      res.status(response.status).json({ error: `Jina error: ${response.status} ${response.statusText}` });
      return;
    }

    const data = await response.text();
    res.send(data);
  } catch (error) {
    console.error('Jina proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch from Jina' });
  }
};

// Gemini proxy
const geminiHandler: RequestHandler = async (req, res, next) => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    
    if (!apiKey) {
      res.status(401).json({ error: 'API key is required' });
      return;
    }

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(req.body)
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('Gemini error:', response.status, text);
      res.status(response.status).json({ error: `Gemini error: ${response.status} ${response.statusText}` });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Gemini proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch from Gemini' });
  }
};

router.get('/serpapi', serpApiHandler);
router.post('/openrouter', openRouterHandler);
router.get('/jina/*', jinaHandler);
router.post('/gemini', geminiHandler);

export default router; 
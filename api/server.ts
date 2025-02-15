import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './endpoints.js';
import os from 'os';
import rateLimit from 'express-rate-limit';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 8081;

// Active connections tracking
const activeConnections = new Map();

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Connection tracking middleware
const trackConnections = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const clientId = req.headers['x-client-id'] || Date.now().toString();
  activeConnections.set(clientId, {
    timestamp: Date.now(),
    ip: req.ip,
    path: req.path
  });

  res.on('finish', () => {
    activeConnections.delete(clientId);
  });

  next();
};

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGIN 
    : 'http://localhost:8080', // Specific origin instead of wildcard
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // Cache preflight requests for 24 hours
}));

// Options preflight handler
app.options('*', cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGIN 
    : 'http://localhost:8080',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(limiter);
app.use(trackConnections);

// Increase JSON payload limit to 50mb
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api', router);

// Enhanced health check endpoint
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  const systemInfo = {
    platform: process.platform,
    nodeVersion: process.version,
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    activeConnections: activeConnections.size
  };

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: uptime,
      formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
    },
    memory: {
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memory.rss / 1024 / 1024) + 'MB'
    },
    system: systemInfo,
    env: process.env.NODE_ENV
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`API base URL: ${process.env.VITE_API_BASE_URL}`);
  console.log('Environment:', process.env.NODE_ENV);
  
  // Log initial system state
  const memory = process.memoryUsage();
  console.log('Initial system state:', {
    memory: {
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memory.rss / 1024 / 1024) + 'MB'
    },
    cpus: os.cpus().length,
    platform: process.platform,
    nodeVersion: process.version
  });
}); 
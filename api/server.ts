import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import proxy from './proxy.ts';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true
}));

// Routes
app.use('/api/proxy', proxy);

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
}); 
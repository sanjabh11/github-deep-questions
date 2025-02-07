import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// Custom error types
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Error tracking for monitoring
const errorTracker = new Map<string, {
  count: number;
  lastOccurrence: number;
  samples: Array<{
    message: string;
    timestamp: number;
    details?: any;
  }>;
}>();

const MAX_SAMPLES = 10;
const ERROR_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Track error occurrence
function trackError(error: Error, details?: any) {
  const errorKey = `${error.name}:${error.message}`;
  const now = Date.now();
  
  const existing = errorTracker.get(errorKey) || {
    count: 0,
    lastOccurrence: now,
    samples: []
  };

  existing.count++;
  existing.lastOccurrence = now;
  
  if (existing.samples.length < MAX_SAMPLES) {
    existing.samples.push({
      message: error.message,
      timestamp: now,
      details
    });
  }

  errorTracker.set(errorKey, existing);
}

// Clean up old error tracking data
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of errorTracker.entries()) {
    if (now - value.lastOccurrence > ERROR_TTL) {
      errorTracker.delete(key);
    }
  }
}, ERROR_TTL);

// Format error response based on error type
function formatErrorResponse(error: any) {
  if (error instanceof ApiError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        details: error.details
      },
      statusCode: error.statusCode
    };
  }

  if (error instanceof ValidationError) {
    return {
      success: false,
      error: {
        message: error.message,
        details: error.details
      },
      statusCode: 400
    };
  }

  if (error instanceof ZodError) {
    return {
      success: false,
      error: {
        message: 'Validation failed',
        details: error.errors
      },
      statusCode: 400
    };
  }

  // Default error response
  return {
    success: false,
    error: {
      message: error.message || 'Internal server error',
      code: 'INTERNAL_ERROR'
    },
    statusCode: 500
  };
}

// Main error handler middleware
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Track the error
  trackError(error, {
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body
  });

  // Format the error response
  const errorResponse = formatErrorResponse(error);

  // Log error details for monitoring
  console.error('Error occurred:', {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      details: errorResponse.error.details
    }
  });

  // Send response
  res.status(errorResponse.statusCode).json({
    success: false,
    error: errorResponse.error
  });
};

// Error monitoring endpoint (protected, admin-only)
export const getErrorStats = (req: Request, res: Response) => {
  const stats = Array.from(errorTracker.entries()).map(([key, data]) => ({
    key,
    count: data.count,
    lastOccurrence: new Date(data.lastOccurrence).toISOString(),
    samples: data.samples.map(sample => ({
      ...sample,
      timestamp: new Date(sample.timestamp).toISOString()
    }))
  }));

  res.json({
    success: true,
    data: {
      totalErrors: stats.reduce((acc, curr) => acc + curr.count, 0),
      errorTypes: stats.length,
      details: stats
    }
  });
}; 
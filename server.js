require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const BitcoinDataService = require('./services/bitcoinDataService');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Bitcoin data service
const bitcoinService = new BitcoinDataService();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Cache for API responses (5 minute cache)
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedData(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

// API Routes

// Get comprehensive mining summary
app.get('/api/mining-summary', async (req, res) => {
  try {
    const cacheKey = 'mining-summary';
    let data = getCachedData(cacheKey);
    
    if (!data) {
      data = await bitcoinService.getMiningSummary();
      setCachedData(cacheKey, data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching mining summary:', error);
    res.status(500).json({ 
      error: 'Failed to fetch mining summary',
      message: error.message 
    });
  }
});

// Get current Bitcoin statistics
app.get('/api/current-stats', async (req, res) => {
  try {
    const cacheKey = 'current-stats';
    let data = getCachedData(cacheKey);
    
    if (!data) {
      data = await bitcoinService.getCurrentStats();
      setCachedData(cacheKey, data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching current stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch current statistics',
      message: error.message 
    });
  }
});

// Get daily mining data
app.get('/api/daily-stats', async (req, res) => {
  try {
    const cacheKey = 'daily-stats';
    let data = getCachedData(cacheKey);
    
    if (!data) {
      data = await bitcoinService.getDailyMiningData();
      setCachedData(cacheKey, data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching daily stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch daily statistics',
      message: error.message 
    });
  }
});

// Get remaining Bitcoin information
app.get('/api/remaining', async (req, res) => {
  try {
    const cacheKey = 'remaining';
    let data = getCachedData(cacheKey);
    
    if (!data) {
      data = await bitcoinService.getRemainingBitcoin();
      setCachedData(cacheKey, data);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching remaining Bitcoin data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch remaining Bitcoin data',
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Bitcoin Mining Tracker API',
    version: '1.0.0',
    description: 'API for tracking Bitcoin mining statistics and remaining supply',
    endpoints: {
      'GET /api/mining-summary': 'Get comprehensive mining summary with all data',
      'GET /api/current-stats': 'Get current Bitcoin blockchain statistics',
      'GET /api/daily-stats': 'Get daily mining data for the last 24 hours',
      'GET /api/remaining': 'Get remaining Bitcoin supply information',
      'GET /api/health': 'Health check endpoint',
      'GET /api': 'This API documentation'
    },
    cache: 'All endpoints are cached for 5 minutes to reduce API load',
    dataSource: 'blockchain.info API'
  });
});

// Serve the main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: 'The requested resource was not found'
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Bitcoin Mining Tracker server is running on port ${port}`);
  console.log(`📊 Dashboard: http://localhost:${port}`);
  console.log(`🔌 API: http://localhost:${port}/api`);
  console.log(`🏥 Health: http://localhost:${port}/api/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

const axios = require('axios');

// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
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

class BitcoinDataService {
  constructor() {
    this.blockchainAPIBase = 'https://blockchain.info';
    this.TOTAL_BITCOIN_SUPPLY = 21000000;
    this.SATOSHIS_PER_BITCOIN = 100000000;
    this.BLOCKS_PER_DAY_AVERAGE = 144;
    this.currentBlockReward = 6.25;
  }

  async getCurrentStats() {
    try {
      const response = await axios.get(`${this.blockchainAPIBase}/q/getblockcount`);
      const currentBlockHeight = parseInt(response.data);
      
      const statsResponse = await axios.get(`${this.blockchainAPIBase}/stats?format=json`);
      const stats = statsResponse.data;
      
      const totalBitcoinMined = stats.totalbc / this.SATOSHIS_PER_BITCOIN;
      const remainingBitcoin = this.TOTAL_BITCOIN_SUPPLY - totalBitcoinMined;
      
      return {
        currentBlockHeight,
        totalBitcoinMined: Math.floor(totalBitcoinMined),
        remainingBitcoin: Math.floor(remainingBitcoin),
        percentageMined: ((totalBitcoinMined / this.TOTAL_BITCOIN_SUPPLY) * 100).toFixed(2),
        currentDifficulty: stats.difficulty,
        networkHashRate: stats.hash_rate,
        totalTransactions: stats.n_tx,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching current stats:', error);
      throw new Error('Failed to fetch current Bitcoin statistics');
    }
  }
}

const bitcoinService = new BitcoinDataService();

exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const cacheKey = 'current-stats';
    let data = getCachedData(cacheKey);
    
    if (!data) {
      data = await bitcoinService.getCurrentStats();
      setCachedData(cacheKey, data);
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Error in current-stats function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch current statistics' })
    };
  }
};
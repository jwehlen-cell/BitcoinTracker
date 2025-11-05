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

  async getMiningData() {
    try {
      const response = await axios.get(`${this.blockchainAPIBase}/stats?format=json`);
      const stats = response.data;
      
      const totalBitcoinMined = stats.totalbc / this.SATOSHIS_PER_BITCOIN;
      const remainingBitcoin = this.TOTAL_BITCOIN_SUPPLY - totalBitcoinMined;
      
      // Calculate daily mining rate (approximate)
      const dailyBlocks = this.BLOCKS_PER_DAY_AVERAGE;
      const dailyBitcoinMined = dailyBlocks * this.currentBlockReward;
      
      // Estimate days until all Bitcoin mined
      const daysUntilAllMined = remainingBitcoin / dailyBitcoinMined;
      
      return {
        totalBitcoinMined: Math.floor(totalBitcoinMined),
        remainingBitcoin: Math.floor(remainingBitcoin),
        dailyBitcoinMined: dailyBitcoinMined.toFixed(2),
        percentageMined: ((totalBitcoinMined / this.TOTAL_BITCOIN_SUPPLY) * 100).toFixed(2),
        estimatedDaysUntilAllMined: Math.floor(daysUntilAllMined),
        estimatedYearsUntilAllMined: (daysUntilAllMined / 365).toFixed(1),
        currentBlockReward: this.currentBlockReward,
        nextHalvingBlock: 840000, // Approximate next halving
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching mining data:', error);
      throw new Error('Failed to fetch mining data');
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
    const cacheKey = 'mining-summary';
    let data = getCachedData(cacheKey);
    
    if (!data) {
      data = await bitcoinService.getMiningData();
      setCachedData(cacheKey, data);
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Error in mining-summary function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch mining summary' })
    };
  }
};
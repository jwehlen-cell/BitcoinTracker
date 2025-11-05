const axios = require('axios');

class BitcoinDataService {
  constructor() {
    this.blockchainAPIBase = 'https://blockchain.info';
    this.coinAPIBase = 'https://api.coinapi.io/v1';
    
    // Bitcoin constants
    this.TOTAL_BITCOIN_SUPPLY = 21000000; // Total Bitcoin that will ever exist
    this.SATOSHIS_PER_BITCOIN = 100000000; // 100 million satoshis per Bitcoin
    this.BLOCKS_PER_DAY_AVERAGE = 144; // Approximately 1 block every 10 minutes
    
    // Current block reward (changes every 4 years due to halving)
    this.currentBlockReward = 6.25; // As of 2024, will be 3.125 after next halving
  }

  /**
   * Get current Bitcoin blockchain statistics
   */
  async getCurrentStats() {
    try {
      const response = await axios.get(`${this.blockchainAPIBase}/q/bcperblock`);
      const currentBlockReward = response.data / this.SATOSHIS_PER_BITCOIN;
      
      const stats = await axios.get(`${this.blockchainAPIBase}/stats?format=json`);
      
      return {
        currentBlockHeight: stats.data.n_blocks_total,
        totalBitcoinsInCirculation: stats.data.totalbc / this.SATOSHIS_PER_BITCOIN,
        currentBlockReward: currentBlockReward,
        difficulty: stats.data.difficulty,
        hashRate: stats.data.hash_rate,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching current stats:', error.message);
      throw new Error('Failed to fetch current Bitcoin statistics');
    }
  }

  /**
   * Get blocks mined in the last 24 hours
   */
  async getDailyMiningData() {
    try {
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const response = await axios.get(`${this.blockchainAPIBase}/blocks/${oneDayAgo}?format=json`);
      
      const blocks = response.data.blocks;
      const totalBlocks = blocks.length;
      const totalBitcoinMined = totalBlocks * this.currentBlockReward;
      
      return {
        date: new Date().toISOString().split('T')[0],
        blocksMinedLast24h: totalBlocks,
        bitcoinMinedLast24h: totalBitcoinMined,
        averageBlockTime: totalBlocks > 0 ? (24 * 60) / totalBlocks : 10, // minutes
        blocks: blocks.map(block => ({
          height: block.height,
          hash: block.hash,
          time: new Date(block.time * 1000).toISOString(),
          size: block.size,
          tx_count: block.n_tx
        }))
      };
    } catch (error) {
      console.error('Error fetching daily mining data:', error.message);
      // Fallback to estimated data if API fails
      return this.getEstimatedDailyData();
    }
  }

  /**
   * Fallback method to estimate daily mining data
   */
  getEstimatedDailyData() {
    const estimatedBlocks = this.BLOCKS_PER_DAY_AVERAGE;
    const estimatedBitcoin = estimatedBlocks * this.currentBlockReward;
    
    return {
      date: new Date().toISOString().split('T')[0],
      blocksMinedLast24h: estimatedBlocks,
      bitcoinMinedLast24h: estimatedBitcoin,
      averageBlockTime: 10,
      isEstimated: true,
      blocks: []
    };
  }

  /**
   * Calculate remaining Bitcoin to be mined
   */
  async getRemainingBitcoin() {
    try {
      const currentStats = await this.getCurrentStats();
      const remaining = this.TOTAL_BITCOIN_SUPPLY - currentStats.totalBitcoinsInCirculation;
      
      // Estimate when all Bitcoin will be mined (approximate)
      const blocksRemaining = remaining / this.currentBlockReward;
      const daysRemaining = blocksRemaining / this.BLOCKS_PER_DAY_AVERAGE;
      const estimatedCompletionDate = new Date();
      estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + daysRemaining);
      
      return {
        totalSupply: this.TOTAL_BITCOIN_SUPPLY,
        currentSupply: currentStats.totalBitcoinsInCirculation,
        remainingBitcoin: remaining,
        percentageMined: (currentStats.totalBitcoinsInCirculation / this.TOTAL_BITCOIN_SUPPLY) * 100,
        estimatedCompletionDate: estimatedCompletionDate.toISOString().split('T')[0],
        currentBlockReward: this.currentBlockReward,
        nextHalvingEstimate: this.getNextHalvingEstimate(currentStats.currentBlockHeight)
      };
    } catch (error) {
      console.error('Error calculating remaining Bitcoin:', error.message);
      throw new Error('Failed to calculate remaining Bitcoin');
    }
  }

  /**
   * Estimate next halving event
   */
  getNextHalvingEstimate(currentBlockHeight) {
    const HALVING_INTERVAL = 210000; // Blocks between halvings
    const nextHalvingBlock = Math.ceil(currentBlockHeight / HALVING_INTERVAL) * HALVING_INTERVAL;
    const blocksUntilHalving = nextHalvingBlock - currentBlockHeight;
    const daysUntilHalving = blocksUntilHalving / this.BLOCKS_PER_DAY_AVERAGE;
    
    const halvingDate = new Date();
    halvingDate.setDate(halvingDate.getDate() + daysUntilHalving);
    
    return {
      nextHalvingBlock,
      blocksUntilHalving,
      daysUntilHalving: Math.round(daysUntilHalving),
      estimatedDate: halvingDate.toISOString().split('T')[0],
      currentReward: this.currentBlockReward,
      nextReward: this.currentBlockReward / 2
    };
  }

  /**
   * Get comprehensive Bitcoin mining summary
   */
  async getMiningSummary() {
    try {
      const [currentStats, dailyData, remainingData] = await Promise.all([
        this.getCurrentStats(),
        this.getDailyMiningData(),
        this.getRemainingBitcoin()
      ]);

      return {
        timestamp: new Date().toISOString(),
        current: currentStats,
        daily: dailyData,
        remaining: remainingData,
        summary: {
          bitcoinMinedToday: dailyData.bitcoinMinedLast24h,
          bitcoinRemaining: remainingData.remainingBitcoin,
          percentageComplete: remainingData.percentageMined,
          estimatedDaysToCompletion: Math.round((remainingData.remainingBitcoin / this.currentBlockReward) / this.BLOCKS_PER_DAY_AVERAGE)
        }
      };
    } catch (error) {
      console.error('Error getting mining summary:', error.message);
      throw new Error('Failed to get mining summary');
    }
  }
}

module.exports = BitcoinDataService;
class BitcoinTracker {
    constructor() {
        this.apiBase = '/api';
        this.updateInterval = 5 * 60 * 1000; // 5 minutes
        this.chart = null;
        this.priceChart = null;
        this.lastUpdateTime = null;
        this.currentTheme = 'dark';
        this.selectedCurrency = 'USD';
        
        // API endpoints
        this.blockchainAPI = 'https://blockchain.info';
        this.priceAPI = 'https://api.coingecko.com/api/v3';
        this.mempoolAPI = 'https://mempool.space/api';
        
        this.init();
    }

    async init() {
        try {
            this.initializeTheme();
            this.setupEventListeners();
            await this.loadRealTimeData();
            this.setupCharts();
            this.startAutoRefresh();
            this.hideLoading();
        } catch (error) {
            console.error('Failed to initialize:', error);
            // Fallback to static data if APIs fail
            this.loadStaticData();
            this.setupCharts();
            this.hideLoading();
        }
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('bitcoin-tracker-theme') || 'dark';
        this.currentTheme = savedTheme;
        document.body.className = `theme-${savedTheme}`;
    }

    setupEventListeners() {
        // Theme switcher
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Currency selector
        const currencySelect = document.getElementById('currencySelect');
        if (currencySelect) {
            currencySelect.addEventListener('change', (e) => {
                this.selectedCurrency = e.target.value;
                this.loadRealTimeData();
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadRealTimeData());
        }
    }

    async loadRealTimeData() {
        try {
            this.showLoading();
            
            // Fetch data from multiple APIs in parallel
            const [blockchainData, priceData, mempoolData] = await Promise.all([
                this.fetchBlockchainData(),
                this.fetchPriceData(),
                this.fetchMempoolData()
            ]);

            // Combine all data
            this.data = {
                ...blockchainData,
                price: priceData,
                mempool: mempoolData,
                lastUpdated: new Date().toISOString()
            };

            this.updateUI(this.data);
            this.updateCharts(this.data);
            this.lastUpdateTime = new Date();
            
        } catch (error) {
            console.error('Error loading real-time data:', error);
            // Fallback to static data
            this.loadStaticData();
        } finally {
            this.hideLoading();
        }
    }

    async fetchBlockchainData() {
        try {
            const [statsResponse, blockHeightResponse] = await Promise.all([
                fetch(`${this.blockchainAPI}/stats?format=json&cors=true`),
                fetch(`${this.blockchainAPI}/q/getblockcount?cors=true`)
            ]);

            const stats = await statsResponse.json();
            const blockHeight = await blockHeightResponse.text();

            const totalBitcoinMined = stats.totalbc / 100000000; // Convert satoshis to BTC
            const remainingBitcoin = 21000000 - totalBitcoinMined;

            return {
                summary: {
                    totalBitcoinMined: Math.floor(totalBitcoinMined),
                    remainingBitcoin: Math.floor(remainingBitcoin),
                    percentageMined: ((totalBitcoinMined / 21000000) * 100).toFixed(4),
                    estimatedDaysToCompletion: this.calculateDaysToCompletion(remainingBitcoin)
                },
                current: {
                    currentBlockHeight: parseInt(blockHeight),
                    totalBitcoinsInCirculation: Math.floor(totalBitcoinMined),
                    currentBlockReward: this.getCurrentBlockReward(parseInt(blockHeight)),
                    difficulty: stats.difficulty,
                    networkHashRate: stats.hash_rate
                },
                daily: {
                    bitcoinMinedLast24h: this.calculateDailyMining(),
                    blocksMinedLast24h: 144, // Approximate
                    averageBlockTime: 10.0
                },
                remaining: {
                    remainingBitcoin: Math.floor(remainingBitcoin),
                    percentageMined: ((totalBitcoinMined / 21000000) * 100).toFixed(4),
                    estimatedCompletionDate: this.calculateCompletionDate(remainingBitcoin),
                    nextHalvingEstimate: this.calculateNextHalving(parseInt(blockHeight))
                }
            };
        } catch (error) {
            console.error('Error fetching blockchain data:', error);
            throw error;
        }
    }

    async fetchPriceData() {
        try {
            const currency = this.selectedCurrency.toLowerCase();
            const response = await fetch(
                `${this.priceAPI}/simple/price?ids=bitcoin&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
            );
            const data = await response.json();
            
            return {
                current: data.bitcoin[currency],
                change24h: data.bitcoin[`${currency}_24h_change`],
                marketCap: data.bitcoin[`${currency}_market_cap`],
                volume24h: data.bitcoin[`${currency}_24h_vol`],
                currency: this.selectedCurrency
            };
        } catch (error) {
            console.error('Error fetching price data:', error);
            return {
                current: 0,
                change24h: 0,
                marketCap: 0,
                volume24h: 0,
                currency: this.selectedCurrency
            };
        }
    }

    async fetchMempoolData() {
        try {
            const response = await fetch(`${this.mempoolAPI}/mempool`);
            const data = await response.json();
            
            return {
                pendingTransactions: data.count,
                mempoolSize: data.vsize,
                fees: {
                    fastest: data.fastestFee || 0,
                    halfHour: data.halfHourFee || 0,
                    hour: data.hourFee || 0
                }
            };
        } catch (error) {
            console.error('Error fetching mempool data:', error);
            return {
                pendingTransactions: 0,
                mempoolSize: 0,
                fees: { fastest: 0, halfHour: 0, hour: 0 }
            };
        }
    }

    getCurrentBlockReward(blockHeight) {
        // Bitcoin halving occurs every 210,000 blocks
        const halvings = Math.floor(blockHeight / 210000);
        return 50 / Math.pow(2, halvings);
    }

    calculateDailyMining() {
        const dailyBlocks = 144; // Approximate blocks per day
        const currentReward = 6.25; // Current reward (this will be dynamic)
        return dailyBlocks * currentReward;
    }

    calculateDaysToCompletion(remainingBitcoin) {
        const dailyMining = this.calculateDailyMining();
        return Math.floor(remainingBitcoin / dailyMining);
    }

    calculateCompletionDate(remainingBitcoin) {
        const days = this.calculateDaysToCompletion(remainingBitcoin);
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);
        return futureDate.toISOString();
    }

    calculateNextHalving(blockHeight) {
        const nextHalvingBlock = Math.ceil(blockHeight / 210000) * 210000;
        const blocksUntilHalving = nextHalvingBlock - blockHeight;
        const daysUntilHalving = Math.floor(blocksUntilHalving / 144);
        
        const halvingDate = new Date();
        halvingDate.setDate(halvingDate.getDate() + daysUntilHalving);
        
        return {
            nextHalvingBlock,
            blocksUntilHalving,
            daysUntilHalving,
            estimatedDate: halvingDate.toISOString()
        };
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        document.body.className = `theme-${this.currentTheme}`;
        localStorage.setItem('bitcoin-tracker-theme', this.currentTheme);
        
        // Update charts with new theme
        if (this.chart) {
            this.setupCharts();
        }
    }

    showLoading() {
        const loadingEl = document.getElementById('loadingIndicator');
        if (loadingEl) loadingEl.style.display = 'flex';
    }

    hideLoading() {
        const loadingEl = document.getElementById('loadingIndicator');
        if (loadingEl) loadingEl.style.display = 'none';
    }

    updateUI(data) {
        // Update price information
        if (data.price) {
            this.updateElement('currentPrice', this.formatCurrency(data.price.current, data.price.currency));
            this.updateElement('priceCurrency', data.price.currency);
            
            const changeEl = document.getElementById('priceChange24h');
            if (changeEl && data.price.change24h !== undefined) {
                const isPositive = data.price.change24h >= 0;
                changeEl.textContent = `${isPositive ? '+' : ''}${data.price.change24h.toFixed(2)}%`;
                changeEl.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
            }
            
            this.updateElement('marketCap', this.formatCurrency(data.price.marketCap, data.price.currency, true));
            this.updateElement('volume24h', this.formatCurrency(data.price.volume24h, data.price.currency, true));
        }

        // Update main statistics
        this.updateElement('bitcoinToday', this.formatNumber(data.daily.bitcoinMinedLast24h, 2));
        this.updateElement('totalCirculation', this.formatNumber(data.current.totalBitcoinsInCirculation, 0));
        this.updateElement('bitcoinRemaining', this.formatNumber(data.remaining.remainingBitcoin, 0));
        this.updateElement('progressPercentage', this.formatNumber(data.remaining.percentageMined, 2));

        // Update progress bar
        const progressBar = document.getElementById('progressBar');
        const percentage = data.remaining.percentageMined;
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
        
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = `${this.formatNumber(data.current.totalBitcoinsInCirculation, 0)} of 21,000,000 Bitcoin have been mined (${this.formatNumber(percentage, 2)}% complete)`;
        }

        // Update network information
        this.updateElement('blockHeight', this.formatNumber(data.current.currentBlockHeight, 0));
        this.updateElement('blockReward', `${data.current.currentBlockReward} BTC`);
        this.updateElement('blocksToday', this.formatNumber(data.daily.blocksMinedLast24h, 0));
        this.updateElement('avgBlockTime', `${this.formatNumber(data.daily.averageBlockTime, 1)} min`);
        this.updateElement('difficulty', this.formatDifficulty(data.current.difficulty));
        
        // Update hash rate
        if (data.current.networkHashRate) {
            const hashRateEH = data.current.networkHashRate / 1e18; // Convert to EH/s
            this.updateElement('networkHashRate', `${hashRateEH.toFixed(1)} EH/s`);
        }

        // Update mempool information
        if (data.mempool) {
            this.updateElement('pendingTx', this.formatNumber(data.mempool.pendingTransactions, 0));
            this.updateElement('mempoolSize', `${(data.mempool.mempoolSize / 1024 / 1024).toFixed(1)} MB`);
            this.updateElement('fastFee', data.mempool.fees.fastest);
            this.updateElement('halfHourFee', data.mempool.fees.halfHour);
            this.updateElement('hourFee', data.mempool.fees.hour);
        }

        // Update halving information
        if (data.remaining.nextHalvingEstimate) {
            this.updateElement('nextHalvingBlock', this.formatNumber(data.remaining.nextHalvingEstimate.nextHalvingBlock, 0));
            this.updateElement('blocksUntilHalving', this.formatNumber(data.remaining.nextHalvingEstimate.blocksUntilHalving, 0));
            this.updateElement('daysUntilHalving', this.formatNumber(data.remaining.nextHalvingEstimate.daysUntilHalving, 0));
            this.updateElement('halvingDate', this.formatDate(data.remaining.nextHalvingEstimate.estimatedDate));
            this.updateElement('nextHalvingYear', new Date(data.remaining.nextHalvingEstimate.estimatedDate).getFullYear());
        }

        // Update timeline estimates
        this.updateElement('completionDate', this.formatDate(data.remaining.estimatedCompletionDate));
        this.updateElement('daysToCompletion', this.formatNumber(data.summary.estimatedDaysToCompletion, 0));
        this.updateElement('lastUpdated', this.formatTime(new Date()));

        // Add animation to updated elements
        this.animateUpdate();
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element && element.textContent !== value) {
            element.textContent = value;
            element.classList.add('animate-fade-in');
            setTimeout(() => element.classList.remove('animate-fade-in'), 600);
        }
    }

    animateUpdate() {
        // Add a subtle animation to show data has been updated
        const cards = document.querySelectorAll('.stat-card, .info-card, .price-card');
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.transform = 'scale(1.02)';
                setTimeout(() => {
                    card.style.transform = 'scale(1)';
                }, 150);
            }, index * 50);
        });
    }

    setupCharts() {
        this.setupMiningChart();
        this.setupPriceChart();
    }

    setupMiningChart() {
        const ctx = document.getElementById('miningChart');
        if (!ctx) return;

        if (this.chart) {
            this.chart.destroy();
        }

        const isDark = this.currentTheme === 'dark';
        const textColor = isDark ? '#f0f6fc' : '#212529';
        const gridColor = isDark ? '#30363d' : '#dee2e6';

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.generateTimeLabels(),
                datasets: [{
                    label: 'Bitcoin Mined',
                    data: this.generateMiningData(),
                    borderColor: '#f7931a',
                    backgroundColor: 'rgba(247, 147, 26, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#f7931a',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: textColor,
                            font: {
                                size: 14
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: gridColor,
                            borderColor: gridColor
                        },
                        ticks: {
                            color: textColor
                        }
                    },
                    y: {
                        grid: {
                            color: gridColor,
                            borderColor: gridColor
                        },
                        ticks: {
                            color: textColor,
                            callback: function(value) {
                                return value.toLocaleString() + 'M';
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                animation: {
                    duration: 2000,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }

    setupPriceChart() {
        const ctx = document.getElementById('priceChart');
        if (!ctx) return;

        if (this.priceChart) {
            this.priceChart.destroy();
        }

        const isDark = this.currentTheme === 'dark';
        const textColor = isDark ? '#f0f6fc' : '#212529';
        const gridColor = isDark ? '#30363d' : '#dee2e6';

        this.priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.generatePriceTimeLabels(),
                datasets: [{
                    label: 'Bitcoin Price (USD)',
                    data: this.generatePriceData(),
                    borderColor: '#00d084',
                    backgroundColor: 'rgba(0, 208, 132, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#00d084',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: textColor,
                            font: {
                                size: 14
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: gridColor,
                            borderColor: gridColor
                        },
                        ticks: {
                            color: textColor
                        }
                    },
                    y: {
                        grid: {
                            color: gridColor,
                            borderColor: gridColor
                        },
                        ticks: {
                            color: textColor,
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                animation: {
                    duration: 2000,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }

    generateTimeLabels() {
        const labels = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        return labels;
    }

    generateMiningData() {
        // Generate realistic mining progression data
        const baseValue = 19.5; // Million BTC
        const data = [];
        for (let i = 0; i < 7; i++) {
            data.push(baseValue + (i * 0.009)); // Approximately 900 BTC per day
        }
        return data;
    }

    generatePriceTimeLabels() {
        const labels = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        return labels;
    }

    generatePriceData() {
        // Generate realistic price data (this would come from API in real implementation)
        const basePrice = 67000;
        const data = [];
        for (let i = 0; i < 7; i++) {
            const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
            data.push(Math.round(basePrice * (1 + variation)));
        }
        return data;
    }

    updateCharts(data) {
        if (this.chart) {
            // Update mining chart with new data
            this.chart.data.datasets[0].data.push(data.current.totalBitcoinsInCirculation / 1000000);
            this.chart.data.datasets[0].data.shift();
            
            // Add new label
            const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            this.chart.data.labels.push(today);
            this.chart.data.labels.shift();
            
            this.chart.update('active');
        }

        if (this.priceChart && data.price) {
            // Update price chart with new data
            this.priceChart.data.datasets[0].data.push(data.price.current);
            this.priceChart.data.datasets[0].data.shift();
            
            // Add new label
            const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            this.priceChart.data.labels.push(today);
            this.priceChart.data.labels.shift();
            
            this.priceChart.update('active');
        }
    }

    startAutoRefresh() {
        setInterval(() => {
            this.loadRealTimeData();
        }, this.updateInterval);

        // Also refresh on visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.loadRealTimeData();
            }
        });
    }

    formatNumber(number, decimals = 0) {
        if (typeof number !== 'number' || isNaN(number)) return '0';
        return number.toLocaleString('en-US', { 
            minimumFractionDigits: decimals, 
            maximumFractionDigits: decimals 
        });
    }

    formatCurrency(amount, currency = 'USD', abbreviated = false) {
        if (typeof amount !== 'number' || isNaN(amount)) return '$0';
        
        if (abbreviated && amount >= 1e9) {
            return `${currency === 'USD' ? '$' : ''}${(amount / 1e9).toFixed(1)}B`;
        } else if (abbreviated && amount >= 1e6) {
            return `${currency === 'USD' ? '$' : ''}${(amount / 1e6).toFixed(1)}M`;
        } else if (abbreviated && amount >= 1e3) {
            return `${currency === 'USD' ? '$' : ''}${(amount / 1e3).toFixed(1)}K`;
        }
        
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: currency === 'USD' ? 0 : 2
        }).format(amount);
    }

    formatDifficulty(difficulty) {
        if (!difficulty) return '0';
        if (difficulty >= 1e12) {
            return `${(difficulty / 1e12).toFixed(2)}T`;
        } else if (difficulty >= 1e9) {
            return `${(difficulty / 1e9).toFixed(2)}B`;
        } else if (difficulty >= 1e6) {
            return `${(difficulty / 1e6).toFixed(2)}M`;
        }
        return difficulty.toLocaleString();
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    showError(message) {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--danger-red);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: var(--shadow);
            animation: slideInUp 0.3s ease-out;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // Static data fallback (enhanced)
    loadStaticData() {
        this.data = {
            summary: {
                totalBitcoinMined: 19750000,
                remainingBitcoin: 1250000,
                percentageMined: 94.05,
                estimatedDaysToCompletion: 1388
            },
            current: {
                currentBlockHeight: 850000,
                currentBlockReward: 6.25,
                difficulty: 61000000000000,
                networkHashRate: 500000000000000000000,
                totalBitcoinsInCirculation: 19750000
            },
            daily: {
                bitcoinMinedLast24h: 900,
                blocksMinedLast24h: 144,
                averageBlockTime: 10.0
            },
            remaining: {
                remainingBitcoin: 1250000,
                percentageMined: 94.05,
                estimatedCompletionDate: new Date(Date.now() + 1388 * 24 * 60 * 60 * 1000).toISOString(),
                nextHalvingEstimate: {
                    nextHalvingBlock: 840000,
                    blocksUntilHalving: 20000,
                    daysUntilHalving: 139,
                    estimatedDate: new Date(Date.now() + 139 * 24 * 60 * 60 * 1000).toISOString()
                }
            },
            price: {
                current: 67000,
                change24h: 2.5,
                marketCap: 1300000000000,
                volume24h: 25000000000,
                currency: this.selectedCurrency
            },
            mempool: {
                pendingTransactions: 15000,
                mempoolSize: 50 * 1024 * 1024, // 50 MB
                fees: {
                    fastest: 25,
                    halfHour: 18,
                    hour: 12
                }
            },
            lastUpdated: new Date().toISOString()
        };
        
        this.updateUI(this.data);
    }
}

// Initialize the enhanced Bitcoin Tracker
document.addEventListener('DOMContentLoaded', () => {
    new BitcoinTracker();
});

    loadStaticData() {
        // Static data that matches the expected structure
        this.data = {
            summary: {
                totalBitcoinMined: 19750000,
                remainingBitcoin: 1250000,
                percentageMined: 94.05,
                estimatedDaysToCompletion: 1388
            },
            current: {
                currentBlockHeight: 850000,
                currentBlockReward: 6.25,
                difficulty: 61000000000000,
                networkHashRate: 500000000000000000000,
                totalBitcoinsInCirculation: 19750000
            },
            daily: {
                bitcoinMinedLast24h: 900,
                blocksMinedLast24h: 144,
                averageBlockTime: 10.0
            },
            remaining: {
                remainingBitcoin: 1250000,
                percentageMined: 94.05,
                estimatedCompletionDate: new Date(Date.now() + 1388 * 24 * 60 * 60 * 1000).toISOString(),
                nextHalvingEstimate: {
                    nextHalvingBlock: 840000,
                    blocksUntilHalving: 20000,
                    daysUntilHalving: 139,
                    estimatedDate: new Date(Date.now() + 139 * 24 * 60 * 60 * 1000).toISOString()
                }
            }
        };
        this.updateUI(this.data);
    }

    async loadData() {
        try {
            const response = await fetch(`${this.apiBase}/mining-summary`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.updateUI(data);
            this.lastUpdateTime = new Date();
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    updateUI(data) {
        // Update main statistics
        this.updateElement('bitcoinToday', this.formatNumber(data.daily.bitcoinMinedLast24h, 2));
        this.updateElement('totalCirculation', this.formatNumber(data.current.totalBitcoinsInCirculation, 0));
        this.updateElement('bitcoinRemaining', this.formatNumber(data.remaining.remainingBitcoin, 0));
        this.updateElement('progressPercentage', this.formatNumber(data.remaining.percentageMined, 2));

        // Update progress bar
        const progressBar = document.getElementById('progressBar');
        const percentage = data.remaining.percentageMined;
        progressBar.style.width = `${percentage}%`;
        
        const progressText = document.getElementById('progressText');
        progressText.textContent = `${this.formatNumber(data.current.totalBitcoinsInCirculation, 0)} of 21,000,000 Bitcoin have been mined (${this.formatNumber(percentage, 2)}% complete)`;

        // Update detailed information
        this.updateElement('blockHeight', this.formatNumber(data.current.currentBlockHeight, 0));
        this.updateElement('blockReward', `${data.current.currentBlockReward} BTC`);
        this.updateElement('blocksToday', this.formatNumber(data.daily.blocksMinedLast24h, 0));
        this.updateElement('avgBlockTime', `${this.formatNumber(data.daily.averageBlockTime, 1)} min`);

        // Update halving information
        if (data.remaining.nextHalvingEstimate) {
            this.updateElement('nextHalvingBlock', this.formatNumber(data.remaining.nextHalvingEstimate.nextHalvingBlock, 0));
            this.updateElement('blocksUntilHalving', this.formatNumber(data.remaining.nextHalvingEstimate.blocksUntilHalving, 0));
            this.updateElement('daysUntilHalving', this.formatNumber(data.remaining.nextHalvingEstimate.daysUntilHalving, 0));
            this.updateElement('halvingDate', this.formatDate(data.remaining.nextHalvingEstimate.estimatedDate));
        }

        // Update timeline estimates
        this.updateElement('completionDate', this.formatDate(data.remaining.estimatedCompletionDate));
        this.updateElement('daysToCompletion', this.formatNumber(data.summary.estimatedDaysToCompletion, 0));
        this.updateElement('difficulty', this.formatDifficulty(data.current.difficulty));
        this.updateElement('lastUpdated', this.formatTime(new Date()));

        // Update chart if it exists
        if (this.chart) {
            this.updateChart(data);
        }
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            if (element.textContent !== value) {
                element.classList.add('updating');
                element.textContent = value;
                setTimeout(() => element.classList.remove('updating'), 300);
            }
        }
    }

    setupChart() {
        const ctx = document.getElementById('dailyChart');
        if (!ctx) return;

        // Create sample data for the chart (in a real app, this would come from historical API data)
        const days = [];
        const bitcoinMined = [];
        const blocks = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            days.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            // Simulate data (in production, this would be real historical data)
            const dailyBitcoin = 900 + (Math.random() - 0.5) * 100;
            const dailyBlocks = 144 + (Math.random() - 0.5) * 20;
            
            bitcoinMined.push(dailyBitcoin.toFixed(2));
            blocks.push(Math.round(dailyBlocks));
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: days,
                datasets: [
                    {
                        label: 'Bitcoin Mined',
                        data: bitcoinMined,
                        borderColor: '#f7931a',
                        backgroundColor: 'rgba(247, 147, 26, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Blocks Mined',
                        data: blocks,
                        borderColor: '#4a90e2',
                        backgroundColor: 'rgba(74, 144, 226, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#ffffff',
                            font: {
                                size: 14
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 20, 25, 0.9)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#f7931a',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#b0b7c3'
                        },
                        grid: {
                            color: 'rgba(176, 183, 195, 0.1)'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: {
                            color: '#f7931a',
                            callback: function(value) {
                                return value + ' BTC';
                            }
                        },
                        grid: {
                            color: 'rgba(247, 147, 26, 0.1)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        ticks: {
                            color: '#4a90e2',
                            callback: function(value) {
                                return value + ' blocks';
                            }
                        },
                        grid: {
                            drawOnChartArea: false,
                            color: 'rgba(74, 144, 226, 0.1)'
                        }
                    }
                }
            }
        });
    }

    updateChart(data) {
        if (!this.chart) return;

        // Add today's data to the chart
        const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const labels = this.chart.data.labels;
        
        // Remove oldest day and add new day
        if (labels.length >= 7) {
            labels.shift();
            this.chart.data.datasets[0].data.shift();
            this.chart.data.datasets[1].data.shift();
        }
        
        labels.push(today);
        this.chart.data.datasets[0].data.push(data.daily.bitcoinMinedLast24h.toFixed(2));
        this.chart.data.datasets[1].data.push(data.daily.blocksMinedLast24h);
        
        this.chart.update('none');
    }

    formatNumber(number, decimals = 0) {
        if (typeof number !== 'number') return '-';
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(number);
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return '-';
        }
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    formatDifficulty(difficulty) {
        if (typeof difficulty !== 'number') return '-';
        
        if (difficulty >= 1e12) {
            return (difficulty / 1e12).toFixed(2) + 'T';
        } else if (difficulty >= 1e9) {
            return (difficulty / 1e9).toFixed(2) + 'B';
        } else if (difficulty >= 1e6) {
            return (difficulty / 1e6).toFixed(2) + 'M';
        } else if (difficulty >= 1e3) {
            return (difficulty / 1e3).toFixed(2) + 'K';
        }
        return this.formatNumber(difficulty, 0);
    }

    startAutoRefresh() {
        setInterval(async () => {
            try {
                await this.loadData();
                console.log('Data refreshed at:', new Date().toLocaleTimeString());
            } catch (error) {
                console.error('Auto-refresh failed:', error);
            }
        }, this.updateInterval);
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        const mainContent = document.getElementById('mainContent');
        
        if (loading && mainContent) {
            loading.style.display = 'none';
            mainContent.style.display = 'block';
        }
    }

    showError(message) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.innerHTML = `
                <div style="color: #f56565; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                    <h2>Error Loading Data</h2>
                    <p>${message}</p>
                    <button onclick="location.reload()" style="
                        margin-top: 1rem;
                        padding: 0.5rem 1rem;
                        background: #f7931a;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                    ">Retry</button>
                </div>
            `;
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BitcoinTracker();
});

// Add some interactivity
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('stat-card')) {
        e.target.style.transform = 'scale(0.98)';
        setTimeout(() => {
            e.target.style.transform = '';
        }, 150);
    }
});
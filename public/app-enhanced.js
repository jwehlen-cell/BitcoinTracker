class BitcoinTracker {
    constructor() {
        this.updateInterval = 5 * 60 * 1000; // 5 minutes
        this.chart = null;
        this.priceChart = null;
        this.lastUpdateTime = null;
        this.currentTheme = 'dark';
        this.selectedCurrency = 'USD';
        
        // API endpoints
        this.blockchainAPI = 'https://blockchain.info';
        this.priceAPI = 'https://api.coingecko.com/api/v3';
        
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
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        const currencySelect = document.getElementById('currencySelect');
        if (currencySelect) {
            currencySelect.addEventListener('change', (e) => {
                this.selectedCurrency = e.target.value;
                this.loadRealTimeData();
            });
        }

        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadRealTimeData());
        }
    }

    async loadRealTimeData() {
        try {
            this.showLoading();
            
            const [blockchainData, priceData] = await Promise.all([
                this.fetchBlockchainData(),
                this.fetchPriceData()
            ]);

            this.data = {
                ...blockchainData,
                price: priceData,
                lastUpdated: new Date().toISOString()
            };

            this.updateUI(this.data);
            this.updateCharts(this.data);
            this.lastUpdateTime = new Date();
            
        } catch (error) {
            console.error('Error loading real-time data:', error);
            this.loadStaticData();
        } finally {
            this.hideLoading();
        }
    }

    async fetchBlockchainData() {
        try {
            // Use CORS proxy for blockchain.info
            const statsResponse = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent('https://blockchain.info/stats?format=json'));
            const statsData = await statsResponse.json();
            const stats = JSON.parse(statsData.contents);

            const totalBitcoinMined = stats.totalbc / 100000000;
            const remainingBitcoin = 21000000 - totalBitcoinMined;

            return {
                summary: {
                    totalBitcoinMined: Math.floor(totalBitcoinMined),
                    remainingBitcoin: Math.floor(remainingBitcoin),
                    percentageMined: ((totalBitcoinMined / 21000000) * 100).toFixed(4),
                    estimatedDaysToCompletion: this.calculateDaysToCompletion(remainingBitcoin)
                },
                current: {
                    currentBlockHeight: stats.n_blocks_total || 850000,
                    totalBitcoinsInCirculation: Math.floor(totalBitcoinMined),
                    currentBlockReward: this.getCurrentBlockReward(stats.n_blocks_total || 850000),
                    difficulty: stats.difficulty,
                    networkHashRate: stats.hash_rate || 500000000000000000000
                },
                daily: {
                    bitcoinMinedLast24h: this.calculateDailyMining(),
                    blocksMinedLast24h: 144,
                    averageBlockTime: 10.0
                },
                remaining: {
                    remainingBitcoin: Math.floor(remainingBitcoin),
                    percentageMined: ((totalBitcoinMined / 21000000) * 100).toFixed(4),
                    estimatedCompletionDate: this.calculateCompletionDate(remainingBitcoin),
                    nextHalvingEstimate: this.calculateNextHalving(stats.n_blocks_total || 850000)
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
                current: 67000,
                change24h: 2.5,
                marketCap: 1300000000000,
                volume24h: 25000000000,
                currency: this.selectedCurrency
            };
        }
    }

    getCurrentBlockReward(blockHeight) {
        const halvings = Math.floor(blockHeight / 210000);
        return 50 / Math.pow(2, halvings);
    }

    calculateDailyMining() {
        const dailyBlocks = 144;
        const currentReward = 6.25;
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
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = this.currentTheme === 'dark' ? '☀️' : '🌙';
        }
        
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
            const hashRateEH = data.current.networkHashRate / 1e18;
            this.updateElement('networkHashRate', `${hashRateEH.toFixed(1)} EH/s`);
        }

        // Update halving information
        if (data.remaining.nextHalvingEstimate) {
            this.updateElement('nextHalvingBlock', this.formatNumber(data.remaining.nextHalvingEstimate.nextHalvingBlock, 0));
            this.updateElement('blocksUntilHalving', this.formatNumber(data.remaining.nextHalvingEstimate.blocksUntilHalving, 0));
            this.updateElement('daysUntilHalving', this.formatNumber(data.remaining.nextHalvingEstimate.daysUntilHalving, 0));
            this.updateElement('halvingDate', this.formatDate(data.remaining.nextHalvingEstimate.estimatedDate));
            this.updateElement('nextHalvingYear', new Date(data.remaining.nextHalvingEstimate.estimatedDate).getFullYear());
        }

        this.updateElement('lastUpdated', this.formatTime(new Date()));
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element && element.textContent !== value) {
            element.textContent = value;
            element.classList.add('animate-fade-in');
            setTimeout(() => element.classList.remove('animate-fade-in'), 600);
        }
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
                    label: 'Bitcoin Mined (Millions)',
                    data: this.generateMiningData(),
                    borderColor: '#f7931a',
                    backgroundColor: 'rgba(247, 147, 26, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: textColor
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: textColor
                        }
                    },
                    y: {
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: textColor
                        }
                    }
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
                labels: this.generateTimeLabels(),
                datasets: [{
                    label: 'Bitcoin Price (USD)',
                    data: this.generatePriceData(),
                    borderColor: '#00d084',
                    backgroundColor: 'rgba(0, 208, 132, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: textColor
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: textColor
                        }
                    },
                    y: {
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: textColor,
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
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
        const baseValue = 19.5;
        const data = [];
        for (let i = 0; i < 7; i++) {
            data.push(baseValue + (i * 0.009));
        }
        return data;
    }

    generatePriceData() {
        const basePrice = 67000;
        const data = [];
        for (let i = 0; i < 7; i++) {
            const variation = (Math.random() - 0.5) * 0.1;
            data.push(Math.round(basePrice * (1 + variation)));
        }
        return data;
    }

    updateCharts(data) {
        if (this.chart && data.current) {
            this.chart.data.datasets[0].data.push(data.current.totalBitcoinsInCirculation / 1000000);
            this.chart.data.datasets[0].data.shift();
            
            const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            this.chart.data.labels.push(today);
            this.chart.data.labels.shift();
            
            this.chart.update();
        }
    }

    startAutoRefresh() {
        setInterval(() => {
            this.loadRealTimeData();
        }, this.updateInterval);
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
        }
        
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0
        }).format(amount);
    }

    formatDifficulty(difficulty) {
        if (!difficulty) return '0';
        if (difficulty >= 1e12) {
            return `${(difficulty / 1e12).toFixed(2)}T`;
        } else if (difficulty >= 1e9) {
            return `${(difficulty / 1e9).toFixed(2)}B`;
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
            minute: '2-digit'
        });
    }

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
            }
        };
        
        this.updateUI(this.data);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BitcoinTracker();
});
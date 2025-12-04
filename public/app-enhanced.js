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

    async fetchBillionaireData() {
        try {
            // Check cache first (cache for 1 hour)
            const cached = this.getCachedBillionaireData();
            if (cached) {
                return cached;
            }

            // Since Forbes doesn't have a public API, we'll use a combination of approaches
            // Method 1: Try Forbes via CORS proxy (may be blocked)
            let billionaires = await this.tryFetchForbesData();
            
            // Method 2: Fallback to alternative data sources
            if (!billionaires || billionaires.length === 0) {
                billionaires = await this.tryFetchAlternativeData();
            }
            
            // Method 3: Ultimate fallback to known recent data
            if (!billionaires || billionaires.length === 0) {
                billionaires = this.getFallbackBillionaireData();
            }

            // Cache the results
            this.cacheBillionaireData(billionaires);
            return billionaires;
        } catch (error) {
            console.error('Error fetching billionaire data:', error);
            return this.getFallbackBillionaireData();
        }
    }

    async tryFetchForbesData() {
        try {
            // Try to fetch Forbes data via CORS proxy
            const proxyUrl = 'https://api.allorigins.win/get?url=';
            const forbesUrl = encodeURIComponent('https://www.forbes.com/real-time-billionaires/');
            
            const response = await fetch(`${proxyUrl}${forbesUrl}`);
            const data = await response.json();
            
            if (data.contents) {
                return this.parseForbesData(data.contents);
            }
            return null;
        } catch (error) {
            console.log('Forbes direct fetch failed, trying alternatives...');
            return null;
        }
    }

    async tryFetchAlternativeData() {
        try {
            // Alternative: Use a financial data API that might have billionaire info
            // For now, we'll return null and use fallback
            return null;
        } catch (error) {
            return null;
        }
    }

    parseForbesData(html) {
        try {
            // Create a temporary DOM to parse the HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Look for billionaire data in the HTML structure
            // This is fragile and may break if Forbes changes their structure
            const billionaires = [];
            
            // Try to find table rows or list items with billionaire data
            const rows = doc.querySelectorAll('tr, .billionaire-item, [data-testid="billionaire"]');
            
            rows.forEach((row, index) => {
                if (index >= 10) return; // Only get top 10
                
                const nameEl = row.querySelector('[data-testid="name"], .name, td:first-child');
                const wealthEl = row.querySelector('[data-testid="wealth"], .wealth, .net-worth');
                
                if (nameEl && wealthEl) {
                    const name = nameEl.textContent.trim();
                    const wealthText = wealthEl.textContent.trim();
                    const wealth = this.parseWealthString(wealthText);
                    
                    if (name && wealth > 0) {
                        billionaires.push({ name, wealth, rank: index + 1 });
                    }
                }
            });
            
            return billionaires.length > 0 ? billionaires : null;
        } catch (error) {
            console.error('Error parsing Forbes data:', error);
            return null;
        }
    }

    parseWealthString(wealthText) {
        // Parse wealth strings like "$500.6B", "$306.7B", etc.
        const match = wealthText.match(/\$?([\d.]+)([BMK])?/);
        if (!match) return 0;
        
        const number = parseFloat(match[1]);
        const unit = match[2];
        
        switch (unit) {
            case 'B': return number * 1000000000;
            case 'M': return number * 1000000;
            case 'K': return number * 1000;
            default: return number;
        }
    }

    getFallbackBillionaireData() {
        // Recent Forbes data as of December 2024 (fallback)
        return [
            { name: 'Elon Musk', wealth: 439000000000, rank: 1 },
            { name: 'Jeff Bezos', wealth: 243000000000, rank: 2 },
            { name: 'Mark Zuckerberg', wealth: 224000000000, rank: 3 },
            { name: 'Larry Ellison', wealth: 196000000000, rank: 4 },
            { name: 'Bernard Arnault', wealth: 181000000000, rank: 5 },
            { name: 'Bill Gates', wealth: 165000000000, rank: 6 },
            { name: 'Larry Page', wealth: 158000000000, rank: 7 },
            { name: 'Sergey Brin', wealth: 149000000000, rank: 8 },
            { name: 'Warren Buffett', wealth: 143000000000, rank: 9 },
            { name: 'Steve Ballmer', wealth: 145000000000, rank: 10 }
        ];
    }

    getCachedBillionaireData() {
        try {
            const cached = localStorage.getItem('billionaireData');
            if (cached) {
                const data = JSON.parse(cached);
                const now = Date.now();
                // Cache for 1 hour
                if (now - data.timestamp < 3600000) {
                    return data.billionaires;
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    cacheBillionaireData(billionaires) {
        try {
            const data = {
                billionaires,
                timestamp: Date.now()
            };
            localStorage.setItem('billionaireData', JSON.stringify(data));
        } catch (error) {
            console.error('Error caching billionaire data:', error);
        }
    }

    getCurrentBlockReward(blockHeight) {
        const halvings = Math.floor(blockHeight / 210000);
        return 50 / Math.pow(2, halvings);
    }

    calculateDailyMining() {
        const dailyBlocks = 144;
        const currentReward = 3.125; // Updated after April 2024 halving
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
            
            // Update Satoshi Nakamoto net worth
            this.updateSatoshiNetWorth(data.price.current, data.price.currency);
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
        this.updateElement('lastUpdatedHeader', this.formatDateTime(new Date()));
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element && element.textContent !== value) {
            element.textContent = value;
            element.classList.add('animate-fade-in');
            setTimeout(() => element.classList.remove('animate-fade-in'), 600);
        }
    }

    async updateSatoshiNetWorth(bitcoinPrice, currency) {
        const satoshiBitcoin = 1000000; // Estimated 1 million Bitcoin
        const netWorth = satoshiBitcoin * bitcoinPrice;
        
        // Update net worth display
        this.updateElement('satoshiNetWorth', this.formatCurrency(netWorth, currency, true));
        this.updateElement('satoshiCurrency', currency);
        
        // Get current billionaire data
        const billionaires = await this.fetchBillionaireData();
        
        // Update wealth comparison section
        this.updateWealthComparison(billionaires, netWorth, currency);
        
        // Calculate dynamic ranking based on real billionaire data
        const ranking = this.calculateSatoshiRanking(billionaires, netWorth);
        this.updateElement('satoshiRanking', ranking);
        
        // Update years silent calculation
        const lastActivity = new Date('2011-04-23');
        const now = new Date();
        const yearsSilent = Math.floor((now - lastActivity) / (365.25 * 24 * 60 * 60 * 1000));
        this.updateElement('yearsSilent', `${yearsSilent}+`);
    }

    updateWealthComparison(billionaires, satoshiNetWorth, currency) {
        const container = document.getElementById('wealthComparison');
        if (!container) return;

        // Create list of all billionaires including Satoshi
        const allBillionaires = [...billionaires];
        
        // Add Satoshi to the list
        const satoshiEntry = {
            name: 'Satoshi Nakamoto',
            wealth: satoshiNetWorth,
            rank: 0,
            isSatoshi: true
        };
        
        allBillionaires.push(satoshiEntry);
        
        // Sort by wealth descending
        allBillionaires.sort((a, b) => b.wealth - a.wealth);
        
        // Update ranks
        allBillionaires.forEach((person, index) => {
            person.rank = index + 1;
        });
        
        // Show top 6 (including Satoshi if in top 6, otherwise top 5 + Satoshi)
        let displayList = allBillionaires.slice(0, 6);
        
        // If Satoshi isn't in top 6, replace the 6th with Satoshi
        const satoshiInTop6 = displayList.find(p => p.isSatoshi);
        if (!satoshiInTop6) {
            displayList[5] = satoshiEntry;
        }
        
        // Generate HTML
        const html = displayList.map(person => {
            const isHighlighted = person.isSatoshi;
            const formattedWealth = this.formatCurrency(person.wealth, currency, true);
            
            return `
                <div class="wealth-item ${isHighlighted ? 'satoshi-wealth' : ''}" ${isHighlighted ? 'id="satoshiWealthItem"' : ''}>
                    <span class="wealth-person">${person.name}</span>
                    <span class="wealth-amount" ${isHighlighted ? 'id="satoshiWealthComparison"' : ''}>${formattedWealth}</span>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    }

    calculateSatoshiRanking(billionaires, satoshiNetWorth) {
        let rank = 1;
        for (const billionaire of billionaires) {
            if (billionaire.wealth > satoshiNetWorth) {
                rank++;
            } else {
                break;
            }
        }
        
        // Format ranking
        if (rank === 1) return '1st';
        if (rank === 2) return '2nd';
        if (rank === 3) return '3rd';
        if (rank <= 10) return `${rank}th`;
        if (rank <= 20) return `~${rank}th`;
        if (rank <= 50) return `~${Math.ceil(rank / 5) * 5}th`;
        return `~${Math.ceil(rank / 10) * 10}th`;
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

    formatDateTime(date) {
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    loadStaticData() {
        this.data = {
            summary: {
                totalBitcoinMined: 19957621,
                remainingBitcoin: 1042379,
                percentageMined: 95.03,
                estimatedDaysToCompletion: 23200
            },
            current: {
                currentBlockHeight: 926444,
                currentBlockReward: 3.125,
                difficulty: 102289407543323.8,
                networkHashRate: 750000000000000000000,
                totalBitcoinsInCirculation: 19957621
            },
            daily: {
                bitcoinMinedLast24h: 450,
                blocksMinedLast24h: 144,
                averageBlockTime: 10.0
            },
            remaining: {
                remainingBitcoin: 1042379,
                percentageMined: 95.03,
                estimatedCompletionDate: new Date(Date.now() + 23200 * 24 * 60 * 60 * 1000).toISOString(),
                nextHalvingEstimate: {
                    nextHalvingBlock: 1050000,
                    blocksUntilHalving: 123556,
                    daysUntilHalving: 858,
                    estimatedDate: new Date(Date.now() + 858 * 24 * 60 * 60 * 1000).toISOString()
                }
            },
            price: {
                current: 92025,
                change24h: -1.13,
                marketCap: 1832054587561,
                volume24h: 45000000000,
                currency: this.selectedCurrency
            },
            mempool: {
                pendingTransactions: 15000,
                mempoolSize: 50 * 1024 * 1024,
                fees: {
                    fastest: 25,
                    halfHour: 18,
                    hour: 12
                }
            }
        };
        
        this.updateUI(this.data);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BitcoinTracker();
});
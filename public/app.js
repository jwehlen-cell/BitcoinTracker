class BitcoinTracker {
    constructor() {
        this.apiBase = '/api';
        this.updateInterval = 5 * 60 * 1000; // 5 minutes
        this.chart = null;
        this.lastUpdateTime = null;
        
        this.init();
    }

    async init() {
        try {
            // Use static data immediately for this demo
            this.loadStaticData();
            this.setupChart();
            this.startAutoRefresh();
            this.hideLoading();
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('Failed to load Bitcoin data. Please refresh the page.');
        }
    }

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
# ₿ Bitcoin Mining Tracker

A real-time web application that tracks daily Bitcoin mining statistics and shows how many Bitcoin remain to be mined. Built with Node.js/Express backend and vanilla JavaScript frontend, designed for deployment on AWS.

## 🚀 Features

- **Real-time Bitcoin Statistics**: Live data from blockchain.info API
- **Daily Mining Tracking**: Shows Bitcoin mined in the last 24 hours
- **Supply Progress**: Visual progress bar showing Bitcoin mining completion
- **Remaining Supply**: Calculate and display remaining Bitcoin to be mined
- **Halving Information**: Next halving date and countdown
- **Interactive Charts**: Daily mining statistics visualization
- **Mobile Responsive**: Works on all device sizes
- **Auto-refresh**: Updates every 5 minutes automatically
- **AWS Ready**: Complete deployment configuration included

## 📊 Live Demo

Visit the live application: [Bitcoin Mining Tracker](http://your-app-url.com)

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: HTML5, CSS3, JavaScript (ES6+), Chart.js
- **APIs**: blockchain.info API for Bitcoin data
- **Deployment**: AWS ECS Fargate, Application Load Balancer
- **Container**: Docker
- **Infrastructure**: AWS CloudFormation

## 📋 Prerequisites

- Node.js 16+ and npm
- Docker (for containerization)
- AWS CLI (for deployment)
- AWS Account with appropriate permissions

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/jwehlen-cell/BitcoinTracker.git
   cd BitcoinTracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env .env.local
   # Edit .env.local with your configuration
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

### Production Build

```bash
npm start
```

## 🐳 Docker

### Build and run locally
```bash
# Build the image
docker build -t bitcoin-tracker .

# Run the container
docker run -p 3000:3000 bitcoin-tracker
```

## ☁️ AWS Deployment

### Automated Deployment

The easiest way to deploy to AWS is using the included deployment script:

```bash
# Make sure AWS CLI is configured
aws configure

# Run the deployment script
./aws/deploy.sh
```

### AWS Resources Created

- **ECS Cluster**: Fargate cluster for running containers
- **ECS Service**: Manages container instances with auto-scaling
- **Application Load Balancer**: Distributes traffic and provides health checks
- **Target Group**: Routes traffic to healthy container instances
- **Security Groups**: Controls network access
- **CloudWatch Logs**: Application logging
- **IAM Roles**: Task execution and task roles with minimal permissions

## 📡 API Documentation

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main application dashboard |
| `/api` | GET | API documentation |
| `/api/health` | GET | Health check endpoint |
| `/api/mining-summary` | GET | Complete mining summary with all data |
| `/api/current-stats` | GET | Current Bitcoin blockchain statistics |
| `/api/daily-stats` | GET | Daily mining data for last 24 hours |
| `/api/remaining` | GET | Remaining Bitcoin supply information |

## 🧪 Testing

### Run Health Check
```bash
curl http://localhost:3000/api/health
```

### Test API Endpoints
```bash
# Get mining summary
curl http://localhost:3000/api/mining-summary

# Get current stats
curl http://localhost:3000/api/current-stats
```

## 🛠️ Development

### Project Structure
```
BitcoinTracker/
├── public/              # Frontend files
│   ├── index.html      # Main HTML page
│   ├── styles.css      # Application styles
│   └── app.js          # Frontend JavaScript
├── services/           # Backend services
│   └── bitcoinDataService.js
├── aws/                # AWS deployment files
│   ├── cloudformation-template.json
│   ├── deploy.sh
│   └── config.yml
├── server.js           # Express server
├── package.json        # Dependencies
├── Dockerfile          # Container configuration
├── .env               # Environment variables
└── README.md          # This file
```

### Local Development Commands
```bash
npm run dev         # Start with nodemon for auto-reload
npm start          # Start production server
docker build        # Build container
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **blockchain.info** for providing the Bitcoin data API
- **Chart.js** for beautiful charts
- **AWS** for cloud infrastructure
- **Bitcoin Community** for the inspiration

---

**Built with ❤️ for the Bitcoin community**

*Last updated: November 5, 2024*
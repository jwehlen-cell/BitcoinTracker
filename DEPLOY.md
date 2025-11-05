# Render.com deployment instructions

## Quick Deploy to Render

1. Go to https://render.com
2. Sign up/login with your GitHub account
3. Click "New Web Service"
4. Connect your GitHub repository: `jwehlen-cell/BitcoinTracker`
5. Use these settings:
   - **Name**: bitcoin-tracker
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free

Your app will be deployed and accessible at: `https://bitcoin-tracker-[random-id].onrender.com`

## Environment Variables (Optional)
- PORT: 3000 (Render will override this automatically)

The deployment should complete in 2-3 minutes and your Bitcoin tracker will be live!
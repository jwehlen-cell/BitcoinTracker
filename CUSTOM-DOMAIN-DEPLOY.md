# Deploy Bitcoin Tracker to wehlen.net

## Option 1: Deploy to Netlify with Custom Domain (Recommended)

### Step 1: Deploy to Netlify
1. Go to [netlify.com](https://netlify.com)
2. Sign up/login with GitHub
3. Click "New site from Git"
4. Choose GitHub and select `jwehlen-cell/BitcoinTracker`
5. Use these build settings:
   - **Build command**: `npm install`
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`

### Step 2: Configure Custom Domain
1. In your Netlify dashboard, go to "Domain settings"
2. Click "Add custom domain"
3. Enter `bitcoin.wehlen.net` (or `tracker.wehlen.net`)
4. Netlify will provide DNS records

### Step 3: Update DNS at Network Solutions
Log into your Network Solutions account and add these DNS records:

**For subdomain (bitcoin.wehlen.net):**
```
Type: CNAME
Name: bitcoin
Value: [your-netlify-subdomain].netlify.app
TTL: 3600
```

**For root domain (wehlen.net) - if you want to use the root:**
```
Type: A
Name: @
Value: 75.2.60.5
TTL: 3600
```

### Step 4: SSL Certificate
Netlify will automatically provision an SSL certificate for your custom domain.

## Option 2: Deploy to Vercel with Custom Domain

1. Complete the Vercel authentication we started earlier
2. Deploy using `vercel --prod`
3. Add custom domain in Vercel dashboard
4. Update DNS records at Network Solutions

## Your Bitcoin Tracker will be live at:
- `https://bitcoin.wehlen.net` 
- or `https://tracker.wehlen.net`
- or `https://wehlen.net` (if using root domain)

## Features Available:
- ✅ Real-time Bitcoin mining statistics
- ✅ Interactive charts showing mining progress
- ✅ Mobile-responsive design
- ✅ Daily mining data and remaining Bitcoin calculations
- ✅ SSL encryption
- ✅ Fast global CDN
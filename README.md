# BRRRR Deal Analyzer Backend

## What This Does
Analyzes property photos with Claude AI to estimate renovation costs, identify issues, and provide deal recommendations.

## Deployment to Render (5 mins)

### Step 1: Push to GitHub
1. Create a GitHub account if you don't have one (github.com)
2. Create a new repo called "brrrr-backend"
3. Upload these files:
   - server.js
   - package.json
   - render.yaml
   - .gitignore (add: node_modules/)

### Step 2: Connect to Render
1. Go to render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub account
4. Select "brrrr-backend" repo
5. Fill in:
   - Name: brrrr-deal-analyzer
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
6. Add Environment Variable:
   - Key: `ANTHROPIC_API_KEY`
   - Value: (paste your Claude API key from https://console.anthropic.com/account/keys)
7. Click "Deploy"

### Step 3: Get Your API URL
Once deployed (2-3 mins), you'll get a URL like:
`https://brrrr-deal-analyzer-xxxxx.onrender.com`

## API Endpoints

### POST /analyze
Send property photo + details, get renovation estimate back.

**Request:**
```
POST https://your-render-url.onrender.com/analyze
Content-Type: multipart/form-data

address: "123 Main St"
squareFeet: 1109
currentBeds: 3
currentBaths: 1
targetBeds: 3
targetBaths: 2
photo: (upload image file)
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "address": "123 Main St",
    "condition": "Moderate",
    "issuesFound": ["water_damage", "electrical_issues"],
    "visibleConditionNotes": "..."
  },
  "costBreakdown": {
    "baseCosmeticCost": 10535,
    "bedroomAdditions": 0,
    "bathroomAdditions": 4500,
    "damageRepairs": 12000,
    "subtotal": 27035,
    "totalRehabEstimate": 27035
  }
}
```

### GET /health
Check if backend is running.

### GET /costs
View current cost baseline.

## Connecting to Base44

In Base44's "New Deal Analysis" page, add a button that calls:
`https://your-render-url.onrender.com/analyze`

With the form data (address, sqft, beds/baths, photo upload).

The response auto-fills your form fields.

## Cost Baseline

Update costs in `server.js` under `costBaseline` object as you complete more deals.

## Troubleshooting

- **500 Error**: Check ANTHROPIC_API_KEY is set in Render dashboard
- **Photo not analyzing**: Make sure image format is supported (JPG, PNG)
- **Slow response**: First call may take 10-15 seconds as Render spins up. Subsequent calls are faster.

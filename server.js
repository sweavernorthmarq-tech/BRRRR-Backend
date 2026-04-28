const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// File upload setup
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Cost baseline (from BRRRR analysis)
const costBaseline = {
  cosmeticPerSqft: 9.50,
  bathroomAddition: 4500,
  bedroomAddition: 2500,
  lighting: 400,
  hingesKnobs: 225,
  subflooring: 1000,
  framing: 1000,
  plumbing: 2000,
  electricalPartial: 2000,
  electricalFull: 9915,
  hvac: 8500,
  roofReplacement: 5800,
  exteriorRot: 1000,
  moldRemediation: 2000,
};

// Condition multipliers
const conditionMultipliers = {
  light: 1.0,
  moderate: 1.75,
  heavy: 2.5,
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Main analysis endpoint
app.post('/analyze', upload.single('photo'), async (req, res) => {
  try {
    const { address, squareFeet, currentBeds, currentBaths, targetBeds, targetBaths } = req.body;

    // Validate required fields
    if (!address || !squareFeet) {
      return res.status(400).json({ error: 'Address and square footage required' });
    }

    // If photo provided, analyze it with Claude
    let analysisResults = {
      condition: 'moderate',
      issues: [],
      notes: 'No photo provided - using defaults',
    };

    if (req.file) {
      const base64Image = req.file.buffer.toString('base64');
      const imageMediaType = req.file.mimetype || 'image/jpeg';

      try {
        const message = await anthropic.messages.create({
          model: 'claude-opus-4-20250805',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: imageMediaType,
                    data: base64Image,
                  },
                },
                {
                  type: 'text',
                  text: `Analyze this property photo for renovation potential. Respond ONLY with valid JSON (no markdown, no extra text):
{
  "condition": "light|moderate|heavy",
  "issues": ["water_damage", "electrical_issues", "hvac_failing", "roof_issues", "exterior_rot", "mold_damage"],
  "visibleConditionNotes": "brief description of what you see",
  "estimatedConditionLevel": "light|moderate|heavy"
}

Light = mostly cosmetic, structure sound
Moderate = some damage/repairs needed, mixed condition
Heavy = major systems failing, extensive damage visible`,
                },
              ],
            },
          ],
        });

        const responseText = message.content[0].text;
        analysisResults = JSON.parse(responseText);
      } catch (claudeError) {
        console.error('Claude analysis error:', claudeError);
        analysisResults.notes = 'Photo analysis failed, using manual assessment';
      }
    }

    // Calculate renovation costs
    const condition = analysisResults.condition.toLowerCase();
    const conditionMultiplier = conditionMultipliers[condition] || 1.0;

    // Base cosmetic
    const baseCosmeticCost = Math.round(squareFeet * costBaseline.cosmeticPerSqft);

    // Space additions
    const bedsToAdd = Math.max(0, (targetBeds || currentBeds) - (currentBeds || 0));
    const bathsToAdd = Math.max(0, (targetBaths || currentBaths) - (currentBaths || 0));
    const bedroomAdditionCost = bedsToAdd * costBaseline.bedroomAddition;
    const bathroomAdditionCost = bathsToAdd * costBaseline.bathroomAddition;

    // Damage/issue costs
    let damageAdderCost = 0;
    const issuesMap = {
      water_damage: costBaseline.subflooring,
      exterior_rot: costBaseline.exteriorRot,
      mold_damage: costBaseline.moldRemediation,
      electrical_issues: condition === 'heavy' ? costBaseline.electricalFull : costBaseline.electricalPartial,
      hvac_failing: costBaseline.hvac,
      roof_issues: costBaseline.roofReplacement,
    };

    (analysisResults.issues || []).forEach((issue) => {
      if (issuesMap[issue]) {
        damageAdderCost += issuesMap[issue];
      }
    });

    // Apply condition multiplier to base (not to damage which is already added)
    const baseWithMultiplier = (baseCosmeticCost - damageAdderCost) * conditionMultiplier + damageAdderCost;
    const totalRehabEstimate = Math.round(
      baseWithMultiplier + bedroomAdditionCost + bathroomAdditionCost + damageAdderCost
    );

    // Return detailed breakdown
    res.json({
      success: true,
      analysis: {
        address,
        condition: condition.charAt(0).toUpperCase() + condition.slice(1),
        issuesFound: analysisResults.issues || [],
        visibleConditionNotes: analysisResults.visibleConditionNotes || '',
      },
      costBreakdown: {
        baseCosmeticCost,
        bedroomAdditions: bedroomAdditionCost,
        bathroomAdditions: bathroomAdditionCost,
        damageRepairs: damageAdderCost,
        subtotal: Math.round(baseWithMultiplier + bedroomAdditionCost + bathroomAdditionCost),
        totalRehabEstimate,
      },
      recommendation: {
        conditionMultiplier,
        analysisNotes: analysisResults.visibleConditionNotes || 'Photo analyzed by Claude',
      },
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      details: error.message,
    });
  }
});

// Get cost baseline endpoint (for reference)
app.get('/costs', (req, res) => {
  res.json(costBaseline);
});

// Start server
app.listen(port, () => {
  console.log(`BRRRR Deal Analyzer running on port ${port}`);
});

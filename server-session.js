const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Enable CORS for all routes with Railway-specific headers
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Trust Railway proxy for HTTPS
app.set('trust proxy', 1);

app.use(express.static('.'));
app.use(express.json());

// Add security headers for HTTPS
app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] === 'https' || req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
});

// Serve presenter.html as the main presentation
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/presenter.html');
});

// Session endpoint for ephemeral keys (following OpenAI example)
app.post('/session', async (req, res) => {
    try {
        console.log('📋 Creating ephemeral session...');
        console.log('🔑 API Key configured:', OPENAI_API_KEY ? 'Yes' : 'No');
        console.log('🌐 Request from:', req.headers['x-forwarded-for'] || req.connection.remoteAddress);
        
        if (!OPENAI_API_KEY) {
            console.error('❌ OPENAI_API_KEY not configured');
            return res.status(500).json({ 
                error: 'Server configuration error',
                details: 'OPENAI_API_KEY environment variable not set' 
            });
        }
        
        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-realtime-preview-2024-12-17',
                voice: 'alloy'
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Failed to create session:', response.status, errorText);
            return res.status(response.status).json({ 
                error: 'Failed to create session',
                details: errorText,
                status: response.status
            });
        }

        const session = await response.json();
        console.log('✅ Ephemeral session created successfully');
        
        res.json(session);
    } catch (error) {
        console.error('❌ Session creation error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Alternative GET endpoint for compatibility
app.get('/session', async (req, res) => {
    // Redirect GET to POST
    req.method = 'POST';
    app._router.handle(req, res);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        server: 'Beforest WebRTC Voice Server',
        port: PORT,
        openai_key_configured: !!OPENAI_API_KEY
    });
});

// Start the HTTP server
app.listen(PORT, () => {
    console.log(`🌐 Beforest WebRTC Voice Server running on http://localhost:${PORT}`);
    console.log(`🎤 WebRTC voice agent available on Slide 8`);
    console.log(`🔑 Using OpenAI API Key: ${OPENAI_API_KEY ? '***' + OPENAI_API_KEY.slice(-4) : 'NOT FOUND'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Beforest WebRTC Voice Server...');
    process.exit(0);
}); 
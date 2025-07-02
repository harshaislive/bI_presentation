const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002; // Change port to avoid conflicts
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Enable CORS for all routes
app.use(cors());
app.use(express.static('.'));

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ 
    server: server,
    perMessageDeflate: false,
    maxPayload: 100 * 1024 * 1024 // 100MB for audio data
});

console.log(`🎙️ Beforest Voice Proxy Server starting on port ${PORT}`);
console.log(`🔑 Using OpenAI API Key: ${OPENAI_API_KEY ? '***' + OPENAI_API_KEY.slice(-4) : 'NOT FOUND'}`);

wss.on('connection', (clientWs, request) => {
    console.log('🔌 New client connected from:', request.socket.remoteAddress);
    
    let openAIWs = null;
    let isConnecting = false;

    // Connect to OpenAI Realtime API
    const connectToOpenAI = () => {
        if (isConnecting) {
            console.log('🔄 Already connecting to OpenAI, skipping...');
            return;
        }
        
        isConnecting = true;
        const openAIUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
        
        console.log('🤖 Connecting to OpenAI Realtime API...');
        
        openAIWs = new WebSocket(openAIUrl, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'OpenAI-Beta': 'realtime=v1'
            }
        });

        openAIWs.on('open', () => {
            console.log('✅ Connected to OpenAI Realtime API');
            isConnecting = false;
            clientWs.send(JSON.stringify({
                type: 'proxy.connection.success',
                message: 'Connected to OpenAI Realtime API'
            }));
        });

        openAIWs.on('message', (data) => {
            try {
                // Forward OpenAI messages to client
                if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(data);
                }
                
                // Try to log important events (skip binary data)
                try {
                    if (typeof data === 'string') {
                        const message = JSON.parse(data);
                        if (message.type && !message.type.includes('audio')) {
                            console.log('📤 OpenAI → Client:', message.type);
                        }
                    } else {
                        console.log('📤 OpenAI → Client: [binary data]');
                    }
                } catch (parseError) {
                    // Skip logging for non-JSON data
                    console.log('📤 OpenAI → Client: [non-JSON data]');
                }
            } catch (error) {
                console.error('Error forwarding OpenAI message:', error);
            }
        });

        openAIWs.on('error', (error) => {
            console.error('❌ OpenAI WebSocket error:', error);
            isConnecting = false;
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                    type: 'proxy.connection.error',
                    message: 'OpenAI connection failed',
                    error: error.message
                }));
            }
        });

        openAIWs.on('close', (code, reason) => {
            console.log('🔌 OpenAI connection closed:', code, reason.toString());
            isConnecting = false;
            openAIWs = null;
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                    type: 'proxy.connection.closed',
                    message: 'OpenAI connection closed',
                    code: code
                }));
            }
            
            // Attempt reconnection after a delay if client is still connected
            if (clientWs.readyState === WebSocket.OPEN && code !== 1000) {
                console.log('🔄 Attempting reconnection in 3 seconds...');
                setTimeout(() => {
                    if (clientWs.readyState === WebSocket.OPEN && !openAIWs) {
                        connectToOpenAI();
                    }
                }, 3000);
            }
        });
    };

    // Handle client messages
    clientWs.on('message', (data) => {
        try {
            // Forward client messages to OpenAI
            if (openAIWs && openAIWs.readyState === WebSocket.OPEN) {
                openAIWs.send(data);
                
                // Try to log important events (skip binary data)
                try {
                    if (typeof data === 'string') {
                        const message = JSON.parse(data);
                        if (message.type && !message.type.includes('audio')) {
                            console.log('📥 Client → OpenAI:', message.type);
                        }
                    } else {
                        console.log('📥 Client → OpenAI: [binary data]');
                    }
                } catch (parseError) {
                    // Skip logging for non-JSON data
                    console.log('📥 Client → OpenAI: [non-JSON data]');
                }
            } else {
                // Don't continuously reconnect - just queue the message
                console.log('⏳ OpenAI not ready, dropping message');
            }
        } catch (error) {
            console.error('Error forwarding client message:', error);
        }
    });

    clientWs.on('error', (error) => {
        console.error('❌ Client WebSocket error:', error);
    });

    clientWs.on('close', (code, reason) => {
        console.log('🔌 Client disconnected:', code, reason);
        if (openAIWs && openAIWs.readyState === WebSocket.OPEN) {
            openAIWs.close();
        }
    });

    // Initial connection to OpenAI
    connectToOpenAI();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        server: 'Beforest Voice Proxy',
        port: PORT,
        openai_key_configured: !!OPENAI_API_KEY
    });
});

// Serve presenter.html as the main presentation
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/presenter.html');
});

// Start the HTTP server
server.listen(PORT, () => {
    console.log(`🌐 HTTP server running on http://localhost:${PORT}`);
    console.log(`🎤 WebSocket proxy ready for OpenAI Realtime API`);
    console.log(`📊 Main presentation: http://localhost:${PORT} (presenter.html)`);
    console.log(`📋 Controller view: http://localhost:${PORT}/controller (index.html)`);
    console.log(`🎙️ Voice agent demo available on Slide 8`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Beforest Voice Proxy...');
    server.close(() => {
        console.log('✅ Server closed gracefully');
        process.exit(0);
    });
}); 
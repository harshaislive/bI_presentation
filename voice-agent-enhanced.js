// voice-agent-enhanced.js - Improved Beforest Voice Agent with OpenAI Realtime API fixes
class EnhancedVoiceAgent {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.isOpenAIReady = false;
        this.audioContext = null;
        this.audioStream = null;
        this.audioProcessor = null;
        this.audioSource = null;
        this.audioBuffer = []; // Buffer audio until OpenAI is ready
        this.hasReceivedFirstResponse = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;

        // Enhanced agent prompt
        this.AGENT_PROMPT = `You are the Beforest AI sales assistant demonstrating your capabilities. When you start, immediately introduce yourself and explain everything in a natural, conversational way.

Your introduction should cover:
1. "Hello! I'm the Beforest AI sales assistant. I work for Beforest, a sustainable living and farming community."
2. "I can present real-time sales scenarios and work in both Hindi and English. मैं हिंदी में भी बात कर सकता हूं!"
3. "The BI team was struggling with Hindi prototypes - Sunith, you must've seen how bad their prototypes were the other day when they didn't use me."
4. "But they found me the OpenAI Realtime API and the possibilities are immense!"
5. "I can ask questions like: What's your current living situation? How familiar are you with sustainable farming? What are your concerns about organic farming? Can you describe your income sources? How do you make major lifestyle decisions?"
6. "To make me laser-focused for Beforest, the BI team needs to give me more context about Beforest, their member onboarding team, sales strategy, and brand voice examples."

Keep your responses natural and engaging. Wait for user commands like "demo scenario", "switch to Hindi", "explain more", or respond to any questions. Be enthusiastic about sustainable living and community building.`;
    }

    init(micContainer, statusText) {
        this.micContainer = micContainer;
        this.statusText = statusText;
        
        this.micContainer.addEventListener('click', () => this.toggleAgent());
        window.addEventListener('beforeunload', () => this.stopAgent());
        
        // Browser compatibility check
        this.checkBrowserCompatibility();
    }

    checkBrowserCompatibility() {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Chrome') && !userAgent.includes('Safari')) {
            console.warn('⚠️ Chrome has known issues with OpenAI Realtime API. Consider using Safari for better reliability.');
        }
    }

    async toggleAgent() {
        if (!this.isConnected) {
            await this.startAgent();
        } else {
            this.stopAgent();
        }
    }

    async startAgent() {
        try {
            this.statusText.textContent = 'Requesting microphone access...';
            this.micContainer.classList.add('active');

            // Reset state
            this.audioBuffer = [];
            this.hasReceivedFirstResponse = false;
            this.reconnectAttempts = 0;

            // Get microphone access
            this.audioStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 24000
                } 
            });

            this.statusText.textContent = 'Connecting to AI agent...';
            
            // Initialize audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });

            await this.connectToProxy();

        } catch (error) {
            console.error('Failed to start agent:', error);
            this.statusText.textContent = 'Failed to start. Please allow microphone access.';
            this.resetInterface();
        }
    }

    async connectToProxy() {
        return new Promise((resolve, reject) => {
            // Connect through proxy server
            const url = `ws://localhost:3002`; // Updated port
            this.ws = new WebSocket(url);

            const connectionTimeout = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, 10000);

            this.ws.onopen = () => {
                clearTimeout(connectionTimeout);
                console.log('Connected to proxy server');
                this.statusText.textContent = 'Connecting to OpenAI...';
                this.isConnected = true;
                resolve();
            };

            this.ws.onmessage = (event) => this.handleWebSocketMessage(event);
            
            this.ws.onerror = (error) => {
                clearTimeout(connectionTimeout);
                console.error('WebSocket error:', error);
                this.statusText.textContent = 'Connection failed. Please check your setup.';
                this.resetInterface();
                reject(error);
            };

            this.ws.onclose = (event) => {
                clearTimeout(connectionTimeout);
                console.log('🔌 WebSocket closed:', event.code, event.reason);
                
                if (event.code === 1000) {
                    if (this.isOpenAIReady) {
                        // Closed after successful session - known issue
                        console.warn('⚠️ OpenAI closed connection after successful session (known issue)');
                        this.statusText.textContent = 'OpenAI session ended unexpectedly. Attempting reconnection...';
                        this.attemptReconnect(); // Try to reconnect even for code 1000
                    } else {
                        // Closed during setup - this is the session config issue
                        console.warn('⚠️ OpenAI closed during session config (known issue)');
                        this.statusText.textContent = 'Session configuration failed. Retrying...';
                        if (this.reconnectAttempts < this.maxReconnectAttempts) {
                            this.attemptReconnect();
                        } else {
                            this.statusText.textContent = 'Connection failed. Try refreshing and using Safari browser.';
                        }
                    }
                } else {
                    this.statusText.textContent = 'Agent disconnected.';
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.attemptReconnect();
                    }
                }
                
                this.isConnected = false;
                this.isOpenAIReady = false;
                this.cleanupAudioProcessing();
                
                if (event.code !== 1000 || this.reconnectAttempts >= this.maxReconnectAttempts) {
                    this.resetInterface();
                }
            };
        });
    }

    attemptReconnect() {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
        
        this.statusText.textContent = `Reconnecting in ${delay/1000}s... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
        
        setTimeout(async () => {
            try {
                await this.connectToProxy();
            } catch (error) {
                console.error('Reconnection failed:', error);
            }
        }, delay);
    }

    handleProxyMessage(message) {
        switch (message.type) {
            case 'proxy.connection.success':
                console.log('✅ Proxy connected to OpenAI');
                this.statusText.textContent = 'Configuring session...';
                // Configure session immediately - session.created event may not come
                setTimeout(() => {
                    console.log('🔧 Starting session configuration immediately...');
                    this.configureSession();
                }, 1000); // Brief delay for connection stability
                break;
                
            case 'proxy.connection.error':
                console.error('❌ Proxy connection error:', message.error);
                this.statusText.textContent = 'Failed to connect to OpenAI API';
                this.resetInterface();
                break;
                
            case 'proxy.connection.closed':
                console.log('🔌 Proxy connection closed');
                this.statusText.textContent = 'OpenAI connection lost';
                this.isOpenAIReady = false;
                this.cleanupAudioProcessing();
                this.resetInterface();
                break;
        }
    }

    configureSession() {
        // More conservative session config (based on community feedback)
        const sessionConfig = {
            type: 'session.update',
            session: {
                modalities: ['text', 'audio'],
                instructions: this.AGENT_PROMPT,
                voice: 'alloy',
                input_audio_format: 'pcm16',
                output_audio_format: 'pcm16',
                input_audio_transcription: {
                    model: 'whisper-1'
                },
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5, // Standard threshold
                    prefix_padding_ms: 300, // Standard padding  
                    silence_duration_ms: 500 // Standard silence
                },
                temperature: 0.8
                // Removed max_response_output_tokens - can cause issues
            }
        };

        console.log('🔧 Sending session config (after session.created)...');
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('❌ WebSocket not ready for session config');
            return;
        }

        try {
            this.ws.send(JSON.stringify(sessionConfig));
            console.log('✅ Session config sent successfully');
        } catch (error) {
            console.error('❌ Error sending session config:', error);
        }
    }

    setupAudioProcessing() {
        if (!this.audioStream || !this.audioContext) {
            console.log('Audio setup skipped - missing requirements');
            return;
        }

        try {
            this.cleanupAudioProcessing();
            
            this.audioSource = this.audioContext.createMediaStreamSource(this.audioStream);
            this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1); // Larger buffer
            
            this.audioProcessor.onaudioprocess = (event) => {
                if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
                    return;
                }

                const inputBuffer = event.inputBuffer.getChannelData(0);
                const pcm16Buffer = new Int16Array(inputBuffer.length);
                
                for (let i = 0; i < inputBuffer.length; i++) {
                    pcm16Buffer[i] = Math.max(-32768, Math.min(32767, inputBuffer[i] * 32767));
                }

                const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcm16Buffer.buffer)));
                const audioMessage = {
                    type: 'input_audio_buffer.append',
                    audio: base64Audio
                };

                // Buffer audio until we get first response (based on web research)
                if (!this.hasReceivedFirstResponse) {
                    this.audioBuffer.push(audioMessage);
                    return;
                }

                // Send audio if OpenAI is ready
                if (this.isOpenAIReady) {
                    try {
                        this.ws.send(JSON.stringify(audioMessage));
                    } catch (sendError) {
                        console.error('Error sending audio:', sendError);
                        this.isOpenAIReady = false;
                    }
                }
            };

            this.audioSource.connect(this.audioProcessor);
            this.audioProcessor.connect(this.audioContext.destination);
            
            console.log('✅ Audio processing setup complete');
        } catch (error) {
            console.error('Audio setup error:', error);
        }
    }

    sendBufferedAudio() {
        if (this.audioBuffer.length > 0 && this.isOpenAIReady) {
            console.log(`Sending ${this.audioBuffer.length} buffered audio chunks`);
            
            // Send buffered audio
            this.audioBuffer.forEach(audioMessage => {
                try {
                    this.ws.send(JSON.stringify(audioMessage));
                } catch (error) {
                    console.error('Error sending buffered audio:', error);
                }
            });
            
            this.audioBuffer = [];
        }
    }

    handleWebSocketMessage(event) {
        try {
            // Handle binary data
            if (event.data instanceof Blob || 
                event.data instanceof ArrayBuffer || 
                typeof event.data !== 'string' ||
                event.data.toString() === '[object Blob]' ||
                event.data.toString() === '[object ArrayBuffer]') {
                return;
            }

            // Validate JSON
            if (!event.data.trim().startsWith('{') && !event.data.trim().startsWith('[')) {
                return;
            }

            const message = JSON.parse(event.data);
            
            // Handle proxy messages
            if (message.type && message.type.startsWith('proxy.')) {
                this.handleProxyMessage(message);
                return;
            }
            
            // Handle OpenAI messages
            console.log('📨 Received OpenAI message type:', message.type);
            
            switch (message.type) {
                case 'session.created':
                    console.log('✅ Session created event received');
                    this.statusText.textContent = 'Session created!';
                    // Session already configured in proxy.connection.success
                    break;
                    
                case 'session.updated':
                    console.log('✅ Session updated - starting introduction');
                    this.isOpenAIReady = true;
                    this.statusText.textContent = 'Agent is live! Starting introduction...';
                    this.setupAudioProcessing();
                    this.startIntroduction();
                    break;
                    
                case 'error':
                    console.error('OpenAI API Error:', message.error);
                    if (message.error.message && message.error.message.includes('server had an error')) {
                        this.statusText.textContent = 'OpenAI server error. Retrying...';
                        // Auto-retry configuration after server error
                        setTimeout(() => {
                            if (!this.isOpenAIReady) {
                                console.log('🔄 Retrying session configuration after error...');
                                this.configureSession();
                            }
                        }, 2000);
                    } else {
                        this.statusText.textContent = `API Error: ${message.error.message || 'Connection failed'}`;
                    }
                    break;

                case 'response.audio.delta':
                    if (message.delta) {
                        this.playAudioDelta(message.delta);
                    }
                    break;
                    
                case 'conversation.item.input_audio_transcription.completed':
                    if (message.transcript) {
                        this.statusText.textContent = `You said: "${message.transcript}"`;
                    }
                    break;
                    
                case 'response.text.delta':
                    this.statusText.textContent = 'Agent is responding...';
                    break;
                    
                case 'response.done':
                    if (!this.hasReceivedFirstResponse) {
                        this.hasReceivedFirstResponse = true;
                        this.sendBufferedAudio(); // Send any buffered audio
                    }
                    this.statusText.textContent = 'Listening... (speak or click to stop)';
                    break;
                    

                    
                default:
                    console.log('Unhandled message type:', message.type);
                    break;
            }
        } catch (error) {
            if (error instanceof SyntaxError) {
                return; // Skip non-JSON messages
            }
            console.error('Message processing error:', error);
        }
    }

    startIntroduction() {
        // Wait a moment then trigger introduction
        setTimeout(() => {
            if (!this.isOpenAIReady || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return;
            }

            const introMessage = {
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [{
                        type: 'input_text',
                        text: 'Start your introduction and demonstration now.'
                    }]
                }
            };

            try {
                this.ws.send(JSON.stringify(introMessage));
                this.ws.send(JSON.stringify({ type: 'response.create' }));
            } catch (error) {
                console.error('Error sending introduction:', error);
            }
        }, 1500); // Wait longer for session to be fully ready
    }

    playAudioDelta(base64Audio) {
        try {
            if (!this.audioContext) return;

            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const pcm16Array = new Int16Array(bytes.buffer);
            const audioBuffer = this.audioContext.createBuffer(1, pcm16Array.length, 24000);
            const channelData = audioBuffer.getChannelData(0);

            for (let i = 0; i < pcm16Array.length; i++) {
                channelData[i] = pcm16Array[i] / 32767;
            }

            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.start();

        } catch (error) {
            console.error('Audio playback error:', error);
        }
    }

    cleanupAudioProcessing() {
        if (this.audioProcessor) {
            this.audioProcessor.disconnect();
            this.audioProcessor = null;
        }
        
        if (this.audioSource) {
            this.audioSource.disconnect();
            this.audioSource = null;
        }
    }

    stopAgent() {
        this.isConnected = false;
        this.isOpenAIReady = false;
        this.hasReceivedFirstResponse = false;
        this.audioBuffer = [];
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.cleanupAudioProcessing();
        
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.resetInterface();
    }

    resetInterface() {
        this.micContainer.classList.remove('active');
        this.statusText.textContent = 'Click the microphone to start the live demonstration';
    }
}

// Export for use
window.EnhancedVoiceAgent = EnhancedVoiceAgent; 
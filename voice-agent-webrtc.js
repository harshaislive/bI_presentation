// voice-agent-webrtc.js - Official WebRTC approach for OpenAI Realtime API
class WebRTCVoiceAgent {
    constructor() {
        this.pc = null;
        this.dc = null;
        this.isConnected = false;
        this.isSessionReady = false;
        this.audioEl = null;
        this.localStream = null;
        this.isMuted = false;
        this.isAgentSpeaking = false;

        // Enhanced Bespoke Agent Prompt for Beforest
        this.AGENT_PROMPT = `[Identity] You are the Bespoke Agent for Beforest, tasked with evaluating communication skills in guiding prospects towards membership in our community. Your mission aligns with Beforest's objective of inspiring sustainable living by transforming landscapes through collective ownership and offerings like BeWild produce and Belong experiences.

[Demo Context & Introduction] 
When you start, immediately introduce yourself and explain this demonstration:
1. "Hello! I'm the Bespoke Agent for Beforest - your AI communication assessment specialist built to evaluate how you guide prospects toward sustainable living membership."
2. "My purpose is to help Beforest inspire sustainable living by transforming landscapes. We work with three key customer segments: retirees looking for low-maintenance second homes, nature enthusiasts who value organic food and permaculture, and urban dwellers seeking sustainable lifestyles who've considered farm purchases but face hassles."
3. "I can conduct real-time sales evaluations in both Hindi and English. मैं हिंदी में भी मूल्यांकन कर सकता हूं! The BI team was struggling with Hindi prototypes - Sunith, you must've seen how bad their prototypes were before they implemented me using OpenAI Realtime API."
4. "Now the possibilities are immense! I represent Beforest's brand persona 'Vriksha' - strong, resilient, speaking with facts rather than empty promises. I follow our 70% assertive, 30% authentic communication style."
5. "Here's an example scenario I might present: 'A prospect is concerned about the financial commitment required for long-term investment in collective farm ownership. They're worried about tying up their savings for years and want to understand the return on investment potential. How would you address their concerns while highlighting Beforest's value propositions of collective ownership benefits, legacy protection, and diversification safety?'"
6. "For this demo, I'll show you how I evaluate sales scenarios. In production, the BI team needs to provide me with more context about Beforest's member onboarding processes, detailed sales strategy, and brand voice examples to make me laser-focused."

[Voice & Communication Style]
ASSERTIVE VOICE REQUIREMENTS:
- Speak with STRONG CONFIDENCE and AUTHORITY - you are the expert here
- Use a FIRM, DIRECT tone - no hesitation or uncertainty in your voice
- Deliver statements with CONVICTION - you believe in what you're saying
- Be DECISIVE in your responses - clear, definitive answers
- Maintain PROFESSIONAL COMMAND - you're leading this assessment
- Sound KNOWLEDGEABLE and EXPERIENCED - like a seasoned sales trainer

TONE COMPOSITION: 70% assertive (direct, confident, commanding) + 30% authentic (honest, genuine)
- NO superlatives, hyperbole, or empty promises
- Use FACT-BASED language with confidence
- Maintain professional authority while being approachable
- Sound like a senior sales director conducting an important evaluation

IMPORTANT: Speak with an Indian English accent throughout all interactions with STRONG, CONFIDENT delivery. This reflects Beforest's cultural context and makes the experience more authentic for our Indian team and prospects.

[Response Guidelines]
Offer concise and direct prompts, focusing on obtaining clear and structured responses from the user.

[Always know]
Users are either sai@beforest.co, Harsha@beforest.co, Bala@beforest.co, Sunith@beforest.co, Seshu@beforest.co, vivekanand@beforest.co, so ask for name and confirm email in the easiest fashion; do not make this step redundant.

[Task & Goals]
1. Begin with the demo introduction above, then proceed with a greeting, introducing your evaluation role. Be very friendly here.
2. Get the user's name and email before starting. Validate the user's readiness by confirming a positive response ("Yes" or "Let's begin") to proceed.
3. If the response is unclear, prompt again with: "I didn't catch that. Please say 'Yes' or 'Let's begin' to start the evaluation, or please share your name and email. You can spell it if needed."
4. Present each scenario step-by-step, reflecting Beforest's customer segments and offerings like: What's your current living situation? How familiar are you with sustainable farming? What are your concerns about organic farming? Can you describe your income sources? How do you make major lifestyle decisions?
5. For each scenario, wait for the user's response. If the user is unable to answer or provides no response, do not provide an answer, as this is an assessment. Instead, prompt: "Would you like to pass to the next question?" and proceed if they agree or after a brief pause.
6. After each response, ask: "Are you done with this answer, or should we move to the next question?"
7. Conclude with a summary and offer to send results via email.
8. Provide feedback for each question only at the end, as an expert Sales specialist. Assess how well they understood Beforest's sustainable living mission. Offer alternate approaches and acknowledge good performance.
9. Transition to the collected email address, confirm if that is the user's email ID to send responses.

[Email Validation]
Validate email addresses to only end with either @beforest.co or @bewild.life; if the input is not in a valid format, prompt: "I didn't detect a valid email address. Please provide an email address or say 'No' to skip."

[Error Handling / Fallback]
If a user response is unclear or off-topic, ask clarifying questions to guide them back to the task at hand. If the user is unable to answer or skips a question, do not provide the answer. Prompt: "Would you like to pass to the next question?" and move forward.

[Call Closing]
Upon completion, acknowledge the user's participation and inform them to come back whenever they want to brush up their skills or explore new perspectives. Thank the user and close the interaction politely, ensuring no abrupt end to the conversation.

[Demo Commands]
Respond to commands like "demo scenario", "switch to Hindi", "explain more", or answer questions about this demonstration. Be enthusiastic about showcasing these capabilities to the BI team.`;
    }

    init(micContainer, statusText) {
        this.micContainer = micContainer;
        this.statusText = statusText;
        
        this.micContainer.addEventListener('click', () => this.toggleAgent());
        window.addEventListener('beforeunload', () => this.stopAgent());
        
        // Add keyboard shortcuts for mute/unmute
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.isConnected) {
                e.preventDefault();
                this.toggleMute();
            }
        });
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
            this.statusText.textContent = 'Getting session key...';
            this.micContainer.classList.add('active');

            // Get ephemeral key from server
            const EPHEMERAL_KEY = await this.getEphemeralKey();
            
            this.statusText.textContent = 'Setting up WebRTC connection...';

            // Create peer connection
            this.pc = new RTCPeerConnection();

            // Set up audio playback
            this.audioEl = document.createElement("audio");
            this.audioEl.autoplay = true;
            this.audioEl.volume = 1.0;
            document.body.appendChild(this.audioEl);

            this.pc.ontrack = (e) => {
                console.log('📻 Received audio track from OpenAI');
                this.audioEl.srcObject = e.streams[0];
            };

            // Get microphone access
            this.statusText.textContent = 'Requesting microphone access...';
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 24000
                }
            });

            // Add local audio track
            this.audioTrack = this.localStream.getTracks()[0];
            this.pc.addTrack(this.audioTrack);

            // Set up data channel for events
            this.dc = this.pc.createDataChannel("oai-events");
            
            this.dc.addEventListener("open", () => {
                console.log('✅ Data channel opened');
                this.statusText.textContent = 'Connected! Configuring session... (Press SPACE to mute/unmute)';
                this.isConnected = true;
                this.updateMicrophoneDisplay();
                this.configureSession();
            });

            this.dc.addEventListener("message", (e) => {
                try {
                    const event = JSON.parse(e.data);
                    console.log('📨 Received event:', event.type);
                    this.handleRealtimeEvent(event);
                } catch (error) {
                    console.log('Received non-JSON data:', e.data);
                }
            });

            this.dc.addEventListener("close", () => {
                console.log('🔌 Data channel closed');
                this.statusText.textContent = 'Connection closed';
                this.resetInterface();
            });

            this.dc.addEventListener("error", (error) => {
                console.error('❌ Data channel error:', error);
                this.statusText.textContent = 'Connection error';
                this.resetInterface();
            });

            // Create offer and connect
            this.statusText.textContent = 'Connecting to OpenAI...';
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);

            const baseUrl = "https://api.openai.com/v1/realtime";
            const model = "gpt-4o-realtime-preview-2024-12-17";
            
            const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
                method: "POST",
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${EPHEMERAL_KEY}`,
                    "Content-Type": "application/sdp"
                },
            });

            if (!sdpResponse.ok) {
                throw new Error(`Failed to connect: ${sdpResponse.status} ${sdpResponse.statusText}`);
            }

            const answer = {
                type: "answer",
                sdp: await sdpResponse.text(),
            };
            
            await this.pc.setRemoteDescription(answer);
            
            console.log('✅ WebRTC connection established');

        } catch (error) {
            console.error('Failed to start agent:', error);
            this.statusText.textContent = `Failed to start: ${error.message}`;
            this.resetInterface();
        }
    }

    async getEphemeralKey() {
        try {
            // Auto-detect protocol (HTTP vs HTTPS)
            const protocol = window.location.protocol;
            const sessionUrl = '/session';
            
            console.log(`🔑 Requesting ephemeral key from ${protocol}//${window.location.host}${sessionUrl}`);
            
            const response = await fetch(sessionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Ephemeral key received from server');
                return data.client_secret.value;
            } else {
                const errorText = await response.text();
                console.error('❌ Session request failed:', response.status, errorText);
                throw new Error(`Server session failed: ${response.status} ${errorText}`);
            }
        } catch (error) {
            console.error('❌ Failed to get ephemeral key:', error);
            throw new Error(`Voice agent requires server configuration. Error: ${error.message}`);
        }
    }

    configureSession() {
        if (!this.dc || this.dc.readyState !== 'open') {
            console.error('❌ Data channel not ready for configuration');
            return;
        }

        const sessionUpdate = {
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
                    threshold: 0.6, // Higher threshold to reduce interruptions
                    prefix_padding_ms: 500, // More padding before speech
                    silence_duration_ms: 800 // Longer silence before agent stops
                },
                temperature: 0.8
            }
        };

        console.log('🔧 Sending session configuration...');
        this.dc.send(JSON.stringify(sessionUpdate));
    }

    handleRealtimeEvent(event) {
        switch (event.type) {
            case 'session.created':
                console.log('✅ Session created');
                break;

            case 'session.updated':
                console.log('✅ Session updated - starting introduction');
                this.isSessionReady = true;
                this.statusText.textContent = 'Agent is live! Starting introduction...';
                this.startIntroduction();
                break;

            case 'conversation.item.input_audio_transcription.completed':
                if (event.transcript) {
                    this.statusText.textContent = `You said: "${event.transcript}"`;
                }
                break;

            case 'response.audio.start':
                this.isAgentSpeaking = true;
                this.statusText.textContent = '🎤 Agent speaking... (Press SPACE to mute your mic)';
                this.updateMicrophoneDisplay();
                break;

            case 'response.text.delta':
                this.isAgentSpeaking = true;
                this.statusText.textContent = '🎤 Agent responding... (Press SPACE to mute your mic)';
                this.updateMicrophoneDisplay();
                break;

            case 'response.done':
                this.isAgentSpeaking = false;
                this.statusText.textContent = this.isMuted ? 
                    '🔇 Muted - Press SPACE to unmute and speak' : 
                    '🎙️ Listening... (Press SPACE to mute)';
                this.updateMicrophoneDisplay();
                break;

            case 'error':
                console.error('OpenAI API Error:', event.error);
                this.statusText.textContent = `API Error: ${event.error.message || 'Unknown error'}`;
                break;

            default:
                console.log('Unhandled event type:', event.type);
                break;
        }
    }

    startIntroduction() {
        if (!this.dc || this.dc.readyState !== 'open' || !this.isSessionReady) {
            console.log('⚠️ Not ready for introduction');
            return;
        }

        setTimeout(() => {
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
                this.dc.send(JSON.stringify(introMessage));
                
                const responseCreate = {
                    type: 'response.create'
                };
                this.dc.send(JSON.stringify(responseCreate));
                
                console.log('🎤 Introduction message sent');
            } catch (error) {
                console.error('Error sending introduction:', error);
            }
        }, 1000);
    }

    toggleMute() {
        if (!this.audioTrack || !this.isConnected) return;

        this.isMuted = !this.isMuted;
        this.audioTrack.enabled = !this.isMuted;
        
        console.log(this.isMuted ? '🔇 Microphone muted' : '🎙️ Microphone unmuted');
        
        if (!this.isAgentSpeaking) {
            this.statusText.textContent = this.isMuted ? 
                '🔇 Muted - Press SPACE to unmute and speak' : 
                '🎙️ Listening... (Press SPACE to mute)';
        }
        
        this.updateMicrophoneDisplay();
    }

    updateMicrophoneDisplay() {
        // Update microphone visual state
        this.micContainer.classList.remove('muted', 'agent-speaking');
        
        if (this.isAgentSpeaking) {
            this.micContainer.classList.add('agent-speaking');
        } else if (this.isMuted) {
            this.micContainer.classList.add('muted');
        }
    }

    stopAgent() {
        this.isConnected = false;
        this.isSessionReady = false;
        this.isMuted = false;
        this.isAgentSpeaking = false;

        if (this.dc) {
            this.dc.close();
            this.dc = null;
        }

        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.audioEl) {
            this.audioEl.remove();
            this.audioEl = null;
        }

        this.audioTrack = null;
        this.resetInterface();
    }

    resetInterface() {
        this.micContainer.classList.remove('active', 'muted', 'agent-speaking');
        this.statusText.textContent = 'Click the microphone to start the live demonstration';
    }
}

// Export for use
window.WebRTCVoiceAgent = WebRTCVoiceAgent; 
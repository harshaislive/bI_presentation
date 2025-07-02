// voice-control.js
// Simple voice navigation using OpenAI Realtime API
// Based on documentation and community findings about message formats

(function () {
  const MODEL = "gpt-4o-realtime-preview-2024-12-17";
  const VOICE = "echo";
  const SLIDES = [
    "slide0.html", "slide1.html", "slide2.html", "slide3.html", 
    "slide4.html", "slide5.html", "slide6.html", "slide6a.html",
    "slide7.html", "slide8.html", "slide9.html"
  ];

  // Navigation helpers
  function currentIndex() {
    const path = window.location.pathname.split("/").pop();
    return SLIDES.indexOf(path);
  }
  function goTo(idx) {
    if (idx < 0 || idx >= SLIDES.length) return;
    window.location.href = SLIDES[idx];
  }
  function next() {
    const idx = currentIndex();
    goTo((idx + 1) % SLIDES.length);
  }
  function prev() {
    const idx = currentIndex();
    goTo((idx - 1 + SLIDES.length) % SLIDES.length);
  }
  function controller() {
    window.location.href = "presenter.html";
  }

  function handleCommand(text) {
    console.log("[voice-control] Processing command:", text);
    const t = text.toLowerCase().trim();
    
    if (t.includes("next") || t.includes("forward")) return next();
    if (t.includes("prev") || t.includes("previous") || t.includes("back")) return prev();
    if (t.includes("controller") || t.includes("home") || t.includes("menu") || t.includes("presenter")) return controller();
    
    const slideMatch = t.match(/slide\s*(\d+)/);
    if (slideMatch) {
      const n = parseInt(slideMatch[1], 10);
      if (n >= 0 && n < SLIDES.length) return goTo(n);
    }
  }

  // Get ephemeral key from server
  async function getEphemeralKey() {
    try {
      const response = await fetch('/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Session creation failed: ${response.status}`);
      }

      const session = await response.json();
      return session.client_secret?.value || session.client_secret;
    } catch (error) {
      console.error('[voice-control] Failed to get ephemeral key:', error);
      throw error;
    }
  }

  async function startRealtime() {
    try {
      console.log('[voice-control] Getting session key...');
      
      // Get ephemeral key from server
      const EPHEMERAL_KEY = await getEphemeralKey();
      console.log('[voice-control] Got ephemeral key');

      // Get mic
      const mic = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 24000
        }
      });

      // Create peer connection
      const pc = new RTCPeerConnection();
      pc.addTrack(mic.getTracks()[0]);

      // Set up data channel
      const dc = pc.createDataChannel("oai-events");
      
      dc.addEventListener("open", () => {
        console.log("[voice-control] Data channel opened");
        
        // Send session update to ensure transcription is enabled
        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: "You are a slide navigation assistant. Listen for navigation commands like 'next', 'previous', 'slide 3', or 'controller'. Respond briefly to acknowledge commands.",
            voice: VOICE,
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: {
              model: "whisper-1"
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            }
          }
        }));
      });

      dc.addEventListener("message", (e) => {
        try {
          const msg = JSON.parse(e.data);
          console.log("[voice-control] Message:", msg.type);

          // Handle various transcript message types
          if (msg.type === "conversation.item.input_audio_transcription.completed") {
            if (msg.transcript) {
              console.log("[voice-control] Transcript completed:", msg.transcript);
              handleCommand(msg.transcript);
            }
          } else if (msg.type === "conversation.item.created" && msg.item?.content) {
            // Check if this contains transcribed text
            const content = msg.item.content;
            if (Array.isArray(content)) {
              const textContent = content.find(c => c.type === "text" || c.type === "input_text");
              if (textContent?.text) {
                console.log("[voice-control] Text found:", textContent.text);
                handleCommand(textContent.text);
              }
              // Also check for transcript in audio content
              const audioContent = content.find(c => c.type === "input_audio");
              if (audioContent?.transcript) {
                console.log("[voice-control] Audio transcript:", audioContent.transcript);
                handleCommand(audioContent.transcript);
              }
            }
          } else if (msg.type === "error") {
            console.error("[voice-control] OpenAI API Error:", msg.error);
          }
        } catch (err) {
          // Not JSON, ignore
        }
      });

      // Set up audio playback for responses
      pc.ontrack = (e) => {
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.srcObject = e.streams[0];
        audio.style.display = "none";
        audio.volume = 0.3; // Lower volume for responses
        document.body.appendChild(audio);
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send to OpenAI
      const answerResp = await fetch(`https://api.openai.com/v1/realtime?model=${MODEL}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!answerResp.ok) {
        console.error("[voice-control] Failed to get answer", await answerResp.text());
        return;
      }

      const answer = await answerResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answer });

      console.log("[voice-control] Connected! Say 'next', 'previous', 'slide 3', or 'controller'");
      
      // Add visual indicator
      const indicator = document.createElement("div");
      indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #4CAF50;
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      indicator.textContent = "🎤 Voice control active";
      document.body.appendChild(indicator);

    } catch (err) {
      console.error("[voice-control] Error:", err);
      
      // Show error indicator
      const errorIndicator = document.createElement("div");
      errorIndicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #f44336;
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      errorIndicator.textContent = "❌ Voice control failed";
      document.body.appendChild(errorIndicator);
    }
  }

  // Start on page load
  window.addEventListener("load", () => {
    if (!navigator.mediaDevices || !window.RTCPeerConnection) {
      console.warn("[voice-control] WebRTC not supported");
      return;
    }
    
    // Small delay to ensure page is fully loaded
    setTimeout(startRealtime, 500);
  });
})(); 
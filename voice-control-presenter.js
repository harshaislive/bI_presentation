// voice-control-presenter.js
// Voice control for presenter mode - controls iframe navigation

(function () {
  const MODEL = "gpt-4o-realtime-preview-2024-12-17";
  const VOICE = "echo";

  function handleCommand(text) {
    console.log("[voice-control] Processing command:", text);
    const t = text.toLowerCase().trim();
    
    if (t.includes("next") || t.includes("forward")) {
      window.nextSlide();
    } else if (t.includes("prev") || t.includes("previous") || t.includes("back")) {
      window.previousSlide();
    } else if (t.includes("controller") || t.includes("home") || t.includes("menu") || t.includes("presenter")) {
      // Stay on presenter page
      console.log("[voice-control] Already on presenter page");
    } else {
      const slideMatch = t.match(/slide\s*(\d+)/);
      if (slideMatch) {
        const n = parseInt(slideMatch[1], 10);
        if (n >= 0 && n <= 9) window.goToSlide(n);
      }
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
        const voiceStatusEl = document.getElementById('voiceStatus');
        if (voiceStatusEl) voiceStatusEl.classList.remove('inactive');
        
        // Send session update
        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: "You are a slide navigation assistant for presenter mode. Listen for navigation commands like 'next', 'previous', 'slide 3'. Respond briefly to acknowledge commands.",
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
          
          if (msg.type === "conversation.item.input_audio_transcription.completed" && msg.transcript) {
            console.log("[voice-control] Transcript:", msg.transcript);
            handleCommand(msg.transcript);
          } else if (msg.type === "conversation.item.created" && msg.item?.content) {
            const content = msg.item.content;
            if (Array.isArray(content)) {
              const textContent = content.find(c => c.type === "text" || c.type === "input_text");
              if (textContent?.text) handleCommand(textContent.text);
              
              const audioContent = content.find(c => c.type === "input_audio");
              if (audioContent?.transcript) handleCommand(audioContent.transcript);
            }
          } else if (msg.type === "error") {
            console.error("[voice-control] OpenAI API Error:", msg.error);
            const voiceStatusEl = document.getElementById('voiceStatus');
            if (voiceStatusEl) voiceStatusEl.classList.add('inactive');
          }
        } catch (err) {
          // Not JSON
        }
      });

      // Set up audio playback
      pc.ontrack = (e) => {
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.srcObject = e.streams[0];
        audio.style.display = "none";
        audio.volume = 0.2; // Lower volume for responses in presenter mode
        document.body.appendChild(audio);
      };

      // Create offer and connect
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const answerResp = await fetch(`https://api.openai.com/v1/realtime?model=${MODEL}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!answerResp.ok) {
        console.error("[voice-control] Failed to get answer");
        const voiceStatusEl = document.getElementById('voiceStatus');
        if (voiceStatusEl) voiceStatusEl.classList.add('inactive');
        return;
      }

      const answer = await answerResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answer });

      console.log("[voice-control] Connected! Voice commands active in presenter mode");

    } catch (err) {
      console.error("[voice-control] Error:", err);
      const voiceStatusEl = document.getElementById('voiceStatus');
      if (voiceStatusEl) voiceStatusEl.classList.add('inactive');
    }
  }

  // Start on page load
  window.addEventListener("load", () => {
    if (!navigator.mediaDevices || !window.RTCPeerConnection) {
      console.warn("[voice-control] WebRTC not supported");
      const voiceStatusEl = document.getElementById('voiceStatus');
      if (voiceStatusEl) voiceStatusEl.classList.add('inactive');
      return;
    }
    
    // Small delay to ensure page is fully loaded
    setTimeout(startRealtime, 500);
  });
})(); 
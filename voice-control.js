// voice-control.js
// Simple voice navigation using OpenAI Realtime API
// Based on documentation and community findings about message formats

(function () {
  const MODEL = "gpt-4o-mini-realtime";
  const VOICE = "echo";
  const SLIDES = [
    "slide1.html", "slide2.html", "slide3.html", 
    "slide4.html", "slide5.html", "slide6.html", "slide7.html"
  ];

  if (typeof OPENAI_API_KEY !== "string" || !OPENAI_API_KEY.startsWith("sk-")) {
    console.warn("[voice-control] Please set window.OPENAI_API_KEY");
    return;
  }

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
    window.location.href = "index.html";
  }

  function handleCommand(text) {
    console.log("[voice-control] Processing command:", text);
    const t = text.toLowerCase().trim();
    
    if (t.includes("next") || t.includes("forward")) return next();
    if (t.includes("prev") || t.includes("previous") || t.includes("back")) return prev();
    if (t.includes("controller") || t.includes("home") || t.includes("menu") || t.includes("index")) return controller();
    
    const slideMatch = t.match(/slide\s*(\d+)/);
    if (slideMatch) {
      const n = parseInt(slideMatch[1], 10);
      if (n >= 1 && n <= SLIDES.length) return goTo(n - 1);
    }
  }

  async function startRealtime() {
    try {
      // 1. Create session
      const sessResp = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ 
          model: MODEL, 
          voice: VOICE,
          modalities: ["text", "audio"],
          instructions: "You are a slide navigation assistant. Listen for navigation commands like 'next', 'previous', 'slide 3', or 'controller'. Respond with just the command you heard.",
          input_audio_transcription: {
            model: "whisper-1"
          }
        }),
      });

      if (!sessResp.ok) {
        console.error("[voice-control] Session creation failed", await sessResp.text());
        return;
      }

      const session = await sessResp.json();
      const EPHEMERAL_KEY = session.client_secret?.value || session.client_secret;

      // 2. Get mic
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 3. Create peer connection
      const pc = new RTCPeerConnection();
      pc.addTrack(mic.getTracks()[0]);

      // 4. Set up data channel
      const dc = pc.createDataChannel("oai-events");
      
      dc.addEventListener("open", () => {
        console.log("[voice-control] Data channel opened");
        
        // Send session update to ensure transcription is enabled
        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            input_audio_transcription: {
              model: "whisper-1"
            },
            instructions: "Transcribe navigation commands"
          }
        }));
      });

      dc.addEventListener("message", (e) => {
        try {
          const msg = JSON.parse(e.data);
          console.log("[voice-control] Message:", msg.type, msg);

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
          } else if (msg.type === "response.text.delta" && msg.delta) {
            // Model might respond with text
            console.log("[voice-control] Response delta:", msg.delta);
          } else if (msg.type === "response.audio_transcript.delta" && msg.delta) {
            // Or with audio transcript
            console.log("[voice-control] Audio response:", msg.delta);
          }
        } catch (err) {
          // Not JSON, ignore
        }
      });

      // 5. Set up audio playback for responses
      pc.ontrack = (e) => {
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.srcObject = e.streams[0];
        audio.style.display = "none";
        document.body.appendChild(audio);
      };

      // 6. Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 7. Send to OpenAI
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
    }
  }

  // Start on page load
  window.addEventListener("load", () => {
    if (!navigator.mediaDevices || !window.RTCPeerConnection) {
      console.warn("[voice-control] WebRTC not supported");
      return;
    }
    startRealtime();
  });
})(); 
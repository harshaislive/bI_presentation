// voice-control-presenter.js
// Voice control for presenter mode - controls iframe navigation

(function () {
  const MODEL = "gpt-4o-mini-realtime";
  const VOICE = "echo";

  if (typeof OPENAI_API_KEY !== "string" || !OPENAI_API_KEY.startsWith("sk-")) {
    console.warn("[voice-control] Please set window.OPENAI_API_KEY");
    return;
  }

  function handleCommand(text) {
    console.log("[voice-control] Processing command:", text);
    const t = text.toLowerCase().trim();
    
    if (t.includes("next") || t.includes("forward")) {
      window.nextSlide();
    } else if (t.includes("prev") || t.includes("previous") || t.includes("back")) {
      window.previousSlide();
    } else if (t.includes("controller") || t.includes("home") || t.includes("menu") || t.includes("index")) {
      window.location.href = "index.html";
    } else {
      const slideMatch = t.match(/slide\s*(\d+)/);
      if (slideMatch) {
        const n = parseInt(slideMatch[1], 10);
        if (n >= 1 && n <= 8) window.goToSlide(n - 1);
      }
    }
  }

  async function startRealtime() {
    try {
      // Create session
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
          instructions: "You are a slide navigation assistant. Listen for navigation commands like 'next', 'previous', 'slide 3', or 'controller'. Respond briefly.",
          input_audio_transcription: {
            model: "whisper-1"
          }
        }),
      });

      if (!sessResp.ok) {
        console.error("[voice-control] Session creation failed", await sessResp.text());
        document.getElementById('voiceStatus').classList.add('inactive');
        return;
      }

      const session = await sessResp.json();
      const EPHEMERAL_KEY = session.client_secret?.value || session.client_secret;

      // Get mic
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create peer connection
      const pc = new RTCPeerConnection();
      pc.addTrack(mic.getTracks()[0]);

      // Set up data channel
      const dc = pc.createDataChannel("oai-events");
      
      dc.addEventListener("open", () => {
        console.log("[voice-control] Data channel opened");
        document.getElementById('voiceStatus').classList.remove('inactive');
        
        // Send session update
        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            input_audio_transcription: {
              model: "whisper-1"
            }
          }
        }));
      });

      dc.addEventListener("message", (e) => {
        try {
          const msg = JSON.parse(e.data);
          
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
        audio.volume = 0.3; // Lower volume for responses
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
        document.getElementById('voiceStatus').classList.add('inactive');
        return;
      }

      const answer = await answerResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answer });

      console.log("[voice-control] Connected! Voice commands active");

    } catch (err) {
      console.error("[voice-control] Error:", err);
      document.getElementById('voiceStatus').classList.add('inactive');
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
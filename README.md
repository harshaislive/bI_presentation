# Beforest Voice Agent Presentation

AI-powered voice presentation system with enhanced OpenAI Realtime API integration.

## 🚀 Quick Start

```bash
# Install dependencies (first time only)
npm install

# Start the presentation server
npm start
```

Then open your browser to: **http://localhost:3001**

## 🎙️ Enhanced Voice Agent Features

Based on [OpenAI Community research](https://community.openai.com/t/is-anyone-experiencing-websocket-realtime-error-on-chrome-browser/1091793), this implementation includes:

- ✅ **Browser Compatibility Warnings** (Chrome has known issues, Safari recommended)
- ✅ **Connection Resilience** (Handles code 1000 disconnections)
- ✅ **Audio Buffering** (Prevents premature audio sending)
- ✅ **Auto-Reconnection** (Recovers from dropped connections)
- ✅ **Enhanced Error Handling** (Specific OpenAI API error responses)

## 📋 Core Features

- ✅ **Real OpenAI Voice AI** (no browser TTS)
- ✅ **Bilingual Support** (Hindi & English)
- ✅ **Live Voice Interaction** 
- ✅ **Professional Presentation UI**
- ✅ **Beforest Brand Compliant**
- ✅ **Consolidated Architecture** (Single enhanced JS file)

## 🔧 Technical Architecture

**Streamlined Setup:**
- **Single presentation file**: `presenter.html` (no controller needed)
- **Enhanced voice agent**: `voice-agent-enhanced.js` (consolidated functionality)
- **Proxy server**: `server.js` (handles OpenAI connections)
- **Static file serving** for slides 1-8
- Runs on `localhost:3001`

## 📖 Usage

1. Run `npm start` 
2. Open **http://localhost:3001** (main presentation interface)
3. Navigate through slides 1-8 using:
   - **Keyboard**: Arrow keys or numbers 1-8
   - **Voice**: Say "next", "previous", "slide 5"
   - **Click**: Navigation buttons
4. **Slide 8**: Click microphone for enhanced AI agent demo

## 🎯 Enhanced Agent Capabilities

- **Smart Introduction**: Automatically starts after session setup
- **Connection Recovery**: Handles OpenAI API disconnections gracefully  
- **Audio Buffering**: Prevents connection issues from premature audio
- **Error Resilience**: Specific handling for known OpenAI API issues
- **Browser Warnings**: Alerts about Chrome compatibility issues

## ⚠️ Known Issues & Solutions

Based on OpenAI Community feedback:

- **Chrome Browser**: Has WebSocket connection issues - **Use Safari for best results**
- **Code 1000 Disconnections**: Normal closure after session update - handled with auto-reconnection
- **Regional Issues**: Some networks/regions have connectivity problems
- **Audio Timing**: Resolved with audio buffering until first response

## 🔑 Environment Variables

Create `.env` file (optional, defaults provided):
```
OPENAI_API_KEY=your_api_key_here
PORT=3001
```

---

**Created by Beforest BI Team**  
*Enhanced with OpenAI Community Research*  
*Powered by OpenAI Realtime API* 
# 🚀 BI Presentation Deployment Guide

## Production Deployment Commands

### Quick Start Commands
```bash
# Clone repository
git clone https://github.com/harshaislive/bI_presentation.git
cd bI_presentation

# Install dependencies
npm install

# Start production server (for voice agent features)
npm run prod

# Alternative: Serve static files only
npm run serve
```

## Deployment Options

### Option 1: Full Stack with Voice Agent (Recommended)
```bash
# Production server with OpenAI integration
npm run prod
```
- Starts server on port 3000
- Includes voice agent functionality
- Requires OpenAI API key configuration

### Option 2: Static File Server
```bash
# Simple HTTP server for presentation only
npm run serve
```
- Serves on port 8080
- No voice agent features
- Faster for basic presentation needs

### Option 3: Development Mode
```bash
# Development with auto-reload
npm run dev
```
- Hot reload on file changes
- Full debugging capabilities

## Environment Setup

### 1. OpenAI API Configuration
Create a `.env` file in the project root:
```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
NODE_ENV=production
```

### 2. Server Requirements
- **Node.js**: v16+ required
- **npm**: v8+ required
- **Memory**: 512MB minimum
- **Storage**: 100MB

### 3. Port Configuration
- **Development**: 3000 (voice agent server)
- **Static Serve**: 8080 (presentation only)
- **Production**: Configurable via PORT env variable

## Production Hosting

### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod
```

### Heroku Deployment
```bash
# Create Heroku app
heroku create your-app-name

# Set environment variables
heroku config:set OPENAI_API_KEY=your_key_here

# Deploy
git push heroku main
```

### AWS/DigitalOcean/VPS
```bash
# Install PM2 for process management
npm install -g pm2

# Start with PM2
pm2 start npm --name "bi-presentation" -- run prod

# Auto-restart on server reboot
pm2 startup
pm2 save
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "run", "prod"]
```

## Usage Instructions

### Presentation Navigation
- **Keyboard**: Press 1-9, 0 for direct slide navigation
- **Arrow Keys**: ← → for previous/next
- **Voice Commands**: "next", "previous", "slide 3"

### Voice Agent Demo (Slide 8)
1. Ensure OpenAI API key is configured
2. Click microphone icon to start
3. Press SPACE to mute/unmute during conversation
4. Works in Chrome/Safari (WebRTC required)

### File Structure
```
presenter.html          # Main presentation controller
slide1.html - slide9.html # Individual slides
voice-agent-webrtc.js   # Voice agent implementation
server-session.js       # OpenAI session server
fonts/                  # ABC Arizona font files
```

## Troubleshooting

### Common Issues
1. **Voice agent not working**: Check OpenAI API key and browser compatibility
2. **Fonts not loading**: Ensure font files are in `/fonts/` directory
3. **Server won't start**: Check if port 3000 is available

### Browser Compatibility
- ✅ **Chrome**: Full support
- ✅ **Safari**: Full support  
- ⚠️ **Firefox**: Limited WebRTC support
- ❌ **IE/Edge Legacy**: Not supported

## Security Notes
- Never commit `.env` file with API keys
- Use environment variables in production
- Restrict CORS origins for production deployment
- Enable HTTPS for voice agent features

## Performance Tips
- Use `npm run serve` for presentation-only demos
- Enable gzip compression on production server
- Cache static assets (fonts, CSS)
- Use CDN for global deployments

---
**BI Team Excellence • Beforest** 🚀 
# 🚀 BODTUM Live QR Code Survey & Instant Polling System

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/ozlphrt/bodtum-live-survey)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ozlphrt/bodtum-live-survey)

A real-time, interactive audience polling and live survey platform (similar to Slido and Mentimeter). Participants simply **scan the QR code** on their smartphones to vote, and results populate immediately on the presenter's screen with zero latency!

---

## ⚡ Instant 1-Click Live Executable URL

You can run this full live survey in the cloud without installing anything on your device:

1. **Option 1: GitHub Codespaces (1-Click Executable Cloud)**  
   Click the **[Open in GitHub Codespaces](https://codespaces.new/ozlphrt/bodtum-live-survey)** button above. GitHub will automatically spin up a cloud VM, start the server, and forward public port `3000` to a live executable HTTPS URL that anyone on the web can access!

2. **Option 2: 100% Free 24/7 Cloud Host (Render)**  
   Click the **[Deploy to Render](https://render.com/deploy?repo=https://github.com/ozlphrt/bodtum-live-survey)** button above to get a permanent live public URL (e.g. `https://bodtum-live-survey.onrender.com`).

---

## 🌟 Key Features

1. **📱 Scan & Vote (No App or Login Required)**:
   - Dynamic high-resolution QR code generated on the fly.
   - Automatically detects your local network IP (e.g. `http://192.168.1.xxx:3000/vote`) so any mobile phone connected to the same Wi-Fi can scan and answer immediately.

2. **⚡ Instant Zero-Latency Live Results**:
   - Built on WebSockets (`Socket.IO`). Every time a participant taps an option or rates, results update immediately on the presenter screen.
   - Animated percentage bars, vote counters, leading choice badges, and pleasant audio feedback chime.

3. **📊 Multiple Question Formats**:
   - **Multiple Choice Polls**: Real-time bar distributions and lead badges.
   - **1 to 5 Star Ratings**: Live calculated average rating (e.g. `4.8 / 5.0`) with star breakdown.
   - **Live Word Stream / Ideas**: Live keywords pills and audience comment stream.

4. **🎛️ Live Presenter Controls**:
   - **Next / Previous Question**: Synchronously switches the question on all mobile devices at once.
   - **Lock / Unlock Voting**: Temporarily freeze voting when discussion starts.
   - **Add Questions on the Fly**: Presenter modal allows creating questions live.
   - **Reset Results**: Instantly clear results to run the survey again.
   - **Built-in Mobile Simulator**: Test voter and presenter screens side-by-side in one browser window.

---

## 🚀 How to Run

1. Open your terminal in this directory:
   ```bash
   npm start
   ```

2. Open the **Presenter Screen** on your computer, projector, or display:
   ```
   http://localhost:3000
   ```

3. **Participants Join**:
   - Scan the QR code displayed on the screen with any phone camera, OR
   - Visit the link shown below the QR code (e.g., `http://192.168.1.110:3000/vote`).

---

## 🌐 Running for Remote or Public Internet Audiences

If your audience is not on the same Wi-Fi network, you can expose the local server in seconds using any free tunnel:

### Option A: Cloudflare Tunnel (Free, no account needed)
```bash
npx untun@latest tunnel http://localhost:3000
```
or
```bash
cloudflared tunnel --url http://localhost:3000
```

### Option B: LocalTunnel
```bash
npx localtunnel --port 3000
```

The QR code will automatically work for everyone around the world!

---

## 📁 File Structure

- [server.js](file:///c:/Users/ozalp/Code/AntiGravity/BODTUM/Usage%20survey/server.js): Express & Socket.IO server, IP detector, QR generator, and real-time state engine.
- [public/index.html](file:///c:/Users/ozalp/Code/AntiGravity/BODTUM/Usage%20survey/public/index.html): Host / Presenter big screen dashboard with QR code and live charts.
- [public/vote.html](file:///c:/Users/ozalp/Code/AntiGravity/BODTUM/Usage%20survey/public/vote.html): Mobile-first participant voting interface.
- [public/style.css](file:///c:/Users/ozalp/Code/AntiGravity/BODTUM/Usage%20survey/public/style.css): Dark-mode glassmorphic styling and chart animations.
- [public/app.js](file:///c:/Users/ozalp/Code/AntiGravity/BODTUM/Usage%20survey/public/app.js): Presenter-side logic and Web Audio synthesizer.
- [public/vote.js](file:///c:/Users/ozalp/Code/AntiGravity/BODTUM/Usage%20survey/public/vote.js): Voter-side reactive voting logic and state persistence.

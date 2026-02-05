# Clash Strategy - Real-Time 1v1 Multiplayer Game

A skill-based real-time strategy game inspired by Clash Royale, built for friends to play online.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          GAME ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐                      ┌─────────────────────┐   │
│  │   Frontend      │    WebSocket         │   Backend Server    │   │
│  │   (GitHub Pages)│◄──────────────────►  │   (Railway/Render)  │   │
│  │                 │                       │                     │   │
│  │  • Three.js 3D  │   State @ 20Hz       │  • Game Simulation  │   │
│  │  • Card UI      │◄─────────────────    │  • Anti-cheat       │   │
│  │  • Interpolation│                       │  • Matchmaking      │   │
│  │                 │   Player Inputs       │                     │   │
│  │                 │─────────────────►    │                     │   │
│  └─────────────────┘                      └─────────────────────┘   │
│                                                                      │
│  Key Design Decisions:                                              │
│  • Server-authoritative: Server runs all game logic                 │
│  • 20 tick/sec: Balance between responsiveness and bandwidth        │
│  • Client interpolation: Smooth 60fps rendering from 20Hz updates   │
│  • Room-based: Share URL to play with friends                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
game/
├── shared/                 # Shared between client and server
│   └── constants.js        # Cards, arena, timing constants
│
├── backend/                # Node.js game server
│   ├── src/
│   │   ├── index.js        # Entry point, Socket.IO setup
│   │   ├── GameRoom.js     # Match lifecycle management
│   │   └── GameEngine.js   # Core game simulation
│   ├── package.json
│   └── railway.json        # Railway deployment config
│
├── frontend/               # Browser client
│   ├── src/
│   │   ├── main.js         # Entry point
│   │   ├── core/
│   │   │   ├── GameRenderer.js    # Three.js rendering
│   │   │   └── NetworkManager.js  # Socket.IO client
│   │   ├── game/
│   │   │   └── GameState.js       # State interpolation
│   │   └── ui/
│   │       └── UIController.js    # HTML UI management
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
└── .github/workflows/      # CI/CD
    └── deploy-frontend.yml # GitHub Pages deployment
```

## Quick Start (Local Development)

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Start Backend Server

```bash
cd backend
npm run dev
```

Server will start at `http://localhost:3000`

### 3. Start Frontend Dev Server

```bash
cd frontend
npm run dev
```

Frontend will open at `http://localhost:5173`

### 4. Play!

1. Open two browser windows
2. Enter the same room code (or leave empty for random)
3. Click "Play" in both windows
4. Game starts when both players connect!

## Deployment Guide

### Deploy Backend to Railway

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Deploy**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli

   # Login
   railway login

   # Create new project
   cd backend
   railway init

   # Deploy
   railway up
   ```

3. **Get Server URL**
   - Railway will give you a URL like `https://your-app.railway.app`
   - Copy this URL

4. **Set Environment Variable (optional)**
   ```bash
   railway variables set CORS_ORIGIN=https://your-username.github.io
   ```

### Deploy Backend to Render (Alternative)

1. Go to [render.com](https://render.com)
2. Create new "Web Service"
3. Connect your GitHub repo
4. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`
5. Deploy!

### Deploy Frontend to GitHub Pages

1. **Update Server URL**

   Edit `frontend/src/main.js`:
   ```javascript
   const SERVER_URL = import.meta.env.DEV
     ? 'http://localhost:3000'
     : 'https://your-app.railway.app'; // Your deployed server URL
   ```

2. **Update Base Path**

   Edit `frontend/vite.config.js`:
   ```javascript
   base: process.env.NODE_ENV === 'production' ? '/your-repo-name/' : '/',
   ```

3. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Configure for deployment"
   git push origin main
   ```

4. **Enable GitHub Pages**
   - Go to repo Settings → Pages
   - Source: "GitHub Actions"
   - The workflow will auto-deploy on push

5. **Your Game URL**
   ```
   https://your-username.github.io/your-repo-name/
   ```

### Generate Shareable Match URL

Once deployed, share links like:
```
https://your-username.github.io/your-repo-name/?room=abc123
```

Anyone with this link joins the same room!

## Game Rules

### Objective
Destroy the enemy's main tower, or have more towers destroyed when time runs out.

### Mechanics
- **3-minute match** with 1-minute sudden death tiebreaker
- **Elixir regenerates** at 2.8/sec (5.6/sec in last minute)
- **8 cards** in your deck, 4 in hand at a time
- **Deploy units** on your side of the arena
- **Units auto-attack** and move toward enemy towers

### Cards (All Unlocked)

| Card | Elixir | Type | Notes |
|------|--------|------|-------|
| Knight | 3 | Melee | Solid tank |
| Archers | 3 | Ranged | Spawns 2 |
| Giant | 5 | Melee | Only targets buildings |
| Minions | 3 | Flying | Fast, fragile |
| Fireball | 4 | Spell | Area damage |
| Skeletons | 1 | Melee | Spawns 3, cheap cycle |
| Musketeer | 4 | Ranged | High damage single target |
| Bomber | 2 | Ranged | Splash, can't hit air |

## Development Phases

### Phase 1: Local Multiplayer ✅
- [x] Basic game engine
- [x] WebSocket communication
- [x] Three.js rendering
- [x] Card deployment

### Phase 2: Online Multiplayer ✅
- [x] Server deployment configs
- [x] GitHub Pages workflow
- [x] Room-based matchmaking
- [x] State synchronization

### Phase 3: Graphics Polish (TODO)
- [ ] Unit models (GLTF)
- [ ] Attack animations
- [ ] Spawn/death particles
- [ ] Sound effects

### Phase 4: Balancing (TODO)
- [ ] Playtesting
- [ ] Stats tuning
- [ ] More cards

## Technical Details

### State Synchronization

```
Server (20 Hz)              Client (60 fps)
     │                           │
     │ ──── State Update ────►   │
     │                           │ Interpolate
     │ ──── State Update ────►   │ between states
     │                           │ for smooth motion
     │ ◄──── Player Input ────   │
     │                           │
```

The client renders at 60fps by interpolating between server states received at 20Hz. This provides smooth visuals while keeping bandwidth reasonable.

### Anti-Cheat

All game logic runs on the server:
- Elixir validation
- Position validation (can only deploy on your side)
- Cooldown checking
- Unit spawning and combat

Clients only send input intentions, never game state.

## License

MIT - Use freely for your own projects!

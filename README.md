# kitta kat V6

Full-stack NEPSE investment journal — React/Vite frontend + Node.js/Express/MongoDB backend.

## Quick Start

### Backend
```bash
cd backend
cp .env.example .env      # fill in your values
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173  
Backend runs on http://localhost:5000

## V6 Changes (UI Redesign)
- New 3-theme system: Light / Purple / AMOLED (toggle in topbar)
- Opening splash screen animation with typewriter subtitle
- Left sidebar (collapsed 50px, expands to 204px, auto-collapses after 3s)
- New MeroShare login page — always white background
- Real-time clock in topbar
- All existing functionality (journal, investment, watchlist, MeroShare sync) unchanged

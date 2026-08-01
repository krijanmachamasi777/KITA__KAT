# MeroShare Backend

A structured Node.js + MongoDB backend for fetching and persisting MeroShare portfolio data.

## Project Structure

```
meroshare-backend/
├── src/
│   ├── config/
│   │   ├── database.js        # MongoDB connection
│   │   └── meroshare.js       # API URLs & credentials config
│   ├── controllers/
│   │   └── index.js           # All route handlers
│   ├── middleware/
│   │   └── errorHandler.js    # 404 + global error handler
│   ├── models/
│   │   ├── ApplicableIssue.js # IPO/FPO open issues
│   │   ├── Portfolio.js       # Portfolio items + summary
│   │   ├── Share.js           # Demat share holdings
│   │   ├── SyncLog.js         # Sync run history
│   │   ├── UserProfile.js     # Account details
│   │   └── Wacc.js            # Weighted average cost records
│   ├── routes/
│   │   └── index.js           # Express router
│   ├── scripts/
│   │   └── sync.js            # Standalone sync runner
│   ├── services/
│   │   ├── meroshareClient.js # MeroShare API client class
│   │   └── syncService.js     # Orchestrates full sync + DB upserts
│   ├── utils/
│   │   └── logger.js          # Winston logger
│   ├── app.js                 # Express app setup
│   └── index.js               # Entry point (server + cron)
├── .env.example
├── .gitignore
└── package.json
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your credentials and MongoDB URI
```

### 3. Start MongoDB
- **Local**: `mongod --dbpath /data/db`
- **Atlas**: Use your `mongodb+srv://...` URI in `.env`

### 4. Run

```bash
# Development (with auto-restart)
npm run dev

# Production
npm start

# One-off manual sync (no server)
npm run sync
```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/profile` | Your MeroShare profile |
| GET | `/api/shares` | All share holdings |
| GET | `/api/shares/:script` | Single script holding |
| GET | `/api/portfolio` | Portfolio with summary |
| GET | `/api/issues` | Open IPO/FPO issues (`?type=IPO`) |
| GET | `/api/wacc` | WACC records (`?script=NABIL`) |
| POST | `/api/sync` | Trigger a full sync manually |
| GET | `/api/sync/logs` | Recent sync history (`?limit=10`) |

## Sync Schedule

Set `SYNC_CRON` in `.env` using standard cron syntax.

```
SYNC_CRON=0 6 * * *    # Every day at 6:00 AM (default)
SYNC_CRON=*/30 * * * * # Every 30 minutes
```

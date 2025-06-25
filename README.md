# Web3 Analytics API

This is a Web3 analytics server built with Express, integrating on-chain DAO, token, and treasury data. It uses Infura, Alchemy, Zapper, and MongoDB to aggregate and serve analytics for DAOs.

## 📦 Setup

1. Clone the repo
2. Install dependencies:
   ```bash
   yarn install --frozen-lockfile
   ```
   or
   ```bash
   npm install
   ```
3. Set up your `.env` with the following keys:

   ```
   INFURA_KEY=...
   ALCHEMY_KEY=...
   ZAPPER_KEY=...
   DISCORD_WEBHOOK_URL=...
   MONGO_URI=...
   ```

4. Start the server:
   ```bash
   npm run dev
   ```

---

## 📊 API Routes

### 📁 DAOs

- `GET /daos`  
  Fetch a list of tracked DAOs.

### 📈 Charts

- `GET /chart/dao-days`  
  Get DAO market chart data.
  
- `GET /ohlc/dao-days`  
  Get OHLC chart data.
  
- `GET /charts/holders/:token`  
  Get historical holder data for a token.
  
- `GET /charts/treasury/:dao`  
  Get DAO treasury value over time.

### 🧠 DAO Details

- `GET /dao/:dao`  
  Get metadata and info for a specific DAO.
  
- `GET /token/:token`  
  Get token info and stats.
  
- `GET /treasury/:dao`  
  Get current DAO treasury breakdown.

---

## 🔄 Stats Refresh (use with care)

- `POST /treasury/refresh/:dao`  
  Refresh treasury data manually.

- `POST /token/refresh/:dao`  
  Refresh token stats manually.

---

## ⏱️ Cron Jobs

- Daily stats refresh runs automatically for treasuries and tokens.

---

## 📡 Dependencies

- Express
- TypeScript
- Web3 (ethers.js)
- MongoDB
- Axios

---

## 📬 Webhook Integration

Alerts and logs can be sent via Discord using the `DISCORD_WEBHOOK_URL` key.

---

**Note**: This project is intended for backend use. All routes return JSON responses suitable for frontend dashboards or analytics tools.

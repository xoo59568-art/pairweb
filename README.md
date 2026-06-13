# 🐰 RabbitXMD — WhatsApp Bot Pairing Website

> Simple, fast, and beautiful WhatsApp bot pairing portal.
> Built with **Node.js + Express + Baileys** — Zero Database, Pure JSON Storage.

---

## 📁 Project Structure

```
rabbitxmd-pair/
├── index.js        ← Backend server (Express + Baileys)
├── index.html      ← Frontend UI (Dark theme)
├── package.json    ← Dependencies & scripts
├── README.md       ← This file
└── temp/           ← Auto-created on startup
    ├── 919876543210.json       ← Saved session file
    └── auth_919876543210/      ← Temp auth (auto-deleted)
```

---

## ✨ Features

- 🔗 WhatsApp Pairing Code via Baileys (latest)
- 📁 Local JSON file storage — No database needed
- 🧹 Auto cleanup every 60s — files expire in 5 minutes
- 📨 Welcome message on successful connection
- 🌙 Beautiful Dark Theme, Mobile Responsive UI
- 🔒 Phone validation + Path traversal protection
- 🚀 Deploy-ready: Render, Railway, Heroku, VPS, Termux

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Server
```bash
npm start
```

### 3. Open Browser
```
http://localhost:3000
```

---

## 🌐 Deploy Guide

### ▶️ Render (Free Hosting)

1. Push all 4 files to a **GitHub repository**
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Set these settings:

| Setting | Value |
|---------|-------|
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Node Version** | `18` |

5. Click **Deploy** ✅

---

### 🚂 Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

---

### 💜 Heroku

```bash
heroku create your-app-name
git init
git add .
git commit -m "RabbitXMD deploy"
heroku git:remote -a your-app-name
git push heroku main
```

---

### 🖥️ VPS (Ubuntu/Debian)

```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 process manager
npm install -g pm2

# Start with PM2
pm2 start index.js --name rabbitxmd
pm2 save
pm2 startup
```

---

### 📱 Termux (Android)

```bash
pkg update && pkg upgrade
pkg install nodejs git
npm install
npm start
```

---

## 📡 API Reference

### `POST /pair`
Generate a WhatsApp pairing code.

**Request Body:**
```json
{
  "number": "919876543210"
}
```

**Success Response:**
```json
{
  "success": true,
  "sessionId": "919876543210",
  "pairCode": "ABCD-EFGH-IJKL"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid phone number."
}
```

---

### `GET /api/sessions`
List all saved sessions.

```json
{
  "success": true,
  "total": 1,
  "sessions": [
    {
      "sessionId": "919876543210",
      "createdAt": 1749720000
    }
  ]
}
```

---

### `GET /api/session/:id`
Get full auth data for a session.

```json
{
  "success": true,
  "sessionId": "919876543210",
  "createdAt": 1749720000,
  "auth": {
    "creds": {},
    "keys": {}
  }
}
```

---

## 💾 Session File Format

**Location:** `/temp/919876543210.json`

```json
{
  "sessionId": "919876543210",
  "auth": {
    "creds": { },
    "keys": { }
  },
  "createdAt": 1749720000
}
```

---

## 🧹 Auto Cleanup Rules

| Item | Expires After |
|------|---------------|
| Session JSON files | **5 minutes** |
| Auth temp directories | **10 minutes** |
| Cleanup check interval | **Every 60 seconds** |

No manual deletion needed — fully automatic.

---

## 🔒 Security Features

| Feature | Detail |
|---------|--------|
| Phone validation | Digits only, 7–15 chars |
| Session ID | Numeric only |
| Path traversal | Blocked via `path.resolve()` |
| JSON body limit | 1MB max |
| Database | None — no persistent storage |

---

## 📩 Welcome Message

Sent automatically to the user's WhatsApp inbox after successful connection:

```
🐰 RabbitXMD Connected

Your bot will be started within 2 minutes.

Thanks for using RabbitXMD ❤️
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server listening port |

**Custom port:**
```bash
PORT=8080 npm start
```

---

## 🛠️ Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.18.2 | Web server |
| `@whiskeysockets/baileys` | ^6.7.18 | WhatsApp Web API |
| `pino` | ^8.21.0 | Logger (silent mode) |

---

## 📜 License

**MIT** © RabbitXMD Team

---

<div align="center">
  <br>
  <strong>🐰 RabbitXMD</strong><br>
  <sub>Fast · Lightweight · No Database · Open Source</sub><br><br>
  Made with ❤️ by RabbitXMD Team
</div>

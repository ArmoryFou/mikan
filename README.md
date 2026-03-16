# Mikan (VN Social Logger)

Mikan is a full-stack social tracking platform for visual novels. Think of it as a VN-focused mix of personal journaling, public profiles, activity feeds, and community lists, powered by VNDB data.

The project includes:

- A React + Vite frontend for discovery, tracking, profiles, lists, and social interactions.
- An Express + MongoDB backend with JWT auth, VNDB integration, notifications, and cached metadata.
- A promotion folder with real screenshots you can use for documentation and showcase.

## What The Site Offers (Feature Analysis)

This is not only a tracker. The product is built around three connected layers:

1. Personal tracking workflow
2. Social discovery workflow
3. Curated community content workflow

### 1) Personal Tracking Workflow

- Account system with registration/login and persistent JWT sessions.
- Per-VN log entry with status, rating, and review text.
- Status model optimized for progression tracking:
   - want-to-play
   - playing
   - completed
   - dropped
   - on-hold
- Rich list management UI with filters, sort, search, and quick actions.
- Favorite VN and favorite character management in profile settings.
- Custom preferred covers per VN.
- Avatar upload and profile customization (display name, bio, privacy settings).
- VNDB XML import support from Settings to migrate existing VN tracking.

### 2) Social Discovery Workflow

- Follow/unfollow users and browse followers/following with privacy checks.
- Personalized friends activity feed.
- Global activity feed.
- Notification center for:
   - follow events
   - status changes
   - reviews
   - VN recommendations
- Direct VN recommendations to followed users.
- Public profile pages with logs, social metrics, and list sections.

### 3) Curated Community Content Workflow

- Public list explorer with search and sorting.
- User-created custom lists with two types:
   - normal
   - ranking
- List visibility modes:
   - public
   - private
   - unlisted
- List items can include notes and (for ranking lists) rank score.
- Reorderable list items.
- List social interactions:
   - follow list
   - like list
   - comment threads with owner/author moderation rules

### VN Intelligence Layer

Mikan enriches each VN page beyond basic tracking:

- VN detail data from VNDB.
- Character browsing and character detail pages.
- Community reviews per VN.
- Release information and multi-cover gallery.
- Quote feed from VNDB.
- VN-level aggregate stats (public + followed users slice).

### Data + Performance Architecture

- MongoDB-based persistence for users, logs, social graph, lists, comments, likes, follows, and reviews.
- Local cache collections for VN and character payloads to reduce repeated VNDB calls.
- Backend pagination patterns across feeds, members, notifications, followers/following, comments, and list browsing.
- Static serving for uploaded avatars.

## Tech Stack

### Frontend

- React 19
- React Router 7
- Vite 8
- Tailwind CSS 4
- Lucide React icons

### Backend

- Node.js (ES modules)
- Express 5
- MongoDB + Mongoose
- JWT (jsonwebtoken)
- bcryptjs
- multer (avatar uploads)
- CORS + dotenv

### External API

- VNDB Kana API: https://api.vndb.org/kana/

## Screenshots

All screenshots below are from the local promotion folder:

![Mikan Screenshot 1](promotion/Screenshot%202026-03-15%20215941.png)
![Mikan Screenshot 2](promotion/Screenshot%202026-03-15%20220034.png)
![Mikan Screenshot 3](promotion/Screenshot%202026-03-15%20220052.png)
![Mikan Screenshot 4](promotion/Screenshot%202026-03-15%20220117.png)
![Mikan Screenshot 5](promotion/Screenshot%202026-03-15%20220137.png)
![Mikan Screenshot 6](promotion/Screenshot%202026-03-15%20222317.png)

## Run Locally (Development)

### Requirements

- Node.js 20+ recommended
- npm
- MongoDB Atlas cluster (or any MongoDB URI)

### 1) Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2) Configure backend environment

Create backend/.env:

```env
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/vnlogger
JWT_SECRET=replace-with-a-long-random-secret
```

You can copy from backend/.env_template.

### 3) Start backend

```bash
cd backend
npm run start
```

Backend runs on http://localhost:3000.

### 4) Start frontend

```bash
cd frontend
npm run dev
```

Frontend runs on http://localhost:5173.

## Self-Hosting Guide

This section explains how to host your own production instance.

Important: the current frontend code uses hardcoded API URLs pointing to http://localhost:3000. For internet deployment, you must switch those URLs to your real backend domain (example: https://api.yourdomain.com).

### Option A: Single VPS (recommended simple setup)

Host both services on one Linux server and place Nginx in front.

1. Install Node.js LTS, npm, Nginx, and PM2.
2. Clone repository to server.
3. Configure backend/.env with production MongoDB and strong JWT secret.
4. Update frontend API URLs from localhost to your public API host.
5. Build frontend:

```bash
cd frontend
npm ci
npm run build
```

6. Start backend with PM2:

```bash
cd backend
npm ci
pm2 start server.js --name mikan-api
pm2 save
```

7. Serve frontend dist with Nginx and reverse proxy /api + /uploads to backend:3000.
8. Add TLS certificates (Let's Encrypt).

### Option B: Split hosting (frontend static + backend service)

- Frontend: Vercel, Netlify, Cloudflare Pages, or static Nginx.
- Backend: Render, Railway, Fly.io, VPS, or any Node host.
- Database: MongoDB Atlas.

Steps:

1. Deploy backend first and verify API URL.
2. Replace frontend API base URLs with deployed backend URL.
3. Build and deploy frontend.
4. Ensure CORS in backend allows frontend origin.

### Production checklist

- Use a strong JWT secret.
- Keep backend/.env out of git.
- Enforce HTTPS.
- Restrict file upload limits and monitor storage.
- Configure MongoDB network rules and backups.
- Use process manager (PM2/systemd) and centralized logs.

## Scripts

### Backend

- npm run start: run API server
- npm run dev: run API server with watch mode

### Frontend

- npm run dev: start Vite dev server
- npm run build: production build
- npm run preview: preview production build

## Project Structure

```text
backend/
   models/
   uploads/avatars/
   server.js
frontend/
   src/
   index.html
promotion/
README.md
```

## Notes

- VN data and search are powered by VNDB Kana API.
- VN and character payloads are cached server-side to reduce API pressure.
- Avatars are stored locally under backend/uploads/avatars.

## License

Code in this repository is licensed under GNU AGPL v3.0 or later.

Data and third-party content note:

- This app consumes data from VNDB.
- VNDB API usage terms state free non-commercial use.
- VNDB data is published under ODbL/DbCL with listed exceptions (including third-party content such as images/descriptions and AniDB-derived fields).
- If you deploy this project, you are responsible for complying with VNDB terms and any third-party content licensing requirements.
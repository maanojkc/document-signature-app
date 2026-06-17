# SignFlow — Document Signature App (MERN)

Full-stack e-signature app: React + Tailwind frontend, Express + MongoDB backend.

## Project Structure

```
document-signature-app/
├── frontend/     # React + Vite (deployed on Vercel)
└── backend/      # Express API (deploy on Render/Railway)
```

## What Was Added (Backend)

| Feature | API Route |
|---------|-----------|
| Register / Login (JWT) | `POST /api/auth/register`, `POST /api/auth/login` |
| PDF Upload (Multer) | `POST /api/docs/upload` |
| List Documents | `GET /api/docs` |
| Save Draft (replaces localStorage) | `GET/PUT /api/drafts` |
| Save Signatures | `POST /api/signatures` |
| Recipients | `POST/GET/DELETE /api/recipients` |
| Public Signing Link | `GET /api/recipients/public/:token`, `POST /api/recipients/public/:token/status` |
| Generate Signed PDF (pdf-lib) | `POST /api/export/:documentId/generate` |
| Audit Trail | `GET /api/audit/:fileId` |

---

## Step-by-Step Setup (Do This Once)

### Step 1 — MongoDB Atlas (Free)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) and create a free account.
2. Create a **free M0 cluster**.
3. Database Access → Add user (username + password).
4. Network Access → Add IP → **Allow Access from Anywhere** (`0.0.0.0/0`) for dev.
5. Connect → Drivers → copy the connection string.
6. Replace `<password>` with your password and set database name to `signflow`.

Example:
```
mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/signflow?retryWrites=true&w=majority
```

### Step 2 — Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env — paste your MONGODB_URI and set JWT_SECRET to any long random string
npm install
npm run dev
```

Backend runs at **http://localhost:5001**

### Step 3 — Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs at **http://localhost:5173**

### Step 4 — Test the App

1. Open http://localhost:5173
2. **Register** a new account
3. **Upload** a PDF — it saves to MongoDB + server disk
4. Add signature overlay → **Save Draft** (saved to your user in DB)
5. **Download Signed PDF** — server generates final PDF with pdf-lib
6. Add **Recipients** on the Recipients tab (requires uploaded doc)
7. Click **Remind** or the copy icon to copy a public `/sign/:token` signing link

## What Is Finished Now

- Node + Express backend with MongoDB/Mongoose models
- JWT register/login and protected API routes
- PDF upload stored on server disk with metadata in MongoDB
- Document dashboard to reopen uploaded PDFs
- Signature/date coordinates saved in MongoDB
- Recipient workflow with generated public signing links
- Public signing page at `/sign/:token`
- Server-side PDF generation/export with `pdf-lib`
- Audit trail for upload, signature save, recipient, reminder, and public signing events
- Draft/settings persistence in MongoDB

## Local Run Commands

Terminal 1:

```bash
cd /Users/manojkc/document-signature-app/backend
cp .env.example .env
# edit backend/.env and set MONGODB_URI + JWT_SECRET
npm install
npm run dev
```

Terminal 2:

```bash
cd /Users/manojkc/document-signature-app/frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173.

---

## Deployment (Week 2 Plan)

| Service | Platform |
|---------|----------|
| Frontend | Vercel (already done) |
| Backend | Render or Railway |
| Database | MongoDB Atlas |

### Vercel env var
```
VITE_API_URL=https://your-backend.onrender.com/api
```

### Render env vars
```
MONGODB_URI=your-atlas-uri
JWT_SECRET=your-secret
CLIENT_URL=https://your-app.vercel.app
PORT=5001
```

After setting those env vars, deploy:

1. Push this repo to GitHub.
2. On Render/Railway, create a backend service from `backend/` and use `npm start`.
3. On Vercel, create/update the frontend project from `frontend/`.
4. Set `CLIENT_URL` in the backend to the live Vercel URL so public signing links point to the deployed app.

---

## Can Cursor Build This On Your PC?

**Yes.** The backend and frontend integration were created directly in your `document-signature-app` folder at:

`/Users/manojkc/document-signature-app`

You only need to:
1. Create MongoDB Atlas cluster (requires your account — I can't do this for you)
2. Copy `.env.example` → `.env` in `backend/` and paste your connection string
3. Run `npm install` and `npm run dev` in both folders

Everything else is already wired up.

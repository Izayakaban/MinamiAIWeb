# MinamiAI

An interactive AI companion built around Minami, an anime VTuber character who holds a real conversation, speaks with a synthesized voice, and animates live in the browser in response to what's being said and where the user's cursor is.

MinamiAI is a full-stack application: a React frontend renders an animated Live2D avatar over a full-screen scene, an Express and PostgreSQL backend handles auth, conversation history, and long-term memory, and two external AI services power the conversational and vocal parts of the experience.

---

## Table of contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Database](#database)
- [API](#api)
- [Admin panel](#admin-panel)
- [Planning documents](#planning-documents)
- [Known limitations](#known-limitations)
- [Credits](#credits)

---

## What it does

- **Real-time conversation.** The user types a message; a language model (Groq, running Llama) generates Minami's reply, which is persisted alongside the full conversation history.
- **Spoken responses.** Every reply is synthesized into speech through ElevenLabs and played back automatically.
- **A live, reactive avatar.** Minami is rendered as a Live2D model, not a static image or a pre-recorded clip. Her mouth moves in sync with the actual audio being played, driven by real-time frequency analysis via the Web Audio API. Her eyes and head follow the user's cursor. She idles when nothing is happening and reacts with a distinct expression when something goes wrong.
- **Memory that persists across sessions.** A background process reviews each exchange, extracts anything worth remembering, and scores it by importance. Higher-importance memories persist indefinitely; lower-importance ones expire on a schedule. The next time the user talks to Minami — even in a new session — relevant memories are pulled back into the conversation.
- **Authentication and per-user isolation.** Accounts are password-protected with hashed credentials and JWT-based sessions. Every query is scoped to the authenticated user, so one account can never read another's conversations or memories.
- **An admin panel for the memory system.** A separate, password-gated interface provides full CRUD over stored memories — filtering, sorting, bulk operations, and the ability to inspect any user's memory store, which doubles as the debugging tool for the whole memory pipeline.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite |
| Avatar rendering | PixiJS, pixi-live2d-display, Cubism Live2D runtime |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Language model | Groq API (Llama) |
| Text-to-speech | ElevenLabs API (`eleven_turbo_v2_5`) |
| Auth | JWT, bcrypt |

## Architecture

```
┌──────────────┐        HTTPS         ┌──────────────┐
│   React app   │ ───────────────────▶ │ Express API   │
│  (Vite, Pixi) │ ◀─────────────────── │  (Node.js)    │
└──────┬───────┘                       └──────┬───────┘
       │                                       │
       │ renders Live2D model,                 ├──▶ PostgreSQL
       │ plays TTS audio,                      │    (users, conversations,
       │ drives lip sync from                  │     messages, memories)
       │ live audio analysis                   │
       │                                       ├──▶ Groq API (LLM replies)
       │                                       │
       │                                       └──▶ ElevenLabs API (TTS)
```

The browser never talks to Groq or ElevenLabs directly — every external API call is proxied through the Express backend, so API keys never reach the client.

## Getting started

**Prerequisites:** Node.js 18+, PostgreSQL 14+, a Groq API key, and an ElevenLabs API key.

```bash
# clone and install
git clone <this-repo-url>
cd minamiai

# backend
cd server
npm install
cp .env.example .env      # fill in the values below
createdb minamiai
psql "$DATABASE_URL" -f migrations/001_init.sql
npm run dev

# frontend, in a second terminal
cd ../client
npm install
cp .env.example .env      # set VITE_API_URL
npm run dev
```

The frontend runs on Vite's default dev server; the backend runs on the port set in `.env` (default `3001`).

## Environment variables

**Backend (`server/.env`)**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `GROQ_API_KEY` | Groq API key for language model responses |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for text-to-speech |
| `JWT_SECRET` | Secret used to sign and verify session tokens |
| `ADMIN_PASSWORD` | Separate password gating the admin panel |
| `PORT` | Port the Express server listens on (default `3001`) |

**Frontend (`client/.env`)**

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend, e.g. `http://localhost:3001` |

None of these values are committed to the repository. `.env.example` files list the required keys without values.

## Project structure

```
minamiai/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── Avatar.jsx   # Live2D rendering, mouse tracking, lip sync
│   │   ├── pages/
│   │   │   ├── AuthPage.jsx
│   │   │   └── ChatPage.jsx
│   │   └── App.jsx
│   └── public/models/       # Live2D model assets
├── server/                  # Express + PostgreSQL backend
│   ├── routes/
│   │   ├── auth.js
│   │   └── chat.js
│   ├── middleware/
│   │   └── auth.js          # JWT verification
│   ├── db/
│   │   └── db.js
│   ├── migrations/
│   │   └── 001_init.sql
│   └── admin.html           # standalone admin panel
└── docs/                    # planning documents (see below)
```

## Database

Four tables — `users`, `conversations`, `messages`, and `memories` — back the entire application. Full column definitions, relationships, indexes, and the security model are documented in [`docs/DATABASE_PLANNING.pdf`](docs/DATABASE_PLANNING.pdf); the runnable migration is at [`server/migrations/001_init.sql`](server/migrations/001_init.sql).

## API

Every endpoint — method, path, request body, and the full range of expected responses — is documented in [`docs/API_PLANNING.pdf`](docs/API_PLANNING.pdf). In short:

- `POST /api/auth/register`, `POST /api/auth/login` — account creation and session start
- `POST /api/chat/conversation`, `GET /api/chat/conversations`, `GET /api/chat/history/:id` — conversation management
- `POST /api/chat/message` — send a message, get Minami's reply
- `POST /api/chat/tts` — synthesize speech from text
- `GET /api/admin/memories`, `PATCH /api/admin/memories/:id`, `DELETE /api/admin/memories/:id`, `POST /api/admin/memories/bulk_delete` — memory administration (admin role required)

All routes except registration, login, and the landing page require a JWT in the `Authorization` header.

## Admin panel

A standalone page at `/admin`, gated by `ADMIN_PASSWORD` rather than the regular user login. It provides full visibility into the memory system: filtering by user, importance, and expiry status; bulk edits and deletion; and a user switcher for inspecting any account's stored memories. This exists primarily as a debugging tool for the memory pipeline — when Minami says something that doesn't track, this is where to find out why.

## Planning documents

The `docs/` folder contains the full planning package this project was built from:

- [`Project_Ideas.docx`](docs/Project_Ideas.docx) — design directions considered before settling on a live, voice-driven avatar
- [`Final_Project_Proposal.docx`](docs/Final_Project_Proposal.docx) — target audience, data sources, risks, security model, and functionality
- [`DATABASE_PLANNING.pdf`](docs/DATABASE_PLANNING.pdf) — full schema, relationships, and indexing rationale
- [`API_PLANNING.pdf`](docs/API_PLANNING.pdf) — every endpoint and its expected responses
- [`FRONTEND_PLANNING.pdf`](docs/FRONTEND_PLANNING.pdf) — screens, navigation, and component structure

## Known limitations

- **Conversation length versus model context.** Long-running conversations will eventually exceed the language model's context window; there's no summarization step yet to compress older history.
- **No semantic deduplication in memory.** Two memories that say essentially the same thing are stored as two separate rows, since there's no embedding-based similarity check before insert.
- **No TTS caching.** Identical text is re-synthesized from scratch every time rather than being cached, which is a real cost consideration at scale.
- **Serial primary keys.** Fine under the current authorization model, but would need to move to UUIDs if any resource became directly shareable by URL.

## Credits

- Live2D model rendering via [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display) and the Cubism SDK.
- Language responses via [Groq](https://groq.com/).
- Voice synthesis via [ElevenLabs](https://elevenlabs.io/).
- The Live2D model asset is used under its original creator's license terms; see `client/public/models/` for the model's own credit and license file.

---

Built as a capstone project for Springboard's Software Engineering program.

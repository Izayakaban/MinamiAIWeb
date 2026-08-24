# MinamiAI

An AI VTuber companion in the browser. Minami is a Live2D character who talks back, remembers you across sessions, and has opinions about movies.

## Try it now

### **→ [minami-ai-web.vercel.app](https://minami-ai-web.vercel.app) ←**

Log in with the demo account:

| Username | Password |
|----------|----------|
| `demo`   | `minami2026` |

> **Heads up:** the backend runs on a free tier that sleeps when idle. The first login can take up to a minute while it wakes up. After that it's fast.

---

![Minami](docs/screenshot.png)

## What it does

- **Talks back.** Responses stream through Groq, then get spoken aloud via ElevenLabs text-to-speech.
- **Remembers you.** A background extraction pass scores what's worth keeping on a 1 to 5 importance scale. A five never expires; a one is gone in an hour. Memories persist across sessions and shape how Minami responds later.
- **Animates in real time.** A commissioned Live2D model rendered with PixiJS, with mouse tracking and lip sync driven by live audio analysis rather than a fixed timer.
- **Has a personality.** Minami is sarcastic, obsessed with movies, and pretends to hate explaining code while thoroughly explaining code.

## Tech stack

**Frontend:** React, Vite, PixiJS, pixi-live2d-display, Web Audio API
**Backend:** Node.js, Express, JWT auth, bcrypt
**Database:** PostgreSQL
**AI:** Groq (`openai/gpt-oss-20b`)
**Voice:** ElevenLabs (`eleven_turbo_v2_5`)
**Hosting:** Vercel (frontend), Render (backend), Neon (database)

## How it's put together

Four tables: `users`, `conversations`, `messages`, and `memories`. Every query is scoped to the authenticated user's ID, so one account can never read another's history.

API keys live server-side only. The frontend never touches Groq or ElevenLabs directly, it calls the backend, which holds the credentials. Rate limits sit in front of the chat and voice routes to keep the public demo from draining the API quota.

Memory extraction runs as a fire-and-forget call after the response is already sent, so scoring never blocks the conversation.

## Running it locally

You'll need Node 18+, PostgreSQL, and API keys from Groq and ElevenLabs.

```bash
git clone https://github.com/Izayakaban/MinamiAIWeb.git
cd MinamiAIWeb
```

**Database**

```bash
createdb minamidb
psql minamidb -f schema.sql
```

**Backend**

```bash
cd backend
npm install
```

Create `backend/.env`:

```
DATABASE_URL=postgres://user:password@localhost:5432/minamidb
GROQ_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
JWT_SECRET=any_long_random_string
ADMIN_PASSWORD=your_admin_password
FRONTEND_URL=http://localhost:5173
```

```bash
node server.js
```

**Frontend**

```bash
cd ../frontend
npm install
```

Create `frontend/.env`:

```
VITE_API_URL=http://localhost:3001
```

```bash
npm run dev
```

Open `http://localhost:5173` and register an account.

## Admin panel

A password-protected interface at `/admin` on the backend gives full CRUD over stored memories, with filtering, bulk delete, and a user switcher. Useful for watching what the extraction system decides is worth keeping.

## Notes

The demo account is shared, so memories from one visitor are visible to the next. That's a quirk of the public demo, not the design.

The Live2D model is a commissioned asset and is not covered by this repository's license.

## License

MIT

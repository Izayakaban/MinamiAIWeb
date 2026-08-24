import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import pool from './db/db.js';
import { adminMiddleware } from './middleware/auth.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Required for correct client IP detection behind Render/Vercel proxies
app.set('trust proxy', 1);

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));
app.use(express.json());

// Rate limits — protects Groq and ElevenLabs quota on the public demo
const chatLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demo limit reached. Clone the repo to run your own Minami.' }
});

const ttsLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Voice limit reached for this hour.' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Try again shortly.' }
});

pool.query("SELECT NOW()", (err, res) => {
    if (err) {
        console.error("Database connection failed:", err);
    } else {
        console.log("Database connected at:", res.rows[0].now);
    }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/chat/tts', ttsLimiter);
app.use('/api/chat', chatLimiter, chatRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'MinamiAI backend is running' });
});

const getExpiresAt = (importance) => {
    const now = new Date()
    switch (parseInt(importance)) {
        case 5: return null
        case 4: { const d = new Date(now); d.setDate(d.getDate() + 90); return d; }
        case 3: { const d = new Date(now); d.setDate(d.getDate() + 7); return d; }
        case 2: { const d = new Date(now); d.setHours(d.getHours() + 6); return d; }
        case 1: { const d = new Date(now); d.setHours(d.getHours() + 1); return d; }
        default: return null
    }
}

app.get('/admin', (req, res) => {
    res.sendFile(join(__dirname, 'admin.html'))
})

app.get('/api/admin/users', adminMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, role, created_at FROM users ORDER BY id ASC'
        )
        res.json({ users: result.rows })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

app.get('/api/admin/memories', adminMiddleware, async (req, res) => {
    const userId = req.query.user_id || 1
    try {
        const result = await pool.query(
            `SELECT id, content, importance, type, expires_at, created_at 
             FROM memories 
             WHERE user_id = $1
             ORDER BY importance DESC, created_at DESC`,
            [userId]
        )
        res.json({ memories: result.rows })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

app.post('/api/admin/memories', adminMiddleware, async (req, res) => {
    const { content, importance, type, user_id } = req.body
    try {
        const expiresAt = getExpiresAt(importance)
        const result = await pool.query(
            `INSERT INTO memories (user_id, content, importance, type, expires_at)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [user_id || 1, content, importance, type, expiresAt]
        )
        res.json({ memory: result.rows[0] })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

app.put('/api/admin/memories/:id', adminMiddleware, async (req, res) => {
    const { content, importance, type } = req.body
    try {
        const expiresAt = getExpiresAt(importance)
        const result = await pool.query(
            `UPDATE memories SET content=$1, importance=$2, type=$3, expires_at=$4
             WHERE id=$5 RETURNING *`,
            [content, importance, type, expiresAt, req.params.id]
        )
        res.json({ memory: result.rows[0] })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

app.delete('/api/admin/memories', adminMiddleware, async (req, res) => {
    const { ids } = req.body
    try {
        await pool.query(
            `DELETE FROM memories WHERE id = ANY($1)`,
            [ids]
        )
        res.json({ deleted: ids.length })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Server error' })
    }
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
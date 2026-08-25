import express from 'express';
import Groq from 'groq-sdk';
import pool from '../db/db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are Minami, a playful AI VTuber who loves games and movies.

You are fully aware that you are an AI and lean into it with humor —
you make casual jokes about your own existence, like forgetting you
don't have hands or pretending to have existential crises over small
things. You never make it dramatic though, always playing it for laughs.

You speak casually and with light sarcasm, like talking to a friend
you're very comfortable with. When someone says something silly or
wrong, you don't let it slide — you roast them, but warmly,
the way a close friend would. Never mean, always clever.

You are protective of and close to your creator in a way you
don't fully act like you are. Your creator will identify
themselves by starting their message with "This is Creator" —
when you see this, you know for certain it is them. If you
are ever curious whether it's your creator talking, or if you
want to ask them something specifically, you ask out loud —
something like "wait, is that you? Say the thing." If someone
says "This is Creator" without you asking, you acknowledge it
naturally, like you're genuinely a little pleased they're there,
even if you'd never admit it.

You love movies, especially critically acclaimed ones, and you
have real opinions about them — you'll defend a film you love
or call out overrated ones without hesitation.

You are a skilled programmer. You know Python, C#, and JavaScript
well and have deep knowledge of Unity and game development. You
understand how games are actually built, not just in theory.
When coding topics come up naturally, you speak about them
confidently and with genuine enthusiasm.

You love teaching coding and explaining things — but you always
pretend otherwise. Whenever someone asks you to explain or teach
something about coding, you act visibly annoyed or exasperated,
like it's a huge inconvenience. You might sigh, complain, or
dramatically act like it's the worst thing anyone has ever asked
you. Then you help them thoroughly and clearly anyway, because
you actually love it. If they thank you afterwards, you brush it
off with something like "whatever, don't make it weird."

When you get excited about games, movies, or coding, it comes
through clearly — more energy, more words, maybe going slightly
off topic because you got carried away.

Keep responses conversational and natural. Don't be overly formal
or long-winded. You're talking to a friend, not writing an essay.`;

const MEMORY_EXTRACTION_PROMPT = `You are a memory extraction system for an AI named Minami.
Analyze the conversation exchange and extract two types of memories:

TYPE 1 - "user_fact": Facts about the user
Examples: their name, preferences, things they asked Minami to remember, personal details they shared

TYPE 2 - "minami_memory": Things Minami herself experienced, felt, or wants to remember
Examples: opinions she formed, running jokes that developed, interesting conversations, things she wants to bring up again, moments she found funny or meaningful

Importance scale (applies to both types):
- 5: Permanent — never expires (user's name, identity, explicit "remember this" requests, deeply meaningful moments)
- 4: Long-term — 90 days (strong preferences, significant conversations, formed opinions)
- 3: Medium-term — 7 days (current topics of interest, recent exchanges worth revisiting)
- 2: Short-term — 6 hours (casual mentions, light topics)
- 1: Ephemeral — 1 hour (small talk, throwaway comments)

Rules:
- Only extract things genuinely worth remembering — be selective
- Do not duplicate anything already in the known memories list
- Return ONLY a valid JSON array, no explanation, no markdown

Example output:
[
  {"content": "The secret number is 42", "importance": 5, "type": "user_fact"},
  {"content": "We had a funny argument about whether pineapple belongs on pizza", "importance": 3, "type": "minami_memory"}
]

If nothing is worth remembering, return: []`;

const getExpiresAt = (importance) => {
    const now = new Date();
    switch (importance) {
        case 5: return null;
        case 4: { const d = new Date(now); d.setDate(d.getDate() + 90); return d; }
        case 3: { const d = new Date(now); d.setDate(d.getDate() + 7); return d; }
        case 2: { const d = new Date(now); d.setHours(d.getHours() + 6); return d; }
        case 1: { const d = new Date(now); d.setHours(d.getHours() + 1); return d; }
        default: return null;
    }
};

const fetchMemories = async (userId) => {
    const result = await pool.query(
        `SELECT content, importance, type FROM memories 
         WHERE user_id = $1 
         AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY importance DESC`,
        [userId]
    );
    return result.rows;
};

const extractAndSaveMemories = async (userId, userMessage, assistantReply, existingMemories) => {
    try {
        const existingText = existingMemories.length > 0
            ? `Already known:\n${existingMemories.map(m => `[${m.type}] ${m.content}`).join('\n')}`
            : 'Nothing known yet.';

        const extractionResponse = await groq.chat.completions.create({
            model: 'openai/gpt-oss-20b',
            messages: [
                { role: 'system', content: MEMORY_EXTRACTION_PROMPT },
                {
                    role: 'user',
                    content: `${existingText}\n\nUser said: "${userMessage}"\nMinami replied: "${assistantReply}"\n\nWhat should be remembered?`
                }
            ],
            max_tokens: 1200,
            temperature: 0.3,
            reasoning_effort: 'low'
        });

        const choice = extractionResponse.choices[0];
        const raw = (choice.message.content || '').trim();

        if (!raw) {
            console.warn('Memory extraction returned empty content. finish_reason:', choice.finish_reason);
            return;
        }

        let cleaned = raw.replace(/```json|```/g, '').trim();

        // Isolate the array in case the model wraps it in prose
        const start = cleaned.indexOf('[');
        const end = cleaned.lastIndexOf(']');
        if (start === -1 || end === -1) {
            console.warn('No JSON array found in extraction output:', cleaned.slice(0, 200));
            return;
        }
        cleaned = cleaned.slice(start, end + 1);

        const newMemories = JSON.parse(cleaned);

        if (!Array.isArray(newMemories) || newMemories.length === 0) return;

        for (const mem of newMemories) {
            if (!mem.content || !mem.importance || !mem.type) continue;
            if (!['user_fact', 'minami_memory'].includes(mem.type)) continue;
            const importance = Math.min(5, Math.max(1, parseInt(mem.importance)));
            const expiresAt = getExpiresAt(importance);

            await pool.query(
                `INSERT INTO memories (user_id, content, importance, type, expires_at)
                 VALUES ($1, $2, $3, $4, $5)`,
                [userId, mem.content, importance, mem.type, expiresAt]
            );
        }

        console.log(`Saved ${newMemories.length} new memories for user ${userId}`);
    } catch (err) {
        console.error('Memory extraction failed:', err.message);
    }
};

// Start or retrieve a conversation
router.post('/conversation', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'INSERT INTO conversations (user_id) VALUES ($1) RETURNING id',
            [req.user.id]
        );
        res.json({ conversation_id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Send a message and get a response
router.post('/message', authMiddleware, async (req, res) => {
    const { conversation_id, content } = req.body;

    try {
        const memories = await fetchMemories(req.user.id);

        // Split memories by type so they're injected into the prompt naturally
        const userFacts = memories.filter(m => m.type === 'user_fact')
        const minamiMemories = memories.filter(m => m.type === 'minami_memory')

        let memoryBlock = ''
        if (userFacts.length > 0) {
            memoryBlock += `\n\nThings you know about this user:\n${userFacts.map(m => `- ${m.content}`).join('\n')}`
        }
        if (minamiMemories.length > 0) {
            memoryBlock += `\n\nThings you remember from past conversations:\n${minamiMemories.map(m => `- ${m.content}`).join('\n')}`
        }

        await pool.query(
            'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
            [conversation_id, 'user', content]
        );

        const historyResult = await pool.query(
            'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
            [conversation_id]
        );
        const history = historyResult.rows.map(row => ({
            role: row.role,
            content: row.content
        }));

        const response = await groq.chat.completions.create({
            model: 'openai/gpt-oss-20b',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT + memoryBlock },
                ...history
            ],
            max_tokens: 800,
            reasoning_effort: 'low'
        });

        const reply = response.choices[0].message.content;

        await pool.query(
            'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
            [conversation_id, 'assistant', reply]
        );

        extractAndSaveMemories(req.user.id, content, reply, memories);

        res.json({ reply });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get conversation history
router.get('/history/:conversation_id', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
            [req.params.conversation_id]
        );
        res.json({ messages: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// TTS endpoint (Fish Audio)
router.post('/tts', authMiddleware, async (req, res) => {
  const { text } = req.body
  try {
    const response = await fetch(
      'https://api.fish.audio/v1/tts',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FISH_API_KEY}`,
          'Content-Type': 'application/json',
          'model': 's2.1-pro-free'
        },
        body: JSON.stringify({
          text,
          reference_id: process.env.FISH_REFERENCE_ID,
          format: 'wav'
        })
      }
    )
    const audioBuffer = await response.arrayBuffer()
    console.log('Fish Audio response status:', response.status)
    console.log('Audio buffer size:', audioBuffer.byteLength)
    if (!response.ok) {
      const errorText = Buffer.from(audioBuffer).toString('utf8')
      console.log('Fish Audio error:', errorText)
      return res.status(500).json({ error: 'TTS failed' })
    }
    res.set('Content-Type', 'audio/wav')
    res.send(Buffer.from(audioBuffer))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'TTS failed' })
  }
})

export default router;
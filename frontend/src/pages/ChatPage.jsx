import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import Avatar from '../components/Avatar'

const API_URL = import.meta.env.VITE_API_URL

function ChatPage({ username, token, onLogout }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [status, setStatus] = useState('online')
  const modelRef = useRef(null)
  const audioRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const mouthLevelRef = useRef(0)
  const messagesEndRef = useRef(null)
  const canvasRef = useRef(null)

  const triggerError = () => {
    setStatus('error')

    const tryExpression = () => {
    const core = modelRef.current?.internalModel?.coreModel
    if (core) {
      core.setParameterValueById('Surprised', 1)
      // Reset after 4 seconds
        setTimeout(() => {
          core.setParameterValueById('Surprised', 0)
        }, 4000)
      } else {
        setTimeout(tryExpression, 200)
      }
    }
    tryExpression()

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'Izaya, my AI broke again',
      isError: true
    }])

    setChatOpen(true)

    setTimeout(() => {
      setStatus('online')
    }, 4000)
  }

  useEffect(() => {
    const startConversation = async () => {
      try {
        const res = await axios.post(
          `${API_URL}/api/chat/conversation`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setConversationId(res.data.conversation_id)
      } catch (err) {
        console.error('Failed to start conversation:', err)
        triggerError()
      }
    }
    startConversation()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animFrame
    let t = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.3,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.6 + 0.2,
    }))

    const hexagons = Array.from({ length: 8 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 60 + 30,
      opacity: Math.random() * 0.18 + 0.08,
      speed: Math.random() * 0.003 + 0.001,
      phase: Math.random() * Math.PI * 2,
    }))

    const drawHexagon = (x, y, size, opacity) => {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6
        const px = x + size * Math.cos(angle)
        const py = y + size * Math.sin(angle)
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.strokeStyle = `rgba(184, 164, 240, ${opacity})`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    const draw = () => {
      t += 0.005
      const w = canvas.width
      const h = canvas.height

      const grad = ctx.createRadialGradient(w * 0.4, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.9)
      grad.addColorStop(0, '#36369a')
      grad.addColorStop(0.4, '#593ca9')
      grad.addColorStop(1, '#352b62')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      const drawOrb = (x, y, r, colorA, colorB) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, colorA)
        g.addColorStop(1, colorB)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }

      drawOrb(w * 0.25 + Math.sin(t * 0.4) * 40, h * 0.4 + Math.cos(t * 0.3) * 30, 280, 'rgba(184,164,240,0.30)', 'rgba(184,164,240,0)')
      drawOrb(w * 0.6 + Math.sin(t * 0.3) * 50, h * 0.6 + Math.cos(t * 0.4) * 40, 220, 'rgba(242,167,195,0.25)', 'rgba(242,167,195,0)')
      drawOrb(w * 0.15 + Math.sin(t * 0.5) * 20, h * 0.75 + Math.cos(t * 0.6) * 25, 160, 'rgba(120,180,255,0.22)', 'rgba(120,180,255,0)')

      ctx.strokeStyle = 'rgba(184,164,240,0.10)'
      ctx.lineWidth = 1
      const gridSize = 60
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
      }

      hexagons.forEach(hex => {
        hex.y -= hex.speed * 0.5
        if (hex.y + hex.size < 0) hex.y = h + hex.size
        const pulse = Math.sin(t * 0.8 + hex.phase) * 0.015 + hex.opacity
        drawHexagon(hex.x, hex.y, hex.size, pulse)
      })

      particles.forEach(p => {
        p.x += p.speedX; p.y += p.speedY
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(242,167,195,${p.opacity})`
        ctx.fill()
      })

      const scanY = ((t * 80) % (h + 100)) - 50
      const scanGrad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40)
      scanGrad.addColorStop(0, 'rgba(184,164,240,0)')
      scanGrad.addColorStop(0.5, 'rgba(184,164,240,0.07)')
      scanGrad.addColorStop(1, 'rgba(184,164,240,0)')
      ctx.fillStyle = scanGrad
      ctx.fillRect(0, scanY - 40, w, 80)

      animFrame = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animFrame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const playTTS = async (text) => {
    try {
      const res = await axios.post(
        `${API_URL}/api/chat/tts`,
        { text },
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'arraybuffer' }
      )
      const blob = new Blob([res.data], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      if (audioRef.current) {
        audioRef.current.pause()
        URL.revokeObjectURL(audioRef.current.src)
      }
      const audio = new Audio(url)
      audioRef.current = audio

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      const source = audioContextRef.current.createMediaElementSource(audio)
      const analyser = audioContextRef.current.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.25
      source.connect(analyser)
      analyser.connect(audioContextRef.current.destination)
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const updateMouth = () => {
        if (!audioRef.current || audioRef.current.paused) return
        analyser.getByteFrequencyData(dataArray)
        const midStart = Math.floor(dataArray.length * 0.1)
        const midEnd = Math.floor(dataArray.length * 0.4)
        let midSum = 0
        for (let i = midStart; i < midEnd; i++) midSum += dataArray[i]
        const midAvg = midSum / (midEnd - midStart)
        const normalized = Math.min(midAvg / 60, 1)
        const now = Date.now()
        const syllableOsc = normalized > 0.1
          ? (Math.sin(now * 0.018) * 0.5 + 0.5) * normalized
          : 0
        mouthLevelRef.current = syllableOsc
        requestAnimationFrame(updateMouth)
      }

      audio.onended = () => {
        setIsSpeaking(false)
        mouthLevelRef.current = 0
        URL.revokeObjectURL(url)
      }

      setIsSpeaking(true)
      audio.play()
      updateMouth()

    } catch (err) {
      console.error('TTS error:', err)
      setIsSpeaking(false)
      triggerError()
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || !conversationId) return
    const userMessage = input
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)
    try {
      const res = await axios.post(
        `${API_URL}/api/chat/message`,
        { conversation_id: conversationId, content: userMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const reply = res.data.reply
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      await playTTS(reply)
    } catch (err) {
      console.error(err)
      triggerError()
    }
    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') sendMessage()
  }

  const statusConfig = {
    online: { color: '#F2A7C3', border: 'rgba(242,167,195,0.3)', bg: 'rgba(242,167,195,0.08)', label: 'online' },
    error:  { color: '#FF6B6B', border: 'rgba(255,107,107,0.3)', bg: 'rgba(255,107,107,0.08)', label: 'error' },
  }
  const pill = statusConfig[status]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; }

        .chat-panel {
          position: fixed;
          right: 0;
          top: 0;
          height: 100vh;
          width: 420px;
          display: flex;
          flex-direction: column;
          background: rgba(14,14,18,0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-left: 1px solid rgba(184,164,240,0.15);
          transform: translateX(100%);
          transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
          z-index: 10;
        }
        .chat-panel.open { transform: translateX(0); }

        .tab-bar {
          display: flex;
          align-items: stretch;
          background: rgba(20,20,28,0.8);
          border-bottom: 1px solid rgba(184,164,240,0.1);
          height: 36px;
          flex-shrink: 0;
        }
        .tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 16px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #6E6E9A;
          border-right: 1px solid rgba(184,164,240,0.1);
          border-bottom: 2px solid transparent;
          white-space: nowrap;
        }
        .tab.active {
          color: #E8E8F0;
          background: rgba(242,167,195,0.05);
          border-bottom: 2px solid #F2A7C3;
        }
        .tab.active span { color: #F2A7C3; }

        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          scrollbar-width: thin;
          scrollbar-color: rgba(184,164,240,0.2) transparent;
        }
        .messages::-webkit-scrollbar { width: 3px; }
        .messages::-webkit-scrollbar-thumb { background: rgba(184,164,240,0.2); border-radius: 2px; }

        .msg-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          margin-bottom: 4px;
        }
        .msg-label.user { color: #B8A4F0; text-align: right; padding-right: 4px; }
        .msg-label.assistant { color: #F2A7C3; padding-left: 4px; }

        .msg-row { display: flex; }
        .msg-row.user { justify-content: flex-end; }
        .msg-row.assistant { justify-content: flex-start; }

        .bubble {
          padding: 10px 14px;
          max-width: 85%;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          line-height: 1.6;
          color: #E8E8F0;
        }
        .bubble.user {
          background: rgba(45,31,61,0.8);
          border: 1px solid rgba(184,164,240,0.2);
          border-radius: 16px 16px 4px 16px;
        }
        .bubble.assistant {
          background: rgba(30,30,48,0.8);
          border: 1px solid rgba(242,167,195,0.15);
          border-radius: 16px 16px 16px 4px;
        }
        .bubble.error-msg {
          background: rgba(255,107,107,0.08);
          border: 1px solid rgba(255,107,107,0.2);
          color: #FFB3B3;
          border-radius: 16px 16px 16px 4px;
        }

        .thinking {
          display: flex;
          gap: 4px;
          align-items: center;
          padding: 12px 14px;
          background: rgba(30,30,48,0.8);
          border: 1px solid rgba(242,167,195,0.15);
          border-radius: 16px 16px 16px 4px;
        }
        .thinking-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #F2A7C3;
          animation: bounce 1.2s infinite;
        }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }

        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: rgba(110,110,154,0.6);
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
        }

        .status-bar {
          border-top: 1px solid rgba(184,164,240,0.1);
          background: rgba(20,20,28,0.9);
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .status-prompt {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #6E6E9A;
        }
        .chat-input {
          flex: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(184,164,240,0.15);
          border-radius: 6px;
          padding: 7px 10px;
          color: #E8E8F0;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          outline: none;
          transition: border-color 0.15s;
        }
        .chat-input:focus { border-color: #F2A7C3; }
        .send-btn {
          background: linear-gradient(135deg, #F2A7C3, #B8A4F0);
          border: none;
          border-radius: 6px;
          padding: 7px 14px;
          color: #0E0E12;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.15s;
        }
        .send-btn:hover { opacity: 0.85; }

        .chat-toggle {
          position: fixed;
          right: 20px;
          bottom: 24px;
          z-index: 20;
          background: linear-gradient(135deg, #F2A7C3, #B8A4F0);
          border: none;
          border-radius: 50px;
          padding: 10px 20px;
          color: #0E0E12;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 24px rgba(184,164,240,0.3);
          transition: transform 0.15s, box-shadow 0.15s, right 0.35s cubic-bezier(0.4,0,0.2,1);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .chat-toggle.shifted { right: 440px; }
        .chat-toggle:hover { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(184,164,240,0.4); }

        .corner-tl {
          position: fixed;
          top: 16px;
          left: 20px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .logo-text {
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          font-weight: 700;
          color: #E8E8F0;
          letter-spacing: 0.05em;
        }
        .logo-dot { color: #F2A7C3; }

        .corner-tr {
          position: fixed;
          top: 16px;
          right: 20px;
          z-index: 10;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .corner-tr.shifted { right: 440px; }
        .user-chip {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #B8A4F0;
          background: rgba(184,164,240,0.08);
          border: 1px solid rgba(184,164,240,0.2);
          padding: 4px 10px;
          border-radius: 4px;
        }
        .logout-btn {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #6E6E9A;
          background: transparent;
          border: 1px solid rgba(110,110,154,0.25);
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .logout-btn:hover { color: #E8E8F0; border-color: rgba(184,164,240,0.3); }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes errorPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />

      <Avatar isSpeaking={isSpeaking} modelRef={modelRef} mouthLevelRef={mouthLevelRef} />

      <div className="corner-tl">
      
        <span className="logo-text">minami<span className="logo-dot">.</span>ai</span>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          padding: '3px 8px',
          borderRadius: '20px',
          border: `1px solid ${pill.border}`,
          color: pill.color,
          background: pill.bg,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.3s ease',
        }}>
          <div style={{
            width: '5px', height: '5px',
            borderRadius: '50%',
            background: pill.color,
            animation: status === 'error' ? 'errorPulse 0.5s infinite' : 'pulse 2s infinite',
          }} />
          {pill.label}
        </div>
      </div>

      <div className={`corner-tr${chatOpen ? ' shifted' : ''}`}>
        <span className="user-chip">@{username}</span>
        <button className="logout-btn" onClick={onLogout}>disconnect</button>
      </div>

      <button
        className={`chat-toggle${chatOpen ? ' shifted' : ''}`}
        onClick={() => setChatOpen(prev => !prev)}
      >
        {chatOpen ? '✕ close' : '◈ chat'}
      </button>

      <div className={`chat-panel${chatOpen ? ' open' : ''}`}>
        <div className="tab-bar">
          <div className="tab active"><span>◈</span> chat.minami</div>
          <div className="tab"><span>//</span> minami.config</div>
        </div>

        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-state">
              <span style={{ fontSize: '24px' }}>✦</span>
              <span>// say something to minami</span>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`msg-label ${msg.role}`}>
                {msg.role === 'user' ? `${username} ›` : '‹ minami'}
              </div>
              <div className={`msg-row ${msg.role}`}>
                <div className={`bubble ${msg.role}${msg.isError ? ' error-msg' : ''}`}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div>
              <div className="msg-label assistant">‹ minami</div>
              <div className="msg-row assistant">
                <div className="thinking">
                  <div className="thinking-dot" style={{ animationDelay: '0s' }} />
                  <div className="thinking-dot" style={{ animationDelay: '0.2s' }} />
                  <div className="thinking-dot" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="status-bar">
          <span className="status-prompt">›_</span>
          <input
            className="chat-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="// type something..."
          />
          <button className="send-btn" onClick={sendMessage}>SEND ↵</button>
        </div>
      </div>
    </>
  )
}

export default ChatPage
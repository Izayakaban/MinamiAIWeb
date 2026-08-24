import { useState } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'

    try {
      const res = await axios.post(`${API_URL}${endpoint}`, {
        username,
        password
      })
      onLogin(res.data.token, res.data.username)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <h1>MinamiAI</h1>
      <h2>{isLogin ? 'Login' : 'Register'}</h2>

      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        style={{ margin: '8px', padding: '8px', width: '250px' }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        style={{ margin: '8px', padding: '8px', width: '250px' }}
      />

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button onClick={handleSubmit} style={{ margin: '8px', padding: '8px 24px' }}>
        {isLogin ? 'Login' : 'Register'}
      </button>

      <p>
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <span
          onClick={() => setIsLogin(!isLogin)}
          style={{ color: 'blue', cursor: 'pointer' }}
        >
          {isLogin ? 'Register' : 'Login'}
        </span>
      </p>
    </div>
  )
}

export default AuthPage
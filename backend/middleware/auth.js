import jwt from 'jsonwebtoken'

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET)
        req.user = verified
        next()
    } catch (err) {
        return res.status(403).json({ error: 'Invalid token' })
    }
}

export const adminMiddleware = (req, res, next) => {
    const password = req.headers['x-admin-password']
    console.log('Admin attempt:', password, '| Expected:', process.env.ADMIN_PASSWORD)
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Forbidden' })
    }
    next()
}

export default authMiddleware
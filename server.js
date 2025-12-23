require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Database Pool

const pool = mysql.createPool(process.env.DATABASE_URL || {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    ssl: { rejectUnauthorized: false } // Required by most cloud providers
});
// Auto-create table on start
const initDB = async () => {
    try {
        const conn = await pool.getConnection();
        console.log('✅ MySQL connected successfully!');

        await conn.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                relation VARCHAR(50),
                visit_count INT DEFAULT 1,
                high_score INT DEFAULT 0
            )
        `);
        console.log('✅ Users table is ready!');
        conn.release();
    } catch (err) {
        console.error('❌ DB Fail:', err.message);
        setTimeout(initDB, 5000); // Retry every 5s
    }
};
initDB();

// API: Login/Sync
app.post('/login', async (req, res) => {
    const { name, relation } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE name = ?', [name]);
        if (rows.length > 0) {
            await pool.query('UPDATE users SET visit_count = visit_count + 1 WHERE id = ?', [rows[0].id]);
            return res.json(rows[0]);
        }
        const [result] = await pool.query('INSERT INTO users (name, relation) VALUES (?, ?)', [name, relation]);
        res.json({ name, relation, high_score: 0 });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// API: Update High Score
app.post('/update-score', async (req, res) => {
    const { name, score } = req.body;
    try {
        await pool.query('UPDATE users SET high_score = ? WHERE name = ? AND high_score < ?', [score, name, score]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Root Route: Serves index.html from public folder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Running on http://localhost:${PORT}`));
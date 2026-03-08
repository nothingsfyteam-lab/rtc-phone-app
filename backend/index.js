const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// ── Serve built React frontend ────────────────────────────────────────────────
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distPath));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

const activeUsers = new Map();   // socketId → number
const numberToSocket = new Map(); // number → socketId

function generateNumber() {
    let n;
    do { n = String(Math.floor(Math.random() * 1e12)).padStart(12, '0'); }
    while (numberToSocket.has(n));
    return n;
}

io.on('connection', (socket) => {
    console.log('+ connected:', socket.id);

    socket.on('register', (savedNumber) => {
        const number = (savedNumber && !numberToSocket.has(savedNumber))
            ? savedNumber
            : generateNumber();
        activeUsers.set(socket.id, number);
        numberToSocket.set(number, socket.id);
        socket.emit('registered', { number });
        console.log(`  registered ${socket.id} → ${number}`);
    });

    // ── WebRTC Signaling ─────────────────────────────────────────────────────────
    socket.on('call_offer', ({ targetNumber, offer }) => {
        const targetId = numberToSocket.get(targetNumber);
        const from = activeUsers.get(socket.id);
        if (targetId && from) io.to(targetId).emit('call_offer', { fromNumber: from, offer });
    });

    socket.on('call_answer', ({ targetNumber, answer }) => {
        const targetId = numberToSocket.get(targetNumber);
        const from = activeUsers.get(socket.id);
        if (targetId && from) io.to(targetId).emit('call_answer', { fromNumber: from, answer });
    });

    socket.on('ice_candidate', ({ targetNumber, candidate }) => {
        const targetId = numberToSocket.get(targetNumber);
        const from = activeUsers.get(socket.id);
        if (targetId && from) io.to(targetId).emit('ice_candidate', { fromNumber: from, candidate });
    });

    socket.on('call_ended', ({ targetNumber }) => {
        const targetId = numberToSocket.get(targetNumber);
        const from = activeUsers.get(socket.id);
        if (targetId && from) io.to(targetId).emit('call_ended', { fromNumber: from });
    });

    // ── Social ───────────────────────────────────────────────────────────────────
    socket.on('friend_request', ({ targetNumber }) => {
        const targetId = numberToSocket.get(targetNumber);
        const from = activeUsers.get(socket.id);
        if (targetId && from) io.to(targetId).emit('friend_request_received', { fromNumber: from });
    });

    socket.on('friend_request_accepted', ({ targetNumber }) => {
        const targetId = numberToSocket.get(targetNumber);
        const from = activeUsers.get(socket.id);
        if (targetId && from) io.to(targetId).emit('friend_request_accepted', { byNumber: from });
    });

    socket.on('friend_request_denied', ({ targetNumber }) => {
        const targetId = numberToSocket.get(targetNumber);
        const from = activeUsers.get(socket.id);
        if (targetId && from) io.to(targetId).emit('friend_request_denied', { byNumber: from });
    });

    // ── Disconnect ───────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        const number = activeUsers.get(socket.id);
        if (number) {
            activeUsers.delete(socket.id);
            numberToSocket.delete(number);
        }
        console.log('- disconnected:', socket.id);
    });
});

// ── SPA fallback (serves index.html for all non-handled routes) ─────────────
app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on :${PORT}`);
});

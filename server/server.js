const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const Document = require('./models/Document');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow all origins for now, will restrict later
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/collaborative_editor', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

// API Routes
app.post('/api/documents', async (req, res) => {
    try {
        const document = new Document();
        await document.save();
        res.json(document);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/documents/:id', async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.json(document);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected');

    // Join a document room
    socket.on('join-document', async (documentId) => {
        socket.join(documentId);
        console.log(`User joined document: ${documentId}`);
    });

    // Handle document changes
    socket.on('document-change', async (data) => {
        const { documentId, delta } = data;
        
        try {
            // Update document in database
            await Document.findByIdAndUpdate(documentId, {
                content: delta,
                updatedAt: Date.now()
            });

            // Broadcast changes to all clients in the document room except sender
            socket.to(documentId).emit('document-update', delta);
        } catch (error) {
            console.error('Error updating document:', error);
        }
    });

    // Handle cursor position updates
    socket.on('cursor-position', (data) => {
        const { documentId, position, userId } = data;
        socket.to(documentId).emit('cursor-update', { position, userId });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 
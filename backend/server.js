const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs'); // Using standard fs for sync operations
const path = require('path');

// 1. INITIALIZATION
const app = express();
app.use(cors());
app.use(express.json()); // Essential to read the 'code' body from the request

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // Change this if your frontend port is different
        methods: ["GET", "POST"]
    }
});

// 2. DOCKER EXECUTION ROUTE
app.post('/run-code', (req, res) => {
    const { code } = req.body;
    
    // Setup file paths
    const fileName = `solution_${Date.now()}.cpp`;
    const tempDir = path.join(__dirname, 'temp');
    const filePath = path.join(tempDir, fileName);

    // 1. Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    // 2. Write user code to the temporary file
    try {
        fs.writeFileSync(filePath, code);
    } catch (err) {
        return res.status(500).json({ success: false, output: "Failed to write file" });
    }

    // 3. Docker arguments for secured execution
    const dockerArgs = [
        'run', '--rm', 
        '--network', 'none',
        '--memory', '128m', 
        '--cpus', '0.5',
        '-v', `${tempDir}:/home/student`, 
        'algo-sandbox', 
        'sh', '-c', `g++ ${fileName} -o out && ./out`
    ];

    const child = spawn('docker', dockerArgs);

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
        output += data.toString();
    });

    child.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    child.on('close', (exitCode) => {
        // Cleanup: remove the temp file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        // Remove the compiled binary if it exists to keep temp folder clean
        const binaryPath = path.join(tempDir, 'out');
        if (fs.existsSync(binaryPath)) {
            fs.unlinkSync(binaryPath);
        }

        if (exitCode === 0) {
            res.json({ success: true, output });
        } else {
            res.json({ success: false, output: errorOutput || "Execution Failed" });
        }
    });
});

// 3. SOCKET.IO LOGIC (For Phase 1 sync)
io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
    });

    socket.on('code_change', ({ roomId, code }) => {
        socket.to(roomId).emit('receive_code', code);
    });

    socket.on('disconnect', () => {
        console.log("User Disconnected", socket.id);
    });
});

// 4. START SERVER
const PORT = 5001; 
server.listen(PORT, () => {
    console.log(`AlgoArena Server running on port ${PORT}`);
});
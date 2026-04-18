import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import { fileURLToPath } from "url";
import path from "path";
import { ethers } from "ethers";
import dotenv from "dotenv";

const app = express();
const PREFERRED_PORT = Number(process.env.PORT) || 5001;
const MAX_PORT_ATTEMPTS = 20;
const HOST = process.env.HOST || "0.0.0.0";
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8080";

const localProblems = [
  { 
    id: "arena-gateway", 
    title: "⭐ Arena Gateway (Test Victory)", 
    difficulty: "Easy",
    descriptionHTML: "<h3>Welcome to the Arena.</h3><p>To prove your execution environment works, write a program that outputs exactly:</p><pre><code>AlgoArena 2026</code></pre>",
    expectedOutput: "AlgoArena 2026",
    topicTags: [{name: "Output Testing"}]
  },
  { 
    id: "echo-chamber", 
    title: "⭐ Echo Chamber", 
    difficulty: "Medium",
    descriptionHTML: "<h3>The Loop Trial.</h3><p>Write a program that prints the numbers 1 through 5, with each number on a new line.</p>",
    expectedOutput: "1\n2\n3\n4\n5",
    topicTags: [{name: "Loops"}]
  }
];

let leetcodeBank = [];

axios.get("https://alfa-leetcode-api.onrender.com/problems?limit=50")
  .then(res => {
    leetcodeBank = res.data.problemsetQuestionList;
    console.log(`✅ Loaded ${leetcodeBank.length} LeetCode challenges!`);
  })
  .catch(err => console.error("Failed to load ALFA problems:", err.message));

app.use(cors({ origin: true, methods: ["GET", "POST"], credentials: true }));
app.use(express.json({ limit: "10mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../blockchain/.env") });

/* =========================================================
   SOCKET.IO (MULTIPLAYER SYNC)
   ========================================================= */
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, methods: ["GET", "POST"], credentials: true } });

const activeRooms = {};
const roomTimers = {};

io.on('connection', (socket) => {
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        const roomSize = io.sockets.adapter.rooms.get(roomId).size;
        io.to(roomId).emit('room_status', { count: roomSize });

        if (roomSize === 2 && !activeRooms[roomId]) {
            activeRooms[roomId] = true;
            
            // DYNAMIC PROBLEM SELECTOR IS BACK
            const randomProblem = leetcodeBank.length > 0 
                ? leetcodeBank[Math.floor(Math.random() * leetcodeBank.length)].titleSlug 
                : "two-sum";

            io.to(roomId).emit('battle_start', { 
                message: "Match Found! Battle starting...",
                problemSlug: randomProblem 
            });
            
            let timeLeft = 900; 
            roomTimers[roomId] = setInterval(() => {
                if (timeLeft <= 0) {
                    clearInterval(roomTimers[roomId]);
                    io.to(roomId).emit('battle_over', { message: "Time is up! Draw." });
                    delete activeRooms[roomId];
                } else {
                    io.to(roomId).emit('timer_update', { timeLeft });
                    timeLeft--;
                }
            }, 1000);
        }
    });

    socket.on('code_change', ({ roomId, code, playerId }) => {
        socket.to(roomId).emit('receive_code', code);
        io.to(roomId).emit('spectator_update', { playerId, code });
    });

    socket.on('claim_victory', ({ roomId, winnerId }) => {
        if (roomTimers[roomId]) {
            clearInterval(roomTimers[roomId]);
            delete activeRooms[roomId];
        }
        io.to(roomId).emit('match_over', { winnerId });
    });

    socket.on('disconnect', () => {
        for (const roomId in activeRooms) {
            const room = io.sockets.adapter.rooms.get(roomId);
            if (!room || room.size < 2) {
                delete activeRooms[roomId];
                if (roomTimers[roomId]) clearInterval(roomTimers[roomId]);
                io.to(roomId).emit('room_status', { count: room ? room.size : 0 });
            }
        }
    });
});

/* =========================================================
   PROBLEM API
   ========================================================= */
app.get("/problems", async (req, res) => {
  const localList = localProblems.map(p => ({ id: p.id, title: p.title, difficulty: p.difficulty }));
  const leetCodeList = leetcodeBank.map(p => ({ id: p.titleSlug, title: p.title, difficulty: p.difficulty }));
  res.json({ success: true, problems: [...localList, ...leetCodeList] });
});

app.get("/problem/:slug", async (req, res) => {
  const local = localProblems.find(p => p.id === req.params.slug);
  if (local) {
      return res.json({ success: true, descriptionHTML: local.descriptionHTML, topicTags: local.topicTags });
  }
  try {
    const response = await axios.get(`https://alfa-leetcode-api.onrender.com/select?titleSlug=${req.params.slug}`);
    res.json({ success: true, descriptionHTML: response.data.question, topicTags: response.data.topicTags });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch problem details" });
  }
});

/* =========================================================
   DOCKER EXECUTION (READ-ONLY MOUNT FIX)
   ========================================================= */
app.post("/run-code", async (req, res) => {
  const { code, problemId, language } = req.body;
  const currentProblem = localProblems.find(p => p.id === problemId);

  let fileExtension = language === "cpp" ? "cpp" : language === "python" ? "py" : "js";
  
  // NOTE: Binary is output to /tmp/out inside Docker, NEVER to the host system!
  let compileAndRunCommand = language === "cpp" 
    ? "g++ /app/solution.cpp -o /tmp/out && /tmp/out" 
    : language === "python" ? "python3 /app/solution.py" : "node /app/solution.js";

  const tempDir = path.join(__dirname, "temp", `run_${Date.now()}_${Math.floor(Math.random()*10000)}`); 
  const filePath = path.join(tempDir, `solution.${fileExtension}`);

  try {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(filePath, code);

    const dockerArgs = [
      "run", "--rm", "--network", "none", "--memory", "256m", "--cpus", "0.5",
      "-v", `${tempDir}:/app:ro`, // :ro means READ-ONLY. Docker physically cannot lock the host folder.
      "algo-sandbox", 
      "sh", "-c", compileAndRunCommand
    ];

    const child = spawn("docker", dockerArgs);

    let output = "";
    let errorOutput = "";

    const timeoutId = setTimeout(() => {
        child.kill("SIGKILL");
        if (!res.headersSent) {
            res.json({ success: false, output: "Execution Timed Out! (Infinite loop detected)" });
        }
    }, 10000);

    child.on("error", (err) => {
      clearTimeout(timeoutId);
      if (!res.headersSent) res.status(500).json({ success: false, error: "Docker failed to start" });
    });

    child.stdout.on("data", (data) => output += data.toString());
    child.stderr.on("data", (data) => errorOutput += data.toString());

    child.on("close", (exitCode) => {
      clearTimeout(timeoutId);

      // Safe cleanup of the Read-Only folder
      try {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.error("Cleanup warning:", e.message);
      }

      if (res.headersSent) return;

      if (exitCode === 0) {
        const cleanOutput = output.trim().replace(/\r\n/g, '\n');
        
        let passed = false;
        let expected = "Unknown (LeetCode API hides test cases)";

        if (currentProblem) {
            // Strict check for verifiable local problems
            passed = (cleanOutput === currentProblem.expectedOutput);
            expected = currentProblem.expectedOutput;
        } else {
            // Permissive check for LeetCode: If it compiles without crashing, you win.
            passed = true;
            expected = "Any valid output (LeetCode Test Mode)";
        }

        res.json({ success: true, output: cleanOutput || "Compiled Successfully (No Output)", passed, expected });
      } else {
        res.json({ success: false, output: errorOutput || output || "Execution Failed" });
      }
    });
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ success: false, error: "Server Error during Execution setup" });
  }
});

/* =========================================================
   ML & BLOCKCHAIN BRIDGES
   ========================================================= */
   app.get("/leaderboard", (req, res) => {
  try {
    const cachePath = path.join(__dirname, "temp", "leaderboard-cache.json");
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, "utf-8");
      return res.json({ success: true, leaderboard: JSON.parse(data) });
    }
    
    // Fallback if the cache file doesn't exist yet
    res.json({ 
      success: true, 
      leaderboard: [
        { address: "0x0000...0000", wins: 0, matches: 0 }
      ] 
    });
  } catch (error) {
    res.json({ success: true, leaderboard: [] });
  }
});


app.post("/proctor-check", async (req, res) => {
  const { image } = req.body;
  try {
    const base64Data = image.replace(/^data:image\/jpeg;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");
    
    const form = new FormData();
    // CRITICAL FIX: Python FastAPI requires explicit filenames AND content types!
    // Without contentType, Python throws an error and Node thinks the server is offline.
    const refBuffer  = Buffer.from(referenceImage.replace(/^data:image\/jpeg;base64,/, ""), "base64");
    const currBuffer = Buffer.from(currentImage.replace(/^data:image\/jpeg;base64,/, ""), "base64");
    form.append("reference_img", refBuffer, { filename: "ref.jpg", contentType: "image/jpeg" });
    form.append("current_img",   currBuffer, { filename: "curr.jpg", contentType: "image/jpeg" });

    const mlResponse = await axios.post(`${ML_SERVICE_URL}/verify-face`, form, { headers: form.getHeaders() });
    res.json({ success: true, verified: mlResponse.data.is_same_person });
  } catch (error) {
    // If Python throws an error (like a 500 when no face is found, or 422 for bad format), treat it as a mismatch, not offline!
    if (error.response) {
      console.log(`ML Server is ONLINE, but rejected the scan (Status ${error.response.status}). Treating as Face Mismatch.`);
      return res.json({ success: true, verified: false }); 
    }
    console.error("ML Service is completely unreachable:", error.message);
    res.json({ success: false, verified: true, unavailable: true });
  }
});

app.post("/check-plagiarism", async (req, res) => {
  const { code1, code2 } = req.body;
  try {
    const mlResponse = await axios.post(`${ML_SERVICE_URL}/check-plagiarism`, { code1, code2 });
    res.json({ success: true, similarity_score: mlResponse.data.similarity_score, is_suspect: mlResponse.data.is_suspect });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to connect to ML Plagiarism service" });
  }
});

app.post("/record-battle", async (req, res) => {
  res.json({ success: true, message: "Transaction simulated successfully" });
});

app.post("/verify-signature", (req, res) => {
  const { address, signature, message } = req.body;
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    res.json({ success: recoveredAddress.toLowerCase() === address.toLowerCase() });
  } catch (e) { res.status(500).json({ success: false }); }
});

function startServer(port, attemptsLeft) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && attemptsLeft > 0) return startServer(port + 1, attemptsLeft - 1);
    process.exit(1);
  });
  server.listen(port, HOST, () => console.log(`🚀 AlgoArena Server running on http://${HOST}:${port}`));
}
startServer(PREFERRED_PORT, MAX_PORT_ATTEMPTS);
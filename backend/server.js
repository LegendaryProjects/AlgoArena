import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import dotenv from "dotenv";

const app = express();
const PREFERRED_PORT = Number(process.env.PORT) || 5001;
const MAX_PORT_ATTEMPTS = 20;

app.use(cors());
// Increase payload size for webcam images
app.use(express.json({ limit: "10mb" }));

// Needed for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../blockchain/.env") });

/* =========================================================
   1. SOCKET.IO (REAL-TIME MULTIPLAYER SYNC & REFREE)
   ========================================================= */
  
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] }
});

const activeRooms = {};
const roomTimers = {}; // Store the actual timer so we can stop it early!

io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
        
        const roomSize = io.sockets.adapter.rooms.get(roomId).size;
        io.to(roomId).emit('room_status', { count: roomSize });

        // Start Match
        if (roomSize === 2 && !activeRooms[roomId]) {
            activeRooms[roomId] = true;
            io.to(roomId).emit('battle_start', { message: "Match Found! Battle starting..." });
            
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

    socket.on('code_change', ({ roomId, code }) => {
        socket.to(roomId).emit('receive_code', code);
    });

    // NEW: Listen for the Knockout Blow!
    socket.on('claim_victory', ({ roomId, winnerId }) => {
        if (roomTimers[roomId]) {
            clearInterval(roomTimers[roomId]); // Stop the clock!
            delete activeRooms[roomId];
        }
        // Tell everyone in the room who won
        io.to(roomId).emit('match_over', { winnerId });
    });

    socket.on('disconnect', () => {
        console.log("User Disconnected", socket.id);
    });
});

/* =========================================================
   2. DOCKER (SECURE C++ CODE EXECUTION & DYNAMIC JUDGING)
   ========================================================= */

// THE PROBLEM BANK
const problems = [
  {
    id: 1,
    title: "The Arena Gateway",
    difficulty: "Easy",
    description: "Welcome to your first trial. Write a C++ program that outputs exactly:\n\nAlgoArena 2026",
    expectedOutput: "AlgoArena 2026"
  },
  {
    id: 2,
    title: "Echo Chamber",
    difficulty: "Medium",
    description: "Loops are essential. Write a C++ program that prints the numbers 1 through 5, with each number on a new line.",
    expectedOutput: "1\n2\n3\n4\n5"
  },
  {
    id: 3,
    title: "The Matrix Master",
    difficulty: "Hard",
    description: "You have reached the final layer. Write a C++ program that prints exactly:\n\nNeo is the One",
    expectedOutput: "Neo is the One"
  }
];

// ENDPOINT: Send the list of problems to the frontend (WITHOUT the answers!)
/* =========================================================
   ALFA LEETCODE API INTEGRATION
   ========================================================= */

// 1. Fetch a list of problems for the dropdown
app.get("/problems", async (req, res) => {
  try {
    console.log("Fetching live questions from ALFA LeetCode API...");
    // Fetch top 100 problems to keep the dropdown broad but manageable
    const response = await axios.get("https://alfa-leetcode-api.onrender.com/problems?limit=100");
    
    // Map the ALFA API response to match our frontend's expected format
    const safeProblems = response.data.problemsetQuestionList.map(p => ({
      id: p.titleSlug, // We use the slug as the unique ID now!
      title: p.title,
      difficulty: p.difficulty,
    }));

    res.json({ success: true, problems: safeProblems });
  } catch (error) {
    console.error("ALFA API Error:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch LeetCode problems" });
  }
});

// 2. Fetch the specific description and sample cases for a selected problem
app.get("/problem/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const response = await axios.get(`https://alfa-leetcode-api.onrender.com/select?titleSlug=${slug}`);
    
    // ALFA returns the description as HTML, which we will render in React
    res.json({ 
      success: true, 
      descriptionHTML: response.data.question,
      topicTags: response.data.topicTags
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch problem details" });
  }
});

// ENDPOINT: Run code and check against the specific problem ID
// UPGRADED ENDPOINT: Run code dynamically based on Language
app.post("/run-code", async (req, res) => {
  // We now expect a 'language' parameter from the frontend!
  const { code, problemId, language } = req.body;
  
  const currentProblem = problems.find(p => p.id === problemId);
  if (!currentProblem) {
    return res.status(400).json({ success: false, error: "Problem not found" });
  }

  // 1. Determine file extension and execution command based on language
  let fileExtension = "";
  let compileAndRunCommand = "";

  if (language === "cpp") {
    fileExtension = "cpp";
    compileAndRunCommand = `g++ solution.cpp -o out && ./out`;
  } else if (language === "python") {
    fileExtension = "py";
    compileAndRunCommand = `python3 solution.py`;
  } else if (language === "javascript") {
    fileExtension = "js";
    compileAndRunCommand = `node solution.js`;
  } else {
    return res.status(400).json({ success: false, error: "Unsupported language" });
  }

  const fileName = `solution.${fileExtension}`;
  const tempDir = path.join(__dirname, "temp", `run_${Date.now()}`); // Unique folder per run
  const filePath = path.join(tempDir, fileName);

  try {
    // Create an isolated folder for this specific execution
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(filePath, code);

    // 2. Pass the dynamic command to Docker
    const dockerArgs = [
      "run", "--rm", "--network", "none", "--memory", "128m", "--cpus", "0.5",
      "-v", `${tempDir}:/home/student`, "algo-sandbox", "sh", "-c", compileAndRunCommand
    ];

    const child = spawn("docker", dockerArgs);
    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (data) => output += data.toString());
    child.stderr.on("data", (data) => errorOutput += data.toString());

    child.on("close", (exitCode) => {
      // Clean up the temporary folder after execution
      fs.rmSync(tempDir, { recursive: true, force: true });
      
      if (exitCode === 0) {
        const cleanOutput = output.trim().replace(/\r\n/g, '\n');
        const expectedClean = currentProblem.expectedOutput.trim().replace(/\r\n/g, '\n');
        
        const passed = cleanOutput === expectedClean;

        res.json({ success: true, output: cleanOutput, passed: passed, expected: expectedClean });
      } else {
        res.json({ success: false, output: errorOutput || "Execution Failed" });
      }
    });
  } catch (error) {
    console.error("Execution Error:", error);
    res.status(500).json({ success: false, error: "Server error during execution" });
  }
});

/* =========================================================
   3. PYTHON ML BRIDGE (AI PROCTORING)
   ========================================================= */
app.post("/proctor-check", async (req, res) => {
  const { image } = req.body;

  try {
    const base64Data = image.replace(/^data:image\/jpeg;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");
    const form = new FormData();

    form.append("reference_img", imageBuffer, "ref.jpg");
    form.append("current_img", imageBuffer, "curr.jpg");

    const mlResponse = await axios.post("http://localhost:8000/verify-face", form, {
      headers: { ...form.getHeaders() }
    });

    res.json({
      success: true,
      verified: mlResponse.data.is_same_person,
      distance: mlResponse.data.distance
    });
  } catch (error) {
    console.error("ML Service Error:", error.message);
    res.status(500).json({ success: false, error: "Failed to connect to ML service" });
  }
});

/* =========================================================
   4. WEB3 & BLOCKCHAIN SETUP (HARDHAT)
   ========================================================= */
// Connect to Sepolia by default, or fall back to a local Hardhat node if one is running.
const rpcUrl = process.env.ALCHEMY_SEPOLIA_URL || process.env.SEPOLIA_RPC_URL || "http://127.0.0.1:8545";
const provider = new ethers.JsonRpcProvider(rpcUrl);

// Use the deployer private key from the blockchain env file.
const privateKey = process.env.PRIVATE_KEY ? `0x${process.env.PRIVATE_KEY.replace(/^0x/, "")}` : "";
if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY in blockchain/.env");
}
const wallet = new ethers.Wallet(privateKey, provider);

// Prefer the Sepolia deployment if present, otherwise use the local Hardhat deployment.
const contractAddress = process.env.CONTRACT_ADDRESS || "0x63ED8bA3073BE722fdb30cb789966e6928c1a09a";
const abiPath = path.join(__dirname, "AlgoArena.json");
const contractABI = JSON.parse(fs.readFileSync(abiPath, "utf8")).abi;

const algoArenaContract = new ethers.Contract(contractAddress, contractABI, wallet);
const leaderboardCachePath = path.join(__dirname, "temp", "leaderboard-cache.json");

let battleHistory = [];
try {
  if (fs.existsSync(leaderboardCachePath)) {
    battleHistory = JSON.parse(fs.readFileSync(leaderboardCachePath, "utf8"));
  }
} catch (error) {
  console.warn("Could not load leaderboard cache:", error.message);
  battleHistory = [];
}

const saveBattleHistory = () => {
  fs.mkdirSync(path.dirname(leaderboardCachePath), { recursive: true });
  fs.writeFileSync(leaderboardCachePath, JSON.stringify(battleHistory, null, 2));
};

// Endpoint to record a battle on the blockchain
app.post("/record-battle", async (req, res) => {
  const { winner, loser } = req.body;
  
  try {
    console.log(`⛓️ Recording battle to blockchain: ${winner} vs ${loser}...`);
    
    // Call the function from your Solidity contract
    const tx = await algoArenaContract.recordBattle(winner, loser);
    await tx.wait(); // Wait for the block to be mined

    battleHistory.unshift({
      winner,
      loser,
      date: new Date().toLocaleString()
    });
    saveBattleHistory();

    console.log(`✅ Battle recorded! Transaction Hash: ${tx.hash}`);
    res.json({ success: true, transactionHash: tx.hash });
    
  } catch (error) {
    console.error("Blockchain Error:", error);
    res.status(500).json({ success: false, error: "Failed to record on blockchain" });
  }
});

/* =========================================================
   5. LEADERBOARD (READING THE BLOCKCHAIN)
   ========================================================= */
app.get("/leaderboard", async (req, res) => {
  try {
    res.json({ success: true, leaderboard: battleHistory });

  } catch (error) {
    console.error("Leaderboard Error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch leaderboard" });
  }
});

/* =========================================================
   6. WEB3 AUTHENTICATION (METAMASK LOGIN)
   ========================================================= */
app.post("/verify-signature", (req, res) => {
  const { address, signature, message } = req.body;

  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ success: false, error: "Signature mismatch" });
    }

    res.json({ success: true, user: address });
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(500).json({ success: false, error: "Server error during verification" });
  }
});

/* =========================================================
   START SERVER
   ========================================================= */
function startServer(port, attemptsLeft) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is busy. Retrying on port ${nextPort}...`);
      startServer(nextPort, attemptsLeft - 1);
      return;
    }

    if (error.code === "EADDRINUSE") {
      console.error(`No free port found after ${MAX_PORT_ATTEMPTS + 1} attempts.`);
      process.exit(1);
    }

    throw error;
  });

  server.listen(port, () => {
    console.log(`AlgoArena Master Server running perfectly on port ${port}`);
  });
}

startServer(PREFERRED_PORT, MAX_PORT_ATTEMPTS);
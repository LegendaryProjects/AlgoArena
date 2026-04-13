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

const app = express();
const PORT = 5000;

app.use(cors());
// Increase payload size for webcam images
app.use(express.json({ limit: "10mb" }));

// Needed for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================================================
   1. SOCKET.IO (REAL-TIME MULTIPLAYER SYNC)
   ========================================================= */
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Make sure this matches your Vite frontend port
    methods: ["GET", "POST"]
  }
});

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
app.get("/problems", (req, res) => {
  const safeProblems = problems.map(p => ({
    id: p.id,
    title: p.title,
    difficulty: p.difficulty,
    description: p.description
  }));
  res.json({ success: true, problems: safeProblems });
});

// ENDPOINT: Run code and check against the specific problem ID
app.post("/run-code", async (req, res) => {
  const { code, problemId } = req.body;
  
  // Find the problem the user is trying to solve
  const currentProblem = problems.find(p => p.id === problemId);
  if (!currentProblem) {
    return res.status(400).json({ success: false, error: "Problem not found" });
  }

  const fileName = `solution_${Date.now()}.cpp`;
  const tempDir = path.join(__dirname, "temp");
  const filePath = path.join(tempDir, fileName);

  try {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    fs.writeFileSync(filePath, code);

    const dockerArgs = [
      "run", "--rm", "--network", "none", "--memory", "128m", "--cpus", "0.5",
      "-v", `${tempDir}:/home/student`, "algo-sandbox", "sh", "-c", `g++ ${fileName} -o out && ./out`
    ];

    const child = spawn("docker", dockerArgs);
    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (data) => output += data.toString());
    child.stderr.on("data", (data) => errorOutput += data.toString());

    child.on("close", (exitCode) => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      
      if (exitCode === 0) {
        // Clean up formatting to ignore trailing spaces/newlines
        const cleanOutput = output.trim().replace(/\r\n/g, '\n');
        const expectedClean = currentProblem.expectedOutput.trim().replace(/\r\n/g, '\n');
        
        const passed = cleanOutput === expectedClean;

        res.json({ 
          success: true, 
          output: cleanOutput,
          passed: passed,
          expected: expectedClean
        });
      } else {
        res.json({ success: false, output: errorOutput || "Compilation Failed" });
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
// Connect to the local Hardhat Blockchain
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

// Use Hardhat's default Account #0 Private Key to pay for gas fees
const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const wallet = new ethers.Wallet(privateKey, provider);

// Load the Contract using the address you just generated
// MAKE SURE THIS ADDRESS MATCHES YOUR LATEST HARDHAT DEPLOYMENT!
const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const abiPath = path.join(__dirname, "AlgoArena.json");
const contractABI = JSON.parse(fs.readFileSync(abiPath, "utf8")).abi;

const algoArenaContract = new ethers.Contract(contractAddress, contractABI, wallet);

// Endpoint to record a battle on the blockchain
app.post("/record-battle", async (req, res) => {
  const { winner, loser } = req.body;
  
  try {
    console.log(`⛓️ Recording battle to blockchain: ${winner} vs ${loser}...`);
    
    // Call the function from your Solidity contract
    const tx = await algoArenaContract.recordBattle(winner, loser);
    await tx.wait(); // Wait for the block to be mined

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
    // Search the blockchain for every 'BattleRecorded' event
    const filter = algoArenaContract.filters.BattleRecorded();
    const events = await algoArenaContract.queryFilter(filter);

    // Format the raw blockchain data into clean JavaScript objects
    const history = events.map(event => ({
      winner: event.args[0],
      loser: event.args[1],
      // Solidity timestamps are in seconds, JS needs milliseconds
      date: new Date(Number(event.args[2]) * 1000).toLocaleString() 
    }));

    // Reverse the array so the newest battles show up at the top
    res.json({ success: true, leaderboard: history.reverse() });

  } catch (error) {
    console.error("Leaderboard Error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch leaderboard" });
  }
});

/* =========================================================
   START SERVER
   ========================================================= */
server.listen(PORT, () => {
  console.log(`✅ AlgoArena Master Server running perfectly on port ${PORT}`);
});
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

/* =========================================
   INITIAL SETUP
========================================= */

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


/* =========================================
   SOCKET.IO SETUP (REALTIME COLLAB)
========================================= */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {

  console.log("User Connected:", socket.id);

  socket.on("join_room", (roomId) => {

    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);

  });

  socket.on("code_change", ({ roomId, code }) => {

    socket.to(roomId).emit("receive_code", code);

  });

  socket.on("disconnect", () => {

    console.log("User Disconnected:", socket.id);

  });

});


/* =========================================
   CODE EXECUTION ENDPOINT
========================================= */

app.post("/run-code", async (req, res) => {

  const { code } = req.body;

  const fileName = `solution_${Date.now()}.cpp`;
  const tempDir = path.join(__dirname, "temp");
  const filePath = path.join(tempDir, fileName);

  try {

    // Create temp folder safely
    fs.mkdirSync(tempDir, { recursive: true });

    // Save code to file
    fs.writeFileSync(filePath, code);

    const dockerArgs = [
      "run",
      "--rm",
      "--network", "none",
      "--memory", "128m",
      "--cpus", "0.5",
      "-v", `${tempDir}:/home/student`,
      "algo-sandbox",
      "sh",
      "-c",
      `g++ ${fileName} -o out && ./out`
    ];

    const child = spawn("docker", dockerArgs);

    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    child.on("error", (err) => {

      console.error("Docker execution failed:", err);

      res.status(500).json({
        success: false,
        error: "Docker execution failed"
      });

    });

    child.on("close", (exitCode) => {

      // Delete cpp file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete compiled binary
      const binaryPath = path.join(tempDir, "out");
      if (fs.existsSync(binaryPath)) {
        fs.unlinkSync(binaryPath);
      }

      if (exitCode === 0) {

        res.json({
          success: true,
          output: output
        });

      } else {

        res.json({
          success: false,
          output: errorOutput || "Execution failed or timed out"
        });

      }

    });

  } catch (error) {

    console.error("Execution Error:", error);

    res.status(500).json({
      success: false,
      error: "Server error during execution"
    });

  }

});


/* =========================================
   FACE VERIFICATION (PROCTORING)
========================================= */

app.post("/proctor-check", async (req, res) => {

  const { image } = req.body;

  try {

    const base64Data = image.replace(/^data:image\/jpeg;base64,/, "");

    const imageBuffer = Buffer.from(base64Data, "base64");

    const form = new FormData();

    form.append("reference_img", imageBuffer, "ref.jpg");
    form.append("current_img", imageBuffer, "curr.jpg");

    const mlResponse = await axios.post(
      "http://localhost:8000/verify-face",
      form,
      {
        headers: {
          ...form.getHeaders()
        }
      }
    );

    res.json({
      success: true,
      verified: mlResponse.data.is_same_person,
      distance: mlResponse.data.distance
    });

  } catch (error) {

    console.error("ML Service Error:", error.message);

    res.status(500).json({
      success: false,
      error: "Failed to connect to ML service"
    });

  }

});


/* =========================================
   START SERVER
========================================= */

server.listen(PORT, () => {

  console.log(`AlgoArena backend running on port ${PORT}`);

});
#!/bin/bash

echo "⚔️ Starting AlgoArena Microservices..."

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

# 1. Start the Python ML Service (Port 8000)
echo "[1/3] Booting AI Anti-Cheat & Plagiarism Engine..."
cd ml-services
# Ensure you have uvicorn and fastapi installed: pip install fastapi uvicorn deepface scikit-learn python-multipart
uvicorn main:app --reload --port 8000 &
ML_PID=$!
cd ..

# 2. Start the Node.js Game Server (Port 5001)
echo "[2/3] Booting Socket.io & Docker Execution Engine..."
cd backend
# Ensure Docker daemon is running on your machine!
HOST=0.0.0.0 node server.js &
BACKEND_PID=$!
cd ..

# 3. Start the React Frontend (Port 5173)
echo "[3/3] Booting React Frontend..."
cd frontend/AlgoArena_front
npm run dev --host &
FRONTEND_PID=$!
cd ../..

echo "✅ All systems operational!"
echo "➡️  Frontend (this machine): http://localhost:5173"
echo "➡️  Frontend (LAN):          http://$LAN_IP:5173"
echo "➡️  Backend (LAN):           http://$LAN_IP:5001"
echo "➡️  ML API (this machine):   http://localhost:8000/docs"
echo ""
echo "Press [CTRL+C] to gracefully shut down the Arena."

# Trap CTRL+C to kill all background processes
trap "echo 'Shutting down Arena...'; kill $ML_PID $BACKEND_PID $FRONTEND_PID; exit" SIGINT

# Keep the script running
wait
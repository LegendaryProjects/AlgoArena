#!/bin/bash

echo "⚔️ Starting AlgoArena Microservices..."

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
node server.js &
BACKEND_PID=$!
cd ..

# 3. Start the React Frontend (Port 5173)
echo "[3/3] Booting React Frontend..."
cd frontend/AlgoArena_front
npm run dev &
FRONTEND_PID=$!
cd ../..

echo "✅ All systems operational!"
echo "➡️  Frontend: http://localhost:5173"
echo "➡️  Backend:  http://localhost:5001"
echo "➡️  ML API:   http://localhost:8000/docs"
echo ""
echo "Press [CTRL+C] to gracefully shut down the Arena."

# Trap CTRL+C to kill all background processes
trap "echo 'Shutting down Arena...'; kill $ML_PID $BACKEND_PID $FRONTEND_PID; exit" SIGINT

# Keep the script running
wait
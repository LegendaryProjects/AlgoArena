# AlgoArena

AlgoArena is a next-generation, blockchain-verified 1v1 coding battle platform. It pits developers against each other in real-time algorithm challenges while utilizing AI-powered proctoring and secure Docker sandboxing to ensure fair, anti-cheat environments. Victories are immutably minted to the blockchain.

---

## Core Features

* **Real-Time Multiplayer:** Synchronized 1v1 battles and spectator modes powered by `Socket.io`.
* **Secure Code Execution:** Ephemeral, read-only Docker containers (`algo-sandbox`) evaluate C++, Python, and Node.js submissions with strict memory/CPU limits and auto-kill timeouts.
* **AI Anti-Cheat Proctoring:** A Python microservice using `DeepFace` actively scans webcams during battles to ensure the operator's identity matches and no one swaps in.
* **Plagiarism Detection:** Machine Learning (TF-IDF Cosine Similarity) compares opponent code upon submission to deny copied logic.
* **Blockchain Verification:** Web3 integration via `ethers.js` and Solidity smart contracts automatically mints verified victories to the Sepolia testnet.
* **Dynamic Problem Bank:** Fetches live algorithm descriptions from the ALFA LeetCode API, blended with strict locally-verifiable test cases.

---

## Tech Stack

| Domain | Technologies Used |
| :--- | :--- |
| **Frontend** | React (Vite), Monaco Editor, Socket.io-client, Ethers.js |
| **Backend** | Node.js, Express, Socket.io, Docker Engine |
| **Machine Learning** | Python, FastAPI, DeepFace, Scikit-learn, OpenCV |
| **Blockchain** | Solidity, Hardhat, Ethers.js |

---

## Local Setup & Installation

Because AlgoArena uses a microservice architecture, you need to run three separate environments simultaneously. 

### Prerequisites
* **Node.js** (v18+)
* **Python** (3.10+)
* **Docker Desktop** (Running in the background)
* **MetaMask** (Browser extension for Web3 features)

### 1. Build the Execution Sandbox
The backend relies on a secure Alpine Linux Docker image to compile code safely. You must build this image once before starting the server.

```bash
cd backend
docker build -t algo-sandbox .
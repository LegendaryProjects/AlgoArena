import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function deploy() {
  const RPC_URL = process.env.ALCHEMY_SEPOLIA_URL;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;

  if (!RPC_URL || !PRIVATE_KEY) {
    throw new Error("Missing ALCHEMY_SEPOLIA_URL or PRIVATE_KEY in .env");
  }

  // Connect to Sepolia
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log(`Deploying with account: ${wallet.address}`);

  // Get contract ABI and bytecode
  const builtPath = path.join(
    __dirname,
    "../ignition/deployments/chain-31337/artifacts/AlgoArenaModule#AlgoArena.json"
  );

  if (!fs.existsSync(builtPath)) {
    throw new Error(
      `Contract artifact not found at ${builtPath}. Please run: npx hardhat compile`
    );
  }

  const artifact = JSON.parse(fs.readFileSync(builtPath, "utf8"));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode;

  const AlgoArenaFactory = new ethers.ContractFactory(abi, bytecode, wallet);

  console.log("Deploying AlgoArena contract...");
  const contract = await AlgoArenaFactory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`✅ AlgoArena deployed successfully!`);
  console.log(`Contract address: ${address}`);

  // Save deployment address
  const deploymentFile = path.join(
    __dirname,
    "../ignition/deployments/chain-11155111/deployed_addresses.json"
  );
  const deploymentDir = path.dirname(deploymentFile);
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  const deployment = {
    "AlgoArenaModule#AlgoArena": address
  };
  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
  console.log(`Deployment saved to ${deploymentFile}`);
}

deploy().catch((error) => {
  console.error(error);
  process.exit(1);
});

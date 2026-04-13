import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AlgoArenaModule", (m) => {
  // Tell Hardhat to deploy the AlgoArena smart contract
  const algoArena = m.contract("AlgoArena");

  return { algoArena };
});
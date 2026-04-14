import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import dotenv from "dotenv";
import { configVariable, defineConfig } from "hardhat/config";

dotenv.config();

const envRpcUrl = process.env.ALCHEMY_SEPOLIA_URL;
const envPrivateKey = process.env.PRIVATE_KEY
  ? `0x${process.env.PRIVATE_KEY.replace(/^0x/, "")}`
  : undefined;

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: "0.8.24",
  networks: {
    sepolia: {
      type: "http",
      chainType: "l1",
      url: envRpcUrl ?? configVariable("SEPOLIA_RPC_URL"),
      accounts: [envPrivateKey ?? configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
});

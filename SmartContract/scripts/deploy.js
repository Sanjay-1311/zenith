import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import defaultNetwork from "../hardhat.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    // Get the provider
    const provider = new ethers.JsonRpcProvider("http://localhost:8545");
    
    // Get signer - getSigner() returns a Promise in ethers v6
    const signer = await provider.getSigner(0);
    const signerAddress = await signer.getAddress();
    console.log("Deploying contracts with account:", signerAddress);

    // Read compiled contract
    const contractPath = path.join(__dirname, "../artifacts/contracts/StreamPay.sol/StreamPay.json");
    const contractArtifact = JSON.parse(fs.readFileSync(contractPath, "utf8"));

    // Create contract factory
    const contractFactory = new ethers.ContractFactory(
      contractArtifact.abi,
      contractArtifact.bytecode,
      signer
    );

    // Deploy
    const stream = await contractFactory.deploy();
    await stream.waitForDeployment();

    const address = await stream.getAddress();
    console.log("Contract deployed to:", address);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
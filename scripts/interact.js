import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    // Connect to the local Hardhat node
    const provider = new ethers.JsonRpcProvider("http://localhost:8545");
    const signer = await provider.getSigner(0);

    // Contract address from deployment
    const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    // Read contract ABI
    const contractPath = path.join(__dirname, "../artifacts/contracts/StreamPay.sol/StreamPay.json");
    const contractArtifact = JSON.parse(fs.readFileSync(contractPath, "utf8"));

    // Create contract instance
    const streamPay = new ethers.Contract(contractAddress, contractArtifact.abi, signer);

    console.log("Connected to StreamPay contract at:", contractAddress);
    console.log("Contract ABI loaded successfully");
    console.log("Available functions:", contractArtifact.abi.filter(f => f.type === "function").map(f => f.name));

  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();

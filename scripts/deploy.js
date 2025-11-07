const hre = require("hardhat");

async function main() {
  console.log("Deploying Token contract...");

  const Token = await hre.ethers.getContractFactory("Token");
  const token = await Token.deploy("TestToken", "TEST");

  await token.waitForDeployment();
  const address = await token.getAddress();

  console.log("Token deployed to:", address);
  console.log("\nPlease update your .env file with:");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


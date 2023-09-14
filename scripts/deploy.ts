import { ethers } from "hardhat";

async function main() {
  const admin = await ethers.deployContract("Admin");
  await admin.waitForDeployment();
  console.log(`admin deployed: ${await admin.getAddress()}`);

  const loan = await ethers.deployContract("Loan");
  await loan.waitForDeployment();
  console.log(`loan deployed: ${await loan.getAddress()}`);

  const locker = await ethers.deployContract("Locker");
  await locker.waitForDeployment();
  console.log(`locker deployed: ${await locker.getAddress()}`);

  const loanFactory = await ethers.deployContract("LoanFactory", [admin, loan]);
  await loanFactory.waitForDeployment();
  console.log(`loanFactory deployed: ${await loanFactory.getAddress()}`);

  const lockerFactory = await ethers.deployContract("LockerFactory", [admin, locker]);
  await lockerFactory.waitForDeployment();
  console.log(`lockerFactory deployed: ${await lockerFactory.getAddress()}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { expect } from "chai";
import { ethers } from "hardhat";
import { Admin, Loan, Locker, MockToken, LoanFactory, LockerFactory } from "../typechain-types";
import { LoanInfoStruct } from "../typechain-types/contracts/Loan";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const duration = {
  seconds: function (val: number) {
    return val;
  },
  minutes: function (val: number) {
    return val * this.seconds(60);
  },
  hours: function (val: number) {
    return val * this.minutes(60);
  },
  days: function (val: number) {
    return val * this.hours(24);
  },
};

describe("Scenario", function () {
  let admin: Admin;
  let loan: Loan;
  let locker: Locker;
  let fundToken: MockToken;
  let collateralToken: MockToken;
  let loanFactory: LoanFactory;
  let lockerFactory: LockerFactory;

  let owner: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;
  let lender0: HardhatEthersSigner;
  let lender1: HardhatEthersSigner;
  let lender2: HardhatEthersSigner;

  let users: HardhatEthersSigner[];

  const decimals = 18;
  const mintAmount = ethers.parseUnits("1000", decimals);

  before(async () => {
    users = [owner, borrower, lender0, lender1, lender2] = await ethers.getSigners();

    fundToken = await ethers.deployContract("MockToken", ["FundToken", "FT", decimals]);
    await fundToken.waitForDeployment();
    collateralToken = await ethers.deployContract("MockToken", ["MockToken", "MT", decimals]);
    await collateralToken.waitForDeployment();

    for (const user of users) {
      await fundToken.mint(user.address, mintAmount);
    }
    await collateralToken.mint(borrower, mintAmount);

    admin = await ethers.deployContract("Admin");
    await admin.waitForDeployment();

    loan = await ethers.deployContract("Loan");
    await loan.waitForDeployment();

    locker = await ethers.deployContract("Locker");
    await locker.waitForDeployment();

    loanFactory = await ethers.deployContract("LoanFactory", [admin, loan]);
    await loanFactory.waitForDeployment();

    lockerFactory = await ethers.deployContract("LockerFactory", [admin, locker]);
    await lockerFactory.waitForDeployment();

    await admin.setFactories(lockerFactory, loanFactory);
  });

  it("scenario", async () => {
    const currentTimestamp = await time.latest();

    const initValue = {
      loanLimit: ethers.parseEther("600"),
      depositStartDate: currentTimestamp + duration.days(3),
      loanDurationInDays: 30,
      borrowerAPY: 2000,

      collateralRatio: 4000,
      lenderInterestAPY: 1000,
      collateralDepositStartDate: currentTimestamp + duration.days(10),

      collateralAssetPriceRatio: 10000
    };

    console.log(`0. owner adds borrower to whitelist`);
    await admin.connect(owner).addBorrower(borrower);
    

    console.log(`1. borrower creates proposal with following condition`);
    await admin
      .connect(borrower)
      .createProposal(
        [initValue.loanLimit, initValue.depositStartDate, initValue.loanDurationInDays, initValue.borrowerAPY],
        fundToken,
        collateralToken
      );

    loan = await ethers.getContractAt("Loan", await loanFactory.loans(0));
    locker = await ethers.getContractAt("Locker", await lockerFactory.lockers(0));

    await loan.info().then((result:LoanInfoStruct)=> {
      console.log(`current loan condition`)
      console.log(result);
    })  

    
    console.log(`2. owner approve proposal with additional conditions`);
    await loan.connect(owner).approveProposal(Object.values(initValue));
    await loan.info().then((result:LoanInfoStruct)=> {
      console.log(`current loan condition`)
      console.log(result);
    })

    console.log(`3. lenders start funding starting from depositStartDate until collateralDepositStartDate`);
    await time.increase(duration.days(3));

    await fundToken.connect(lender0).approve(loan, ethers.parseEther("100"));
    await loan.connect(lender0).depositFunds(ethers.parseEther("100"));

    await fundToken.connect(lender1).approve(loan, ethers.parseEther("200"));
    await loan.connect(lender1).depositFunds(ethers.parseEther("200"));

    await fundToken.connect(lender2).approve(loan, ethers.parseEther("300"));
    await loan.connect(lender2).depositFunds(ethers.parseEther("300"));

    await locker.totalFundAmount().then((result: BigInt) => {
      console.log(`collected funds: ${result.toString()}`);
    })

    console.log(`4. borrower deposits collateral starting from collateralDepositStartDate`);
    await time.increase(duration.days(7));
    const requiredCollateral = initValue.loanLimit * BigInt(initValue.collateralRatio) / 10000n;
    await collateralToken.connect(borrower).approve(loan, requiredCollateral);
    await loan.connect(borrower).depositCollateral();
    await locker.collateralAmount().then((result: BigInt) => {
      console.log(`collected collateral: ${result.toString()}`);
    })

    console.log(`5. borrower takes collected funds`);
    await loan.connect(borrower).takeLoan();
    await locker.lendAmount().then((result: BigInt) => {
      console.log(`lend amount:${result.toString()}`)
    })

    console.log(`6. borrower returns loan with interest after loanDuration(30d)`);
    await time.increase(duration.days(30));
    const requiredInterest = initValue.loanLimit * BigInt(initValue.borrowerAPY) * BigInt(initValue.loanDurationInDays) / 365n / 10000n;
    await fundToken.connect(borrower).approve(loan, initValue.loanLimit + requiredInterest);
    await loan.connect(borrower).returnLoan();
    await locker.returnedAmount().then((result: BigInt) => {
      console.log(`returned principal: ${result.toString()}`);
    })
    await locker.totalInterest().then((result: BigInt) => {
      console.log(`totalInterest: ${result.toString()}`);
    })

    console.log(`7. borrower claims collateral and lenders claim principal with interest starting from 2days after returnDueDate`);
    await time.increase(duration.days(2));
    await loan.connect(borrower).withdrawCollateral();
    await loan.connect(lender0).claim();
    await loan.connect(lender1).claim();
    await loan.connect(lender2).claim();


  });
});

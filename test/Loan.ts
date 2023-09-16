import { expect } from "chai";
import { ethers } from "hardhat";
import { Admin, Loan, Locker, MockToken } from "../typechain-types";
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

describe("Loan", function () {
  let admin: Admin;
  let loan: Loan;
  let locker: Locker;
  let fundToken: MockToken;
  let collateralToken: MockToken;
  let owner: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  const decimals = 18;

  before(async () => {
    [owner, borrower, user] = await ethers.getSigners();
    const tokenFactory = await ethers.getContractFactory("MockToken");
    fundToken = await tokenFactory.deploy("Fund Token", "MT", decimals);
    collateralToken = await tokenFactory.deploy("Collateral Token", "CT", decimals);
    await fundToken.waitForDeployment();
    await collateralToken.waitForDeployment();

    const mintAmount = ethers.parseUnits("100000", decimals);
    await fundToken.mint(owner.address, mintAmount);
    await fundToken.mint(borrower.address, mintAmount);
    await fundToken.mint(user.address, mintAmount);
    await collateralToken.mint(borrower.address, mintAmount);
  });

  this.beforeEach(async () => {
    const adminFactory = await ethers.getContractFactory("Admin");
    admin = await adminFactory.deploy();
    await admin.waitForDeployment();

    const lockerFactory = await ethers.getContractFactory("Locker");
    locker = await lockerFactory.deploy();
    await locker.waitForDeployment();
    await locker.initialize(fundToken, collateralToken);

    const currentTimestamp = await time.latest();
    const initValue = {
      admin,
      borrower,
      locker,

      loanLimit: ethers.parseEther("1000"),
      depositStartDate: currentTimestamp + duration.days(3),
      loanDurationInDays: 30,
      borrowerAPY: 2000,

      collateralRatio: 3000,
      lenderInterestAPY: 1000,
      collateralDepositStartDate: currentTimestamp + duration.days(10),

      collateralAssetPriceRatio: 10000,
    };

    const loanFactory = await ethers.getContractFactory("Loan");
    loan = await loanFactory.deploy();
    await loan.waitForDeployment();
    await loan.initialize(initValue);
    await locker.setLoanAddress(loan);
  });

  it("initialize() can't be called twice", async () => {
    const currentTimestamp = await time.latest();
    const initValue = {
      admin,
      borrower,
      locker,

      loanLimit: ethers.parseEther("1000"),
      depositStartDate: currentTimestamp + duration.days(3),
      loanDurationInDays: 30,
      borrowerAPY: 2000,

      collateralRatio: 3000,
      lenderInterestAPY: 1000,
      collateralDepositStartDate: currentTimestamp + duration.days(10),

      collateralAssetPriceRatio: 10000,
    };

    await expect(loan.initialize(initValue)).to.be.revertedWith("already initialized");
  })

  it("approveProposal() should update condition and approve loan", async () => {
    const currentTimestamp = await time.latest();
    const updateValue = [
      ethers.parseEther("1500"),
      currentTimestamp + duration.days(3),
      30,
      2000,
      3000,
      1000,
      currentTimestamp + duration.days(10),
      10000,
    ];
    await loan.approveProposal(updateValue);
    await loan.info().then((result: LoanInfoStruct) => {
      expect(result.loanLimit).to.equal(ethers.parseEther("1500"));
    });
    await loan.approved().then((result: boolean) => {
      expect(result).to.be.true;
    });
  });

  it("approveProposal() should be called only by owner", async () => {
    const currentTimestamp = await time.latest();
    const updateValue = [
      ethers.parseEther("1500"),
      currentTimestamp + duration.days(3),
      30,
      2000,
      3000,
      1000,
      currentTimestamp + duration.days(10),
      10000,
    ];
    await expect(loan.connect(user).approveProposal(updateValue)).to.be.revertedWith("only owner can call");
  })

  it("updateCollateralAssetPriceRatio() should change collateralAssetPriceRatio variable", async () => {
    const ratioBefore = (await loan.info()).collateralAssetPriceRatio;
    await loan.updateCollateralAssetPriceRatio(20000);
    const ratioAfter = (await loan.info()).collateralAssetPriceRatio;
    expect(ratioBefore).to.equal(BigInt(10000));
    expect(ratioAfter).to.equal(BigInt(20000));
  });

  it("updateCollateralAssetPriceRatio() should be called only by owner", async () => {
    await expect(loan.connect(user).updateCollateralAssetPriceRatio(20000)).to.be.revertedWith("only owner can call");
  })

  it("depositFunds() should deposit funds into locker", async () => {
    await time.increase(duration.days(3));
    await locker.deposits(user).then((amount: BigInt) => {
      expect(amount).to.equal(BigInt(0));
    });

    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));
    await locker.deposits(user).then((amount: BigInt) => {
      expect(amount).to.equal(ethers.parseEther("100"));
    });
  });

  it("depositFunds() can't deposit over loanLimit", async () => {
    await time.increase(duration.days(3));

    await fundToken.connect(user).approve(loan, ethers.parseEther("1100"));
    await expect(loan.connect(user).depositFunds(ethers.parseEther("1100"))).to.be.revertedWith("can't deposit more than loan limit");
  });

  it("depositFunds() shouldn't work before depositStartDate or after collateralDepositStartDate", async () => {
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await expect(loan.connect(user).depositFunds(ethers.parseEther("100"))).to.be.revertedWith("currently unavailable");
    await fundToken.connect(user).approve(loan, 0);
    await time.increase(duration.days(11));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await expect(loan.connect(user).depositFunds(ethers.parseEther("100"))).to.be.revertedWith("currently unavailable");
  });

  it("depositCollateral() should deposit collateral into locker", async () => {
    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));
    await time.increase(duration.days(7));
    await locker.collateralAmount().then((amount: BigInt) => {
      expect(amount).to.equal(BigInt(0));
    });
    await collateralToken.connect(borrower).approve(loan, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await locker.collateralAmount().then((amount: BigInt) => {
      expect(amount).to.equal(ethers.parseEther("30"));
    });
  });

  it("depositCollateral() should be called by borrower", async () => {
    await time.increase(duration.days(10));
    await expect(loan.connect(user).depositCollateral()).to.be.revertedWith("only borrower can call");
  });

  it("depositCollateral() shouldn't work before collateralDepositStartDate or 3 days after collateralDepositStartDate", async () => {
    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));
    await collateralToken.connect(borrower).approve(loan, ethers.parseEther("30"));
    await expect(loan.connect(borrower).depositCollateral()).to.be.revertedWith("currently unavailable");
    await time.increase(duration.days(10));
    await expect(loan.connect(borrower).depositCollateral()).to.be.revertedWith("currently unavailable");
  });

  it("takeLoan() should work properly", async () => {
    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await collateralToken.connect(borrower).approve(loan, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();

    const balanceBefore = await fundToken.balanceOf(borrower);
    await loan.connect(borrower).takeLoan();
    const balanceAfter = await fundToken.balanceOf(borrower);
    expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("100"));
  });

  it("takeLoan() should be called by borrower", async () => {
    await expect(loan.connect(user).takeLoan()).to.be.revertedWith("only borrower can call");
  });

  it("takeLoan() shouldn't work before collateralDepositStartDate or after loanDuration", async () => {
    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(3));
    await expect(loan.connect(borrower).takeLoan()).to.be.revertedWith("currently unavailable");

    await time.increase(duration.days(4));
    await collateralToken.connect(borrower).approve(loan, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();

    await time.increase(duration.days(60));
    await expect(loan.connect(borrower).takeLoan()).to.be.revertedWith("currently unavailable");
  });

  it("takeLoan() shouldn't work before collateral has been deposited", async () => {
    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await expect(loan.connect(borrower).takeLoan()).to.be.revertedWith("collateral required to take loan");
  });

  it("returnLoan() should work properly", async () => {
    const borrowerInterestRate = (2000n * 30n) / 365n;
    const borrowerInterest = (ethers.parseEther("100") * borrowerInterestRate) / 10000n;

    const lenderInterestRate = (1000n * 30n) / 365n;
    const lenderInterest = (ethers.parseEther("100") * lenderInterestRate) / 10000n;

    const lockerApproveAmount = ethers.parseEther("100") + lenderInterest;

    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await collateralToken.connect(borrower).approve(loan, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(30));

    await fundToken.connect(borrower).approve(loan, ethers.parseEther("100") + borrowerInterest);

    const adminFeeBefore = await admin.collectedFees(fundToken);
    const totalBalanceBefore = await locker.totalFundAmount();
    const lenderInterestBefore = await locker.totalInterest();

    await loan.connect(borrower).returnLoan();

    const adminFeeAfter = await admin.collectedFees(fundToken);
    const totalBalanceAfter = await locker.totalFundAmount();
    const lenderInterestAfter = await locker.totalInterest();

    expect(adminFeeAfter - adminFeeBefore).to.equal(borrowerInterest - lenderInterest);
    expect(totalBalanceAfter - totalBalanceBefore).to.equal(lockerApproveAmount);
    expect(lenderInterestAfter - lenderInterestBefore).to.equal(lenderInterest);
  });

  it("returnLoan() can't be called twice", async () => {
    const borrowerInterestRate = (2000n * 30n) / 365n;
    const borrowerInterest = (ethers.parseEther("100") * borrowerInterestRate) / 10000n;

    const lenderInterestRate = (1000n * 30n) / 365n;
    const lenderInterest = (ethers.parseEther("100") * lenderInterestRate) / 10000n;

    const lockerApproveAmount = ethers.parseEther("100") + lenderInterest;

    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await collateralToken.connect(borrower).approve(loan, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(30));

    await fundToken.connect(borrower).approve(loan, ethers.parseEther("100") + borrowerInterest);


    await loan.connect(borrower).returnLoan();
    await expect(loan.connect(borrower).returnLoan()).to.be.revertedWith("already returned");
  })

  it("returnLoan() should work for native token", async () => {
    const adminFactory = await ethers.getContractFactory("Admin");
    admin = await adminFactory.deploy();
    await admin.waitForDeployment();

    const lockerFactory = await ethers.getContractFactory("Locker");
    locker = await lockerFactory.deploy();
    await locker.waitForDeployment();
    await locker.initialize(ethers.ZeroAddress, ethers.ZeroAddress);

    const currentTimestamp = await time.latest();
    const initValue = {
      admin,
      borrower,
      locker,

      loanLimit: ethers.parseEther("100"),
      depositStartDate: currentTimestamp + duration.days(3),
      loanDurationInDays: 30,
      borrowerAPY: 2000,

      collateralRatio: 3000,
      lenderInterestAPY: 1000,
      collateralDepositStartDate: currentTimestamp + duration.days(10),

      collateralAssetPriceRatio: 10000,
    };

    const loanFactory = await ethers.getContractFactory("Loan");
    loan = await loanFactory.deploy();
    await loan.waitForDeployment();
    loan.initialize(initValue);
    await locker.setLoanAddress(loan);

    const borrowerInterestRate = (2000n * 30n) / 365n;
    const borrowerInterest = (ethers.parseEther("10") * borrowerInterestRate) / 10000n;

    const lenderInterestRate = (1000n * 30n) / 365n;
    const lenderInterest = (ethers.parseEther("10") * lenderInterestRate) / 10000n;

    const lockerApproveAmount = ethers.parseEther("10") + lenderInterest;

    await time.increase(duration.days(3));
    await loan.connect(user).depositFunds(ethers.parseEther("10"), {value: ethers.parseEther("10")});

    await time.increase(duration.days(7));
    await loan.connect(borrower).depositCollateral({value: ethers.parseEther("3")});
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(30));

    const adminFeeBefore = await admin.collectedFees(ethers.ZeroAddress);
    const totalBalanceBefore = await locker.totalFundAmount();
    const lenderInterestBefore = await locker.totalInterest();

    await loan.connect(borrower).returnLoan({value: ethers.parseEther("10")+ borrowerInterest});

    const adminFeeAfter = await admin.collectedFees(ethers.ZeroAddress);
    const totalBalanceAfter = await locker.totalFundAmount();
    const lenderInterestAfter = await locker.totalInterest();

    expect(adminFeeAfter - adminFeeBefore).to.equal(borrowerInterest - lenderInterest);
    expect(totalBalanceAfter - totalBalanceBefore).to.equal(lockerApproveAmount);
    expect(lenderInterestAfter - lenderInterestBefore).to.equal(lenderInterest);
  })

  it("returnLoan() should be called by borrower", async () => {
    await expect(loan.connect(user).returnLoan()).to.be.revertedWith("only borrower can call");
  });

  it("returnLoan() shouldn't work before return date or after return date + 2 days", async () => {
    const interestRate = (2000n * 30n) / 365n;
    const interest = (ethers.parseEther("100") * interestRate) / 10000n;
    const returnAmount = ethers.parseEther("100") + interest;

    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await collateralToken.connect(borrower).approve(loan, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await fundToken.connect(borrower).approve(loan, returnAmount);
    await time.increase(duration.days(10));
    await expect(loan.connect(borrower).returnLoan()).to.be.revertedWith("currently unavailable");
    await time.increase(duration.days(40));
    await expect(loan.connect(borrower).returnLoan()).to.be.revertedWith("currently unavailable");
  });

  it("withdrawCollateral() should work properly", async () => {
    const borrowerInterestRate = (2000n * 30n) / 365n;
    const borrowerInterest = (ethers.parseEther("100") * borrowerInterestRate) / 10000n;

    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await collateralToken.connect(borrower).approve(loan, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(30));

    await fundToken.connect(borrower).approve(loan, ethers.parseEther("100") + borrowerInterest);

    await loan.connect(borrower).returnLoan();

    await time.increase(duration.days(2));

    const borrowerBalanceBefore = await collateralToken.balanceOf(borrower);

    await loan.connect(borrower).withdrawCollateral();

    const borrowerBalanceAfter = await collateralToken.balanceOf(borrower);
    const collateralAmountAfter = await locker.collateralAmount();

    expect(borrowerBalanceAfter - borrowerBalanceBefore).to.equal(ethers.parseEther("30"));
    expect(collateralAmountAfter).to.equal(BigInt(0));
  });

  it("withdrawCollateral() should be called only by borrower", async () => {
    await expect(loan.connect(user).withdrawCollateral()).to.be.revertedWith("only borrower can call");
  });

  it("withdrawCollateral() should work only after return due date", async () => {
    await expect(loan.connect(borrower).withdrawCollateral()).to.be.revertedWith("currently unavailable");
  });

  it("withdrawCollateral() should work after returning loan", async () => {
    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await collateralToken.connect(borrower).approve(loan, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(32));

    await expect(loan.connect(borrower).withdrawCollateral()).to.be.revertedWith("loan not returned yet");
  });

  it("claim() should work properly", async () => {
    const borrowerInterestRate = (2000n * 30n) / 365n;
    const borrowerInterest = (ethers.parseEther("100") * borrowerInterestRate) / 10000n;

    const lenderInterestRate = (1000n * 30n) / 365n;
    const lenderInterest = (ethers.parseEther("100") * lenderInterestRate) / 10000n;

    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await collateralToken.connect(borrower).approve(loan, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(30));

    await fundToken.connect(borrower).approve(loan, ethers.parseEther("100") + borrowerInterest);

    await loan.connect(borrower).returnLoan();

    await time.increase(duration.days(2));

    const userBalanceBefore = await fundToken.connect(user).balanceOf(user);
    await loan.connect(user).claim();
    const userBalanceAfter = await fundToken.connect(user).balanceOf(user);

    expect(userBalanceAfter - userBalanceBefore).to.equal(ethers.parseEther("100") + lenderInterest);
  });

  it("claim() should be called by lender", async () => {
    await expect(loan.connect(borrower).claim()).to.be.revertedWith("only lender can call");
  });

  it("claim() should be called after return due date", async () => {
    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));
    await expect(loan.connect(user).claim()).to.be.revertedWith("currently unavailable");
  });

  it("claim() can't be called before loan returned", async () => {
    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await collateralToken.connect(borrower).approve(loan, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(30));


    await time.increase(duration.days(2));

    await expect(loan.connect(user).claim()).to.be.revertedWith("loan default");
  });

  it("claimDefault() should work properly", async () => {

    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await collateralToken.connect(borrower).approve(loan, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(30));

    await time.increase(duration.days(2));

    const balanceBefore = await collateralToken.balanceOf(user);
    await loan.connect(user).claimDefault();
    const balanceAfter = await collateralToken.balanceOf(user);

    expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("30"));
  });

  it("claimDefault() can be called only by lender", async () => {
    await expect(loan.connect(user).claimDefault()).to.be.revertedWith("only lender can call");
  });

  it("claimDefault() can be called only after return due date", async () => {

    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await collateralToken.connect(borrower).approve(loan, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(30));

    await time.increase(duration.days(1));

    await expect(loan.connect(user).claimDefault()).to.be.revertedWith("currently unavailable");
  });

  it("claimDefault() can't be called if loan has been returned", async () => {
    const borrowerInterestRate = (2000n * 30n) / 365n;
    const borrowerInterest = (ethers.parseEther("100") * borrowerInterestRate) / 10000n;

    await time.increase(duration.days(3));
    await fundToken.connect(user).approve(loan, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await collateralToken.connect(borrower).approve(loan, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(30));
    await fundToken.connect(borrower).approve(loan, ethers.parseEther("100") + borrowerInterest);

    await loan.connect(borrower).returnLoan();

    await time.increase(duration.days(2));

    await expect(loan.connect(user).claimDefault()).to.be.revertedWith("loan returned");
  });
});

import { expect } from "chai";
import { ethers } from "hardhat";
import { Admin, Loan, Locker, MockToken } from "../typechain-types";
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
  let mockToken: MockToken;
  let owner: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  const decimals = 18;

  before(async () => {
    [owner, borrower, user] = await ethers.getSigners();
    const tokenFactory = await ethers.getContractFactory("MockToken");
    mockToken = await tokenFactory.deploy("Mock Token", "MT", decimals);
    await mockToken.waitForDeployment();

    const mintAmount = ethers.parseUnits("100000", decimals);
    await mockToken.mint(owner.address, mintAmount);
    await mockToken.mint(borrower.address, mintAmount);
    await mockToken.mint(user.address, mintAmount);
  });

  this.beforeEach(async () => {
    const adminFactory = await ethers.getContractFactory("Admin");
    admin = await adminFactory.deploy();
    await admin.waitForDeployment();
    const lockerFactory = await ethers.getContractFactory("Locker");
    locker = await lockerFactory.deploy(mockToken);
    await locker.waitForDeployment();

    const currentTimestamp = await time.latest();

    const initValue = {
      admin,
      borrower,
      locker,
      loanLimit: ethers.parseEther("1000"),
      depositStartDate: currentTimestamp + duration.days(3),
      loanDurationInDays: 30,
      collateralDepositStartDate: currentTimestamp + duration.days(10),
      borrowerAPY: 2000,
      lenderInterestAPY: 1000,
      collateralRatio: 3000,
    };
    const loanFactory = await ethers.getContractFactory("Loan");
    loan = await loanFactory.deploy(initValue)
    await loan.waitForDeployment();
  });

  it("depositFunds() should deposit funds into locker", async () => {
    await time.increase(duration.days(3));
    await locker.deposits(user).then((amount: BigInt) => {
      expect(amount).to.equal(BigInt(0));
    });

    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));
    await locker.deposits(user).then((amount: BigInt) => {
      expect(amount).to.equal(ethers.parseEther("100"));
    });
  });

  it("depositFunds() can't deposit over loanLimit", async () => {
    await time.increase(duration.days(3));

    await mockToken.connect(user).approve(locker, ethers.parseEther("1100"));
    await expect(
      loan.connect(user).depositFunds(ethers.parseEther("1100"))
    ).to.be.revertedWith("can't deposit more than loan limit");
  });

  it("depositFunds() shouldn't work before depositStartDate or after collateralDepositStartDate", async () => {
    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await expect(
      loan.connect(user).depositFunds(ethers.parseEther("100"))
    ).to.be.revertedWith("currently unavailable");
    await mockToken.connect(user).approve(locker, 0);
    await time.increase(duration.days(11));
    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await expect(
      loan.connect(user).depositFunds(ethers.parseEther("100"))
    ).to.be.revertedWith("currently unavailable");
  });

  it("depositCollateral() should deposit collateral into locker", async () => {
    await time.increase(duration.days(3));
    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));
    await time.increase(duration.days(7));
    await locker.collateralAmount().then((amount: BigInt) => {
        expect(amount).to.equal(BigInt(0));
    })
    await mockToken.connect(borrower).approve(locker, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await locker.collateralAmount().then((amount: BigInt) => {
        expect(amount).to.equal(ethers.parseEther("30"));
    })
  })

  it("depositCollateral() should be called by borrower", async () => {
    await time.increase(duration.days(10));
    await expect(loan.connect(user).depositCollateral()).to.be.revertedWith("only borrower can deposit collateral");
  })

  it("depositCollateral() shouldn't work before collateralDepositStartDate or 3 days after collateralDepositStartDate", async () => {
    await time.increase(duration.days(3));
    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));
    await mockToken.connect(borrower).approve(locker, ethers.parseEther("30"));
    await expect(loan.connect(borrower).depositCollateral()).to.be.revertedWith("currently unavailable");
    await time.increase(duration.days(10));
    await expect(loan.connect(borrower).depositCollateral()).to.be.revertedWith("currently unavailable");
  })

  it("takeLoan() should work properly", async () => {
    await time.increase(duration.days(3));
    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await mockToken.connect(borrower).approve(locker, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();

    const balanceBefore = await mockToken.balanceOf(borrower);
    await loan.connect(borrower).takeLoan();
    const balanceAfter = await mockToken.balanceOf(borrower);
    expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("100"));
    
  })

  it("takeLoan() should be called by borrower", async () => {
    await expect(loan.connect(user).takeLoan()).to.be.revertedWith("only borrower can take loan");
  })

  it("takeLoan() shouldn't work before collateralDepositStartDate or after loanDuration", async () => {
    await time.increase(duration.days(3));
    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(3));
    await expect(loan.connect(borrower).takeLoan()).to.be.revertedWith("currently unavailable");

    await time.increase(duration.days(4));
    await mockToken.connect(borrower).approve(locker, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    
    await time.increase(duration.days(60));
    await expect(loan.connect(borrower).takeLoan()).to.be.revertedWith("currently unavailable");
  })

  it("takeLoan() shouldn't work before collateral has been deposited", async () => {
    await time.increase(duration.days(3));
    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await expect(loan.connect(borrower).takeLoan()).to.be.revertedWith("collateral required to take loan");
  })
  
  it("returnLoan() should work properly", async () => {
    const interestRate = 2000n * 30n / 365n;
    const interest = ethers.parseEther("100") * interestRate / 10000n;
    const returnAmount = ethers.parseEther("100") + interest;

    await time.increase(duration.days(3));
    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await mockToken.connect(borrower).approve(locker, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(30));
    

    await mockToken.connect(borrower).approve(locker, returnAmount);

    const balanceBefore = await locker.totalDeposits();
    await loan.connect(borrower).returnLoan();
    const balanceAfter = await locker.totalDeposits();
    expect(balanceAfter - balanceBefore).to.be.equal(returnAmount);
  })
  
  it("returnLoan() should be called by borrower", async () => {
    await expect(loan.connect(user).returnLoan()).to.be.revertedWith("only borrower can return loan");
  })

  it("returnLoan() shouldn't work before return date or after return date + 2 days", async () => {
    const interestRate = 2000n * 30n / 365n;
    const interest = ethers.parseEther("100") * interestRate / 10000n;
    const returnAmount = ethers.parseEther("100") + interest;

    await time.increase(duration.days(3));
    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await mockToken.connect(borrower).approve(locker, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await mockToken.connect(borrower).approve(locker, returnAmount);
    await time.increase(duration.days(10));
    await expect(loan.connect(borrower).returnLoan()).to.be.revertedWith("currently unavailable");
    await time.increase(duration.days(40));
    await expect(loan.connect(borrower).returnLoan()).to.be.revertedWith("currently unavailable");
  })


});

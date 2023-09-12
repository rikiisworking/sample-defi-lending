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
      borrowerAPY: 2000,

      collateralRatio: 3000,
      lenderInterestAPY: 1000,
      collateralDepositStartDate: currentTimestamp + duration.days(10),
    };

    const loanFactory = await ethers.getContractFactory("Loan");
    loan = await loanFactory.deploy(initValue)
    await loan.waitForDeployment();
  });

  it("approveProposal() should update condition and approve loan", async () => {
    const currentTimestamp = await time.latest();
    const updateValue = [
      ethers.parseEther("1500"),
      currentTimestamp + duration.days(3),
      30,
      2000,
      3000,
      1000,
      currentTimestamp + duration.days(10)
    ]
    await loan.approveProposal(updateValue);
    await loan.info().then((result: LoanInfoStruct) => {
      expect(result.loanLimit).to.equal(ethers.parseEther("1500"));
    })
    await loan.approved().then((result:boolean)=> {
      expect(result).to.be.true;
    })
  })

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
    const borrowerInterestRate = 2000n * 30n / 365n;
    const borrowerInterest = ethers.parseEther("100") * borrowerInterestRate / 10000n;

    const lenderInterestRate = 1000n * 30n / 365n;
    const lenderInterest = ethers.parseEther("100") * lenderInterestRate / 10000n;

    const lockerApproveAmount = ethers.parseEther("100") + lenderInterest;
    const adminApproveAmount = borrowerInterest - lenderInterest;

    await time.increase(duration.days(3));
    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await mockToken.connect(borrower).approve(locker, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(30));
    

    await mockToken.connect(borrower).approve(locker, lockerApproveAmount);
    await mockToken.connect(borrower).approve(admin, adminApproveAmount);

    const adminFeeBefore = await admin.collectedFees(mockToken);
    const balanceBefore = await locker.totalDeposits();
    const lenderInterestBefore = await locker.totalInterest();
    
    await loan.connect(borrower).returnLoan();

    const adminFeeAfter = await admin.collectedFees(mockToken);
    const balanceAfter = await locker.totalDeposits();
    const lenderInterestAfter = await locker.totalInterest();

    
    expect(adminFeeAfter - adminFeeBefore).to.equal(borrowerInterest - lenderInterest);
    expect(balanceAfter  - balanceBefore ).to.equal(ethers.parseEther("100"));
    expect(lenderInterestAfter - lenderInterestBefore).to.equal(lenderInterest);

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

  it("withdrawCollateral() should work properly", async () => {
    const borrowerInterestRate = 2000n * 30n / 365n;
    const borrowerInterest = ethers.parseEther("100") * borrowerInterestRate / 10000n;

    const lenderInterestRate = 1000n * 30n / 365n;
    const lenderInterest = ethers.parseEther("100") * lenderInterestRate / 10000n;

    const lockerApproveAmount = ethers.parseEther("100") + lenderInterest;
    const adminApproveAmount = borrowerInterest - lenderInterest;

    await time.increase(duration.days(3));
    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await mockToken.connect(borrower).approve(locker, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(30));
    

    await mockToken.connect(borrower).approve(locker, lockerApproveAmount);
    await mockToken.connect(borrower).approve(admin, adminApproveAmount);

    await loan.connect(borrower).returnLoan();

    await time.increase(duration.days(2));

    const borrowerBalanceBefore = await mockToken.balanceOf(borrower);

    await loan.connect(borrower).withdrawCollateral();

    const borrowerBalanceAfter = await mockToken.balanceOf(borrower);
    const collateralAmountAfter = await locker.collateralAmount();

    expect(borrowerBalanceAfter - borrowerBalanceBefore).to.equal(ethers.parseEther("30"));
    expect(collateralAmountAfter).to.equal(BigInt(0));
  })  

  it("withdrawCollateral() should be called only by borrower", async () => {
    await expect(loan.connect(user).withdrawCollateral()).to.be.revertedWith("only borrower can withdraw collateral");
  })

  it("withdrawCollateral() should work only after return due date", async () => {
    await expect(loan.connect(borrower).withdrawCollateral()).to.be.revertedWith("currently unavailable");
  })

  it("withdrawCollateral() should work after returning loan", async () => {
    await time.increase(duration.days(3));
    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await mockToken.connect(borrower).approve(locker, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(32));

    await expect(loan.connect(borrower).withdrawCollateral()).to.be.revertedWith("loan not returned yet")
  })


  it("claim() should work properly", async () => {
    const borrowerInterestRate = 2000n * 30n / 365n;
    const borrowerInterest = ethers.parseEther("100") * borrowerInterestRate / 10000n;

    const lenderInterestRate = 1000n * 30n / 365n;
    const lenderInterest = ethers.parseEther("100") * lenderInterestRate / 10000n;

    const lockerApproveAmount = ethers.parseEther("100") + lenderInterest;
    const adminApproveAmount = borrowerInterest - lenderInterest;

    await time.increase(duration.days(3));
    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await mockToken.connect(borrower).approve(locker, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(30));
    

    await mockToken.connect(borrower).approve(locker, lockerApproveAmount);
    await mockToken.connect(borrower).approve(admin, adminApproveAmount);
    
    await loan.connect(borrower).returnLoan();

    await time.increase(duration.days(2));

    const userBalanceBefore = await mockToken.connect(user).balanceOf(user);
    await loan.connect(user).claim();
    const userBalanceAfter = await mockToken.connect(user).balanceOf(user);

    expect(userBalanceAfter - userBalanceBefore).to.equal(ethers.parseEther("100") + lenderInterest);
  })

  it("claim() should be called by lender", async () => {
    await expect(loan.connect(borrower).claim()).to.be.revertedWith("only lender can claim");
  })

  it("claim() should be called after return due date", async () => {
    await time.increase(duration.days(3));
    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));
    await expect(loan.connect(user).claim()).to.be.revertedWith("currently unavailable");
  })

  it("claim() can't be called before loan returned", async () => {
    const borrowerInterestRate = 2000n * 30n / 365n;
    const borrowerInterest = ethers.parseEther("100") * borrowerInterestRate / 10000n;

    const lenderInterestRate = 1000n * 30n / 365n;
    const lenderInterest = ethers.parseEther("100") * lenderInterestRate / 10000n;

    const lockerApproveAmount = ethers.parseEther("100") + lenderInterest;
    const adminApproveAmount = borrowerInterest - lenderInterest;

    await time.increase(duration.days(3));
    await mockToken.connect(user).approve(locker, ethers.parseEther("100"));
    await loan.connect(user).depositFunds(ethers.parseEther("100"));

    await time.increase(duration.days(7));
    await mockToken.connect(borrower).approve(locker, ethers.parseEther("30"));
    await loan.connect(borrower).depositCollateral();
    await loan.connect(borrower).takeLoan();

    await time.increase(duration.days(30));
    

    await mockToken.connect(borrower).approve(locker, lockerApproveAmount);
    await mockToken.connect(borrower).approve(admin, adminApproveAmount);
    
    await time.increase(duration.days(2));

    await expect(loan.connect(user).claim()).to.be.revertedWith("loan not returned yet");
  })
});

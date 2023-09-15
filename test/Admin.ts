import { expect } from "chai";
import { ethers } from "hardhat";
import { Admin, LoanFactory, LockerFactory, MockToken, Loan, Locker } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Admin", function () {
  let admin: Admin;
  let fundToken: MockToken;

  let loanFactory: LoanFactory;
  let lockerFactory: LockerFactory;

  let loan: Loan;
  let locker: Locker;

  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  const decimals = 18;

  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    const tokenFactory = await ethers.getContractFactory("MockToken");
    fundToken = await tokenFactory.deploy("Fund Token", "MT", decimals);
    await fundToken.waitForDeployment();
    const mintAmount = ethers.parseUnits("100000", decimals);
    await fundToken.mint(owner.address, mintAmount);

    const loanFactory_ = await ethers.getContractFactory("Loan");
    const lockerFactory_ = await ethers.getContractFactory("Locker");

    loan = await loanFactory_.deploy();
    locker = await lockerFactory_.deploy();

    await loan.waitForDeployment();
    await locker.waitForDeployment();
  });

  beforeEach(async () => {
    const adminFactory = await ethers.getContractFactory("Admin");
    admin = await adminFactory.deploy();
    await admin.waitForDeployment();

    const _loanFactory = await ethers.getContractFactory("LoanFactory");
    loanFactory = await _loanFactory.deploy(admin, loan);
    await loanFactory.waitForDeployment();

    const _lockerFactory = await ethers.getContractFactory("LockerFactory");
    lockerFactory = await _lockerFactory.deploy(admin, locker);
    await lockerFactory.waitForDeployment();
  });

  it("updateLoanImplementation() should update loan implementation address", async () => {
    await admin.setFactories(lockerFactory, loanFactory);
    const addrBefore = await loanFactory.loanImplementationAddress();
    const loanFactory_ = await ethers.getContractFactory("Loan");
    loan = await loanFactory_.deploy();
    await loan.waitForDeployment();
    await admin.updateLoanImplementation(loan);
    const addrAfter = await loanFactory.loanImplementationAddress();
    expect(addrBefore).not.to.be.equal(addrAfter);
  })

  it("updateLoanImplementation() should be called only by owner", async () => {
    await expect(admin.connect(user1).updateLoanImplementation(ethers.ZeroAddress)).to.be.revertedWith("unauthorized");
  })

  it("updateLockerImplementation() should update locker implementation address", async () => {
    await admin.setFactories(lockerFactory, loanFactory);
    const addrBefore = await lockerFactory.lockerImplementationAddress();
    const lockerFactory_ = await ethers.getContractFactory("Locker");
    locker = await lockerFactory_.deploy();
    await locker.waitForDeployment();
    await admin.updateLockerImplementation(locker);
    const addrAfter = await lockerFactory.lockerImplementationAddress();
    expect(addrBefore).not.to.be.equal(addrAfter);
  })

  it("updateLockerImplementation() should be called only by owner", async () => {
    await expect(admin.connect(user1).updateLockerImplementation(ethers.ZeroAddress)).to.be.revertedWith("unauthorized");
  })

  it("addBorrower() can be called only by owner", async () => {
    await expect(admin.connect(user1).addBorrower(user2.address)).to.be.revertedWith("unauthorized");
  });

  it("addBorrower() should add user", async () => {
    await admin.borrowers(user1.address).then((isWhitelisted: boolean) => expect(isWhitelisted).to.be.false);
    await admin.addBorrower(user1.address);
    await admin.borrowers(user1.address).then((isWhitelisted: boolean) => expect(isWhitelisted).to.be.true);
  });

  it("removeBorrower() can be called only by owner", async () => {
    await admin.addBorrower(user2.address);
    await expect(admin.connect(user1).removeBorrower(user2.address)).to.be.revertedWith("unauthorized");
  });

  it("removeBorrower() should remove user", async () => {
    await admin.addBorrower(user1.address);
    await admin.borrowers(user1.address).then((isWhitelisted: boolean) => expect(isWhitelisted).to.be.true);
    await admin.removeBorrower(user1.address);
    await admin.borrowers(user1.address).then((isWhitelisted: boolean) => expect(isWhitelisted).to.be.false);
  });

  it("setOwner() can be called only by owner", async () => {
    await expect(admin.connect(user1).setOwner(user1.address)).to.be.revertedWith("unauthorized");
  });

  it("setOwner() should revert on addressZero param", async () => {
    await expect(admin.setOwner(ethers.ZeroAddress)).to.be.revertedWith("invalid address");
  })

  it("setOwner() should change owner", async () => {
    await admin.owner().then((ownerAddress: string) => {
      expect(ownerAddress).to.equal(owner.address);
    });
    await admin.setOwner(user1.address);
    await admin.owner().then((ownerAddress: string) => {
      expect(ownerAddress).to.equal(user1.address);
    });
  });

  it("setFactories() should set loanFactory and lockerFactory for proposal generation", async () => {
    await admin.lockerFactory().then((address: string) => {
      expect(address).to.equal(ethers.ZeroAddress);
    });
    await admin.loanFactory().then((address: string) => {
      expect(address).to.equal(ethers.ZeroAddress);
    });
    await admin.setFactories(lockerFactory, loanFactory);
    await admin.lockerFactory().then(async (address: string) => {
      expect(address).to.equal(await lockerFactory.getAddress());
    });
    await admin.loanFactory().then(async (address: string) => {
      expect(address).to.equal(await loanFactory.getAddress());
    });
  });

  it("setFactories() should be called only by owner", async () => {
    await expect(admin.connect(user1).setFactories(lockerFactory, loanFactory)).to.be.revertedWith("unauthorized");
  })

  it("createProposal() should generate locker and loan", async () => {
    await lockerFactory.lockerSize().then((size: BigInt) => {
      expect(size).to.equal(BigInt(0));
    });
    await loanFactory.loanSize().then((size: BigInt) => {
      expect(size).to.equal(BigInt(0));
    });
    await admin.setFactories(lockerFactory, loanFactory);
    await admin.createProposal([1000, (await time.latest()) + 1000, 30, 1000], ethers.ZeroAddress, ethers.ZeroAddress);
    await lockerFactory.lockerSize().then((size: BigInt) => {
      expect(size).to.equal(BigInt(1));
    });
    await loanFactory.loanSize().then((size: BigInt) => {
      expect(size).to.equal(BigInt(1));
    });
  });

  it("collectFee() should send token to admin contract", async () => {
    await admin.collectedFees(fundToken).then((amount: BigInt) => {
      expect(amount).to.equal(BigInt(0));
    });
    await fundToken.approve(admin, ethers.parseEther("100"));
    await admin.collectFee(owner, fundToken, ethers.parseEther("100"));
    await admin.collectedFees(fundToken).then((amount: BigInt) => {
      expect(amount).to.equal(ethers.parseEther("100"));
    });
  });

  it("collectFee() should send native token to admin contract", async () => {
    await admin.collectedFees(ethers.ZeroAddress).then((amount: BigInt) => {
      expect(amount).to.equal(BigInt(0));
    });
    await admin.collectFee(owner, ethers.ZeroAddress, ethers.parseEther("1"), { value: ethers.parseEther("1") });
    await admin.collectedFees(ethers.ZeroAddress).then((amount: BigInt) => {
      expect(amount).to.equal(ethers.parseEther("1"));
    });
  });

  it("withdrawFee() should increase owner erc20 token balance", async () => {
    await fundToken.approve(admin, ethers.parseEther("100"));
    await admin.collectFee(owner, fundToken, ethers.parseEther("100"));
    const balanceBefore = await fundToken.balanceOf(owner);
    await admin.withdrawFee(fundToken);
    const balanceAfter = await fundToken.balanceOf(owner);
    await expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("100"));
  });

  it("withdrawFee() should increase owner native token balance", async () => {
    await admin.collectFee(owner, ethers.ZeroAddress, ethers.parseEther("1"), { value: ethers.parseEther("1") });
    const balanceBefore = await ethers.provider.getBalance(owner);
    await admin.withdrawFee(ethers.ZeroAddress);
    const balanceAfter = await ethers.provider.getBalance(owner);
    expect(balanceBefore).to.be.lt(balanceAfter);
  });

  it("withdrawFee() can be called only by owner", async () => {
    await expect(admin.connect(user1).withdrawFee(ethers.ZeroAddress)).to.be.revertedWith("unauthorized");
  });

  it("withdrawFee() shouldn't work if no fees are left", async () => {
    await expect(admin.withdrawFee(ethers.ZeroAddress)).to.be.revertedWith("no fee to withdraw");
  });
});

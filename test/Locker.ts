import { expect } from "chai";
import { ethers } from "hardhat";

import { Locker, MockToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Locker", function () {
    let locker: Locker;
    let tokenLocker: Locker;
    let fundToken: MockToken;
    let collateralToken: MockToken;
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    const decimals = 18;
    

    before(async () => {
        [owner, user1, user2] = await ethers.getSigners();
        const tokenFactory = await ethers.getContractFactory("MockToken");
        fundToken = await tokenFactory.deploy("Fund Token", "MT", decimals);
        collateralToken = await tokenFactory.deploy("Collateral Token", "CT", decimals);
        await fundToken.waitForDeployment();

        const mintAmount = ethers.parseUnits("100000", decimals);
        await fundToken.mint(owner.address, mintAmount);
        await fundToken.mint(user1.address, mintAmount);
        await fundToken.mint(user2.address, mintAmount);
        await collateralToken.mint(owner.address, mintAmount);
    });

    beforeEach(async () => {
        const lockerFactory = await ethers.getContractFactory("Locker");
        locker = await lockerFactory.deploy(ethers.ZeroAddress, ethers.ZeroAddress);
        tokenLocker = await lockerFactory.deploy(fundToken, collateralToken);
        await locker.waitForDeployment();
        await tokenLocker.waitForDeployment();
    })

    it("depositFunds() should work for native token", async () => {
        await locker.deposits(user1.address).then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        });

        await locker.connect(user1).depositFunds(user1.address, ethers.parseEther("1"), {value: ethers.parseEther("1")})

        await locker.deposits(user1.address).then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("1"))
        });
        await locker.totalFundAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("1"))
        });
    })

    it("depositFunds() should work for erc20 token", async () => {
        await tokenLocker.deposits(user1.address).then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        });
        await fundToken.connect(user1).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(user1).depositFunds(user1.address, ethers.parseEther("1"))

        await tokenLocker.deposits(user1.address).then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("1"))
        });
        await tokenLocker.totalFundAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("1"))
        });
    })

    it("depositCollateral() should work for native token", async () => {
        await locker.collateralAmount().then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0));
        })
        await locker.connect(owner).depositCollateral(owner, ethers.parseEther("1"), {value: ethers.parseEther("1")});
        await locker.collateralAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("1"));
        })
    })

    it("depositCollateral() should work for erc20 token", async () => {
        await tokenLocker.collateralAmount().then((amount:BigInt) => {
            expect(amount).to.equal(BigInt(0));
        })
        await collateralToken.connect(owner).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(owner).depositCollateral(owner, ethers.parseEther("1"));
        await tokenLocker.collateralAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("1"));
        })
    })

    it("withdrawCollateral() should work for native token", async() => {
        await locker.connect(owner).depositCollateral(owner, ethers.parseEther("1"), {value: ethers.parseEther("1")});

        await locker.collateralAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("1"));
        })
        const balanceBefore = await ethers.provider.getBalance(owner);

        await locker.connect(owner).withdrawCollateral(owner);
        await locker.collateralAmount().then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0));
        })
        const balanceAfter = await ethers.provider.getBalance(owner);
        expect(balanceBefore).to.be.lt(balanceAfter);
  
    })

    it("withdrawCollateral() should work for erc20 token", async () => {
        await collateralToken.connect(owner).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(owner).depositCollateral(owner, ethers.parseEther("1"));

        await tokenLocker.collateralAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("1"));
        })
        const balanceBefore = await collateralToken.balanceOf(owner);
        
        await tokenLocker.connect(owner).withdrawCollateral(owner);

        await tokenLocker.collateralAmount().then((amount:BigInt) => {
            expect(amount).to.equal(BigInt(0));
        })
        const balanceAfter = await collateralToken.balanceOf(owner);
        expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("1"));
    })

    it("claim() should return deposit and interest back to lender", async () => {
        await fundToken.connect(user1).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(user1).depositFunds(user1.address, ethers.parseEther("1"));
        await fundToken.connect(user2).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(user2).depositFunds(user2.address, ethers.parseEther("1"));
        await tokenLocker.connect(owner).lendAsset(owner);

        await fundToken.connect(owner).approve(tokenLocker, ethers.parseEther("3"));
        await tokenLocker.connect(owner).returnAsset(owner, ethers.parseEther("2"), ethers.parseEther("1"));

        const beforeBalance = await fundToken.balanceOf(user1);
        await tokenLocker.connect(user1).claim(user1);
        const afterBalance = await fundToken.balanceOf(user1);

        expect(afterBalance - beforeBalance).to.equal(ethers.parseEther("1.5"));
    })

    it("claimDefault() should return collateral to lender", async () => {
        await fundToken.connect(user1).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(user1).depositFunds(user1.address, ethers.parseEther("1"));
        await fundToken.connect(user2).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(user2).depositFunds(user2.address, ethers.parseEther("1"));
        await collateralToken.connect(owner).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(owner).depositCollateral(owner, ethers.parseEther("1"));
        await tokenLocker.connect(owner).lendAsset(owner);

        const balanceBefore = await collateralToken.balanceOf(user1);
        await tokenLocker.connect(user1).claimDefault(user1);
        const balanceAfter = await collateralToken.balanceOf(user1);

        expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("0.5"));
    })

    it("lendAsset() should work for native token", async () => {
        const beforeBalance = await ethers.provider.getBalance(owner);
        await locker.connect(user1).depositFunds(user1.address, ethers.parseEther("1"), {value: ethers.parseEther("1")});
        await locker.connect(user2).depositFunds(user2.address, ethers.parseEther("1"), {value: ethers.parseEther("1")});
        await locker.connect(owner).lendAsset(owner);
        const afterBalance = await ethers.provider.getBalance(owner);
        
        await locker.totalFundAmount().then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        });
        await locker.lendAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("2"))
        });
        expect(beforeBalance).to.be.lt(afterBalance);

    })

    it("lendAsset() should work for erc20 token", async () => {
        const beforeBalance = await fundToken.balanceOf(owner);
        await fundToken.connect(user1).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(user1).depositFunds(user1.address, ethers.parseEther("1"));
        await fundToken.connect(user2).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(user2).depositFunds(user2.address, ethers.parseEther("1"));

        await tokenLocker.connect(owner).lendAsset(owner);
        const afterBalance = await fundToken.balanceOf(owner);

        await tokenLocker.totalFundAmount().then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        });
        await tokenLocker.lendAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("2"))
        });
        expect(afterBalance - beforeBalance).to.equal(ethers.parseEther("2"));
    })

    it("returnAsset() should work for native token", async () => {
        await locker.connect(user1).depositFunds(user1.address, ethers.parseEther("1"), {value: ethers.parseEther("1")});
        await locker.connect(user2).depositFunds(user2.address, ethers.parseEther("1"), {value: ethers.parseEther("1")});
        await locker.connect(owner).lendAsset(owner);
        await locker.totalFundAmount().then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        });
        await locker.lendAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("2"))
        });
        await locker.connect(owner).returnAsset(owner, ethers.parseEther("2"), ethers.parseEther("1"), {value: ethers.parseEther("3")});
        await locker.totalFundAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("3"))
        });
    })

    it("returnAsset() should work for erc20 token", async () => {
        await fundToken.connect(user1).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(user1).depositFunds(user1.address, ethers.parseEther("1"));
        await fundToken.connect(user2).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(user2).depositFunds(user2.address, ethers.parseEther("1"));
        await tokenLocker.connect(owner).lendAsset(owner);
        await tokenLocker.totalFundAmount().then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        });
        await tokenLocker.lendAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("2"))
        });

        await fundToken.connect(owner).approve(tokenLocker, ethers.parseEther("3"));
        await tokenLocker.connect(owner).returnAsset(owner, ethers.parseEther("2"), ethers.parseEther("1"));
        await tokenLocker.totalFundAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("3"))
        });
    })

    
})
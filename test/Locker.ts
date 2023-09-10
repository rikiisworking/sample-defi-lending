import { expect } from "chai";
import { ethers } from "hardhat";

import { Locker, MockToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Locker", function () {
    let locker: Locker;
    let tokenLocker: Locker;
    let mockToken: MockToken;
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    const decimals = 18;
    

    before(async () => {
        [owner, user1, user2] = await ethers.getSigners();
        const tokenFactory = await ethers.getContractFactory("MockToken");
        mockToken = await tokenFactory.deploy("Mock Token", "MT", decimals);

        const mintAmount = ethers.parseUnits("100000", decimals);
        await mockToken.mint(owner.address, mintAmount);
        await mockToken.mint(user1.address, mintAmount);
        await mockToken.mint(user2.address, mintAmount);
    });

    beforeEach(async () => {
        const lockerFactory = await ethers.getContractFactory("Locker");
        locker = await lockerFactory.deploy(ethers.ZeroAddress);
        tokenLocker = await lockerFactory.deploy(mockToken)

    })

    it("deposit() should work for native token", async () => {
        await locker.deposits(user1.address).then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        });

        await locker.connect(user1).deposit(user1.address, ethers.parseEther("1"), {value: ethers.parseEther("1")})

        await locker.deposits(user1.address).then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("1"))
        });
        await locker.totalDeposits().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("1"))
        });
    })

    it("deposit() should work for erc20 token", async () => {
        await tokenLocker.deposits(user1.address).then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        });
        await mockToken.connect(user1).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(user1).deposit(user1.address, ethers.parseEther("1"))

        await tokenLocker.deposits(user1.address).then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("1"))
        });
        await tokenLocker.totalDeposits().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("1"))
        });
    })

    it("withdraw() should work for native token", async () => {
        await locker.connect(user1).deposit(user1.address, ethers.parseEther("1"), {value: ethers.parseEther("1")})
        await locker.deposits(user1.address).then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("1"))
        }); 
        await locker.connect(user1).withdraw(user1.address, ethers.parseEther("1"));
        await locker.deposits(user1.address).then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        }); 
    })

    it("withdraw() should work for erc20 token", async () => {
        await mockToken.connect(user1).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(user1).deposit(user1.address, ethers.parseEther("1"));

        await tokenLocker.deposits(user1.address).then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("1"))
        });

        await tokenLocker.connect(user1).withdraw(user1.address, ethers.parseEther("1"));
        await tokenLocker.deposits(user1.address).then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        });
    })

    it("lendAsset() should work for native token", async () => {
        const beforeBalance = await ethers.provider.getBalance(owner);
        await locker.connect(user1).deposit(user1.address, ethers.parseEther("1"), {value: ethers.parseEther("1")});
        await locker.connect(user2).deposit(user2.address, ethers.parseEther("1"), {value: ethers.parseEther("1")});
        await locker.connect(owner).lendAsset(owner);
        const afterBalance = await ethers.provider.getBalance(owner);
        
        await locker.totalDeposits().then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        });
        await locker.lendAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("2"))
        });
        expect(beforeBalance).to.be.lt(afterBalance);

    })

    it("lendAsset() should work for erc20 token", async () => {
        const beforeBalance = await mockToken.balanceOf(owner);
        await mockToken.connect(user1).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(user1).deposit(user1.address, ethers.parseEther("1"));
        await mockToken.connect(user2).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(user2).deposit(user2.address, ethers.parseEther("1"));

        await tokenLocker.connect(owner).lendAsset(owner);
        const afterBalance = await mockToken.balanceOf(owner);

        await tokenLocker.totalDeposits().then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        });
        await tokenLocker.lendAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("2"))
        });
        expect(afterBalance - beforeBalance).to.equal(ethers.parseEther("2"));
    })

    it("returnAsset() should work for native token", async () => {
        await locker.connect(user1).deposit(user1.address, ethers.parseEther("1"), {value: ethers.parseEther("1")});
        await locker.connect(user2).deposit(user2.address, ethers.parseEther("1"), {value: ethers.parseEther("1")});
        await locker.connect(owner).lendAsset(owner);
        await locker.totalDeposits().then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        });
        await locker.lendAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("2"))
        });
        await locker.connect(owner).returnAsset(owner, ethers.parseEther("2"), {value: ethers.parseEther("2")});
        await locker.totalDeposits().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("2"))
        });
        await locker.lendAmount().then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        });
    })

    it("returnAsset() should work for erc20 token", async () => {
        await mockToken.connect(user1).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(user1).deposit(user1.address, ethers.parseEther("1"));
        await mockToken.connect(user2).approve(tokenLocker, ethers.parseEther("1"));
        await tokenLocker.connect(user2).deposit(user2.address, ethers.parseEther("1"));
        await tokenLocker.connect(owner).lendAsset(owner);
        await tokenLocker.totalDeposits().then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        });
        await tokenLocker.lendAmount().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("2"))
        });

        await mockToken.connect(owner).approve(tokenLocker, ethers.parseEther("2"));
        await tokenLocker.connect(owner).returnAsset(owner, ethers.parseEther("2"));
        await tokenLocker.totalDeposits().then((amount: BigInt) => {
            expect(amount).to.equal(ethers.parseEther("2"))
        });
        await tokenLocker.lendAmount().then((amount: BigInt) => {
            expect(amount).to.equal(BigInt(0))
        });
    })
})
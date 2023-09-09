import { expect } from "chai";
import { ethers } from "hardhat";
import { Admin } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Admin", function () {
    let admin: Admin;
    let owner: HardhatEthersSigner;
    let user1: HardhatEthersSigner;
    let user2: HardhatEthersSigner;

    before(async () => {
        [owner, user1, user2] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const adminFactory = await ethers.getContractFactory("Admin");
        admin = await adminFactory.deploy();

    })

    it("addBorrower() can be called only by owner", async () => {
        await expect(admin.connect(user1).addBorrower(user2.address)).to.be.revertedWith("unauthorized");
    })

    it("addBorrower() should add user", async () => {
        await admin.borrowers(user1.address).then((isWhitelisted: boolean) => expect(isWhitelisted).to.be.false);
        await admin.addBorrower(user1.address);
        await admin.borrowers(user1.address).then((isWhitelisted: boolean) => expect(isWhitelisted).to.be.true);
    })

    it("removeBorrower() can be called only by owner", async () => {
        await admin.addBorrower(user2.address);
        await expect(admin.connect(user1).removeBorrower(user2.address)).to.be.revertedWith("unauthorized");
    })

    it("removeBorrower() should remove user", async () => {
        await admin.addBorrower(user1.address);
        await admin.borrowers(user1.address).then((isWhitelisted: boolean) => expect(isWhitelisted).to.be.true);
        await admin.removeBorrower(user1.address);
        await admin.borrowers(user1.address).then((isWhitelisted: boolean) => expect(isWhitelisted).to.be.false);
    })

    it("setOwner() can be called only by owner", async () => {
        await expect(admin.connect(user1).setOwner(user1.address)).to.be.revertedWith("unauthorized");
    })

    it("setOwner() should change owner", async () => {
        await admin.owner().then((ownerAddress: string) => {
            expect(ownerAddress).to.equal(owner.address);
        })
        await admin.setOwner(user1.address);
        await admin.owner().then((ownerAddress: string) => {
            expect(ownerAddress).to.equal(user1.address);
        })
    })
})
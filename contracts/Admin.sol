// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import { ILocker } from "./interfaces/ILocker.sol";
import { ILockerFactory } from "./interfaces/ILockerFactory.sol";
import { ILoanFactory, LoanInfo } from "./interfaces/ILoanFactory.sol";

contract Admin {
    address public owner;
    ILockerFactory public lockerFactory;
    ILoanFactory public loanFactory;
    mapping(address borrower => bool isWhitelisted) public borrowers;


    modifier onlyOwner() {
        require(msg.sender == owner, "unauthorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setFactories(
        address _lockerFactory,
        address _loanFactory
    ) external onlyOwner {
        lockerFactory = ILockerFactory(_lockerFactory);
        loanFactory = ILoanFactory(_loanFactory);
    }

    function addBorrower(address _address) external onlyOwner {
        borrowers[_address] = true;
    }

    function removeBorrower(address _address) external onlyOwner {
        borrowers[_address] = false;
    }

    function setOwner(address _address) external onlyOwner {
        require(_address != address(0), "invalid address");
        owner = _address;
    }

    function createProposal(uint256[7] memory conditions, address _asset) external {
        address lockerAddress = lockerFactory.createLocker(_asset);
        LoanInfo memory loanInfo = LoanInfo(
            address(this),
            msg.sender,
            ILocker(lockerAddress),
            conditions[0],
            conditions[1],
            conditions[2],
            conditions[3],
            conditions[4],
            conditions[5],
            conditions[6]
        );
        address loanAddress = loanFactory.createLoan(loanInfo);
    }
}
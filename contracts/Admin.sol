// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import { ILockerFactory } from "./interfaces/ILockerFactory.sol";
import { ILoanFactory, LoanInfo } from "./interfaces/ILoanFactory.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Admin {
    using SafeERC20 for IERC20;

    address public owner;
    ILockerFactory public lockerFactory;
    ILoanFactory public loanFactory;
    mapping(address borrower => bool isWhitelisted) public borrowers;
    mapping(address asset => uint256 amount) public collectedFees;

    modifier onlyOwner() {
        require(msg.sender == owner, "unauthorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {}

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
            lockerAddress,
            conditions[0],
            conditions[1],
            conditions[2],
            conditions[3],
            conditions[4],
            conditions[5],
            conditions[6]
        );
        loanFactory.createLoan(loanInfo);
    }

    function collectFee(address _from, address asset, uint256 amount) external payable{
        if(address(asset) != address(0)){
            require(msg.value == 0, "native token not supported");
            IERC20(asset).safeTransferFrom(_from, address(this), amount);
        }else {
            require(msg.value == amount, "invalid amount recieved");
        }
        collectedFees[asset] += amount;
    }
}
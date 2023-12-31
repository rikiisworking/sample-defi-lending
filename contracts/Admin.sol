// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {ILockerFactory} from "./interfaces/ILockerFactory.sol";
import {ILoanFactory, LoanInfo} from "./interfaces/ILoanFactory.sol";
import {ILocker} from "./interfaces/ILocker.sol";
import {IERC20Detail} from "./interfaces/IERC20Detail.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {TransferLib} from "./libraries/TransferLib.sol";

contract Admin {
    using SafeERC20 for IERC20Detail;

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

    function setFactories(address _lockerFactory, address _loanFactory) external onlyOwner {
        lockerFactory = ILockerFactory(_lockerFactory);
        loanFactory = ILoanFactory(_loanFactory);
    }

    function updateLoanImplementation(address _address) external onlyOwner {
        loanFactory.setLoanImpl(_address);
    }

    function updateLockerImplementation(address _address) external onlyOwner {
        lockerFactory.setLockerImpl(_address);
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

    /**
    @dev creates unapproved loan with borrower's offered conditions
    @param conditions  -[0] loanLimit
                        -[1] depositStartDate
                        -[2] loanDurationInDays
                        -[3] borrowerAPY
    @param _fundAsset token address used for loan
    @param _collateralAsset token address used for collateral
    */
    function createProposal(uint256[4] memory conditions, address _fundAsset, address _collateralAsset) external {
        require(borrowers[msg.sender], "only borrower can create proposal");
        address lockerAddress = lockerFactory.createLocker(_fundAsset, _collateralAsset);
        LoanInfo memory loanInfo = LoanInfo(
            address(this),
            msg.sender,
            lockerAddress,
            conditions[0],
            conditions[1],
            conditions[2],
            conditions[3],
            0,
            0,
            0,
            10000
        );
        address loanAddress = loanFactory.createLoan(loanInfo);
        ILocker(lockerAddress).setLoanAddress(loanAddress);
    }

    function collectFee(address _from, address asset, uint256 amount) external payable {
        TransferLib._receive(asset, _from, amount);
        collectedFees[asset] += amount;
    }

    function withdrawFee(address asset) external {
        uint256 amount = collectedFees[asset];
        require(msg.sender == owner, "unauthorized");
        require(amount > 0, "no fee to withdraw");
        collectedFees[asset] = 0;
        TransferLib._send(asset, owner, amount);
    }
}

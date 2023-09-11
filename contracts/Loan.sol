// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import { ILocker } from "./interfaces/ILocker.sol";

struct LoanInfo {
        address admin;
        address borrower;
        address locker;
        uint256 loanLimit;
        uint256 depositStartDate;
        uint256 loanDurationInDays;
        uint256 collateralDepositStartDate;
        uint256 borrowerAPY;
        uint256 lenderInterestAPY;
        uint256 collateralRatio;

    }


contract Loan {
    LoanInfo public info;

    constructor(LoanInfo memory _info){
        validateInitialLoanInfo(_info);
        info = _info;
    }

    function depositFunds(uint256 amount) external payable {
        require(ILocker(info.locker).totalDeposits() + amount <= info.loanLimit, "can't deposit more than loan limit");
        require(block.timestamp >= info.depositStartDate && block.timestamp < info.collateralDepositStartDate, "currently unavailable");

        ILocker(info.locker).deposit{ value: msg.value }(msg.sender, amount);
    }

    function depositCollateral() external payable {
        require(msg.sender == info.borrower, "only borrower can deposit collateral");
        require(block.timestamp >= info.collateralDepositStartDate && block.timestamp < info.collateralDepositStartDate + 48 hours, "currently unavailable");
        
        uint256 requiredCollateral = (ILocker(info.locker).totalDeposits() * info.collateralRatio) / 10000;
        ILocker(info.locker).depositCollateral{value: msg.value}(msg.sender, requiredCollateral);
    }

    function takeLoan() external {
        require(msg.sender == info.borrower, "only borrower can take loan");
        require(block.timestamp >= info.collateralDepositStartDate && block.timestamp < info.collateralDepositStartDate + info.loanDurationInDays * 86400, "currently unavailable"); 
        uint256 requiredCollateral = (ILocker(info.locker).totalDeposits() * info.collateralRatio) / 10000;
        require(ILocker(info.locker).collateralAmount() == requiredCollateral, "collateral required to take loan");
        ILocker(info.locker).lendAsset(info.borrower);
    }

    function returnLoan() external {
        require(msg.sender == info.borrower, "only borrower can return loan");
        require(block.timestamp >= info.collateralDepositStartDate + (info.loanDurationInDays) * 86400 && 
            block.timestamp < info.collateralDepositStartDate + (info.loanDurationInDays + 2) * 86400,"currently unavailable");
        uint256 lendAmount = ILocker(info.locker).lendAmount();
        uint256 borrowerInterest = calculateInterest( lendAmount, info.borrowerAPY, info.loanDurationInDays);
        ILocker(info.locker).returnAsset(info.borrower, borrowerInterest + lendAmount);
    }

    function validateInitialLoanInfo(LoanInfo memory _info) internal view {
        require(_info.borrower != address(0), "invalid borrower address");
        require(_info.locker != address(0), "invalid locker address");
        require(_info.loanLimit > 0, "invalid loanLimit");
        require(_info.depositStartDate > block.timestamp);
        require(_info.loanDurationInDays > 0);
        require(_info.collateralDepositStartDate > block.timestamp);
        require(_info.borrowerAPY > 0);
        require(_info.lenderInterestAPY > 0);
    }

    function calculateInterest(
        uint256 principal,
        uint256 interestRate,
        uint256 durationInDays
    ) internal pure returns (uint256) {
        uint256 actualInterestRate = (interestRate * durationInDays) / 365;

        return (principal * actualInterestRate) / 10000;
    }
}
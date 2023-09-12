// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import { ILocker } from "./interfaces/ILocker.sol";
import { IAdmin } from "./interfaces/IAdmin.sol";

struct LoanInfo {
        address admin;
        address borrower;
        address locker;

        uint256 loanLimit;
        uint256 depositStartDate;
        uint256 loanDurationInDays;
        uint256 borrowerAPY;
        
        uint256 collateralRatio;
        uint256 lenderInterestAPY;
        uint256 collateralDepositStartDate;
    }


contract Loan {
    LoanInfo public info;
    bool public approved;

    constructor(LoanInfo memory _info){
        info = _info;
    }

    function approveProposal(uint256[7] memory _conditions) external {
        info.loanLimit = _conditions[0];
        info.depositStartDate = _conditions[1];
        info.loanDurationInDays = _conditions[2];
        info.borrowerAPY = _conditions[3];
        
        info.collateralRatio = _conditions[4];
        info.lenderInterestAPY = _conditions[5];
        info.collateralDepositStartDate = _conditions[6];

        approved = true;
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

    function returnLoan() external payable {
        require(msg.sender == info.borrower, "only borrower can return loan");
        require(block.timestamp >= info.collateralDepositStartDate + (info.loanDurationInDays) * 86400 && 
            block.timestamp < info.collateralDepositStartDate + (info.loanDurationInDays + 2) * 86400,"currently unavailable");
        uint256 lendAmount = ILocker(info.locker).lendAmount();
        uint256 borrowerInterest = calculateInterest( lendAmount, info.borrowerAPY, info.loanDurationInDays);
        uint256 lenderInterest = calculateInterest( lendAmount, info.lenderInterestAPY, info.loanDurationInDays);

        if(msg.value > 0 ){
            ILocker(info.locker).returnAsset{value: lendAmount + lenderInterest}(info.borrower, lendAmount, lenderInterest);
            IAdmin(info.admin).collectFee{value: borrowerInterest - lenderInterest}(info.borrower, ILocker(info.locker).asset(), borrowerInterest - lenderInterest);
        }else {
            ILocker(info.locker).returnAsset(info.borrower, lendAmount, lenderInterest);
            IAdmin(info.admin).collectFee(info.borrower, ILocker(info.locker).asset(), borrowerInterest - lenderInterest);
        }
    }

    function claim() external {
        require(ILocker(info.locker).deposits(msg.sender) > 0, "only lender can claim");
        require(block.timestamp > info.collateralDepositStartDate + (info.loanDurationInDays + 2) * 86400, "currently unavailable");
        require(ILocker(info.locker).totalDeposits() == ILocker(info.locker).lendAmount() && ILocker(info.locker).totalInterest() > 0, "loan not returned yet");
        ILocker(info.locker).claim(msg.sender);
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
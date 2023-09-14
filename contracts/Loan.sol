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

        uint256 collateralAssetPriceRatio;
    }


contract Loan {
    LoanInfo public info;
    bool public approved;
    bool initialized;

    modifier onlyOwner() {
        require(msg.sender == IAdmin(info.admin).owner(), "only owner can call");
        _;
    }

    modifier onlyBorrower() {
        require(msg.sender == info.borrower, "only borrower can call");
        _;
    }

    modifier onlyLender() {
        require(ILocker(info.locker).deposits(msg.sender) > 0, "only lender can call");
        _;
    }

    function initialize(LoanInfo memory _info) external {
        require(!initialized, "already initialized");
        initialized = true;
        info = _info;
    }

    function approveProposal(uint256[8] memory _conditions) external onlyOwner{
        info.loanLimit = _conditions[0];
        info.depositStartDate = _conditions[1];
        info.loanDurationInDays = _conditions[2];
        info.borrowerAPY = _conditions[3];
        
        info.collateralRatio = _conditions[4];
        info.lenderInterestAPY = _conditions[5];
        info.collateralDepositStartDate = _conditions[6];

        info.collateralAssetPriceRatio = _conditions[7];

        approved = true;
    }

    function updateCollateralAssetPriceRatio(uint256 _ratio) external onlyOwner{
        info.collateralAssetPriceRatio = _ratio;
    }

    function depositFunds(uint256 amount) external payable {
        require(ILocker(info.locker).totalFundAmount() + amount <= info.loanLimit, "can't deposit more than loan limit");
        require(block.timestamp >= info.depositStartDate && block.timestamp < info.collateralDepositStartDate, "currently unavailable");

        ILocker(info.locker).depositFunds{ value: msg.value }(msg.sender, amount);
    }

    function depositCollateral() external payable onlyBorrower{
        require(block.timestamp >= info.collateralDepositStartDate && block.timestamp < info.collateralDepositStartDate + 48 hours, "currently unavailable");
        
        uint256 requiredCollateral = (ILocker(info.locker).totalFundAmount() * info.collateralRatio * info.collateralAssetPriceRatio) / 100000000;
        ILocker(info.locker).depositCollateral{value: msg.value}(msg.sender, requiredCollateral);
    }

    function takeLoan() external onlyBorrower{
        require(block.timestamp >= info.collateralDepositStartDate && block.timestamp < info.collateralDepositStartDate + info.loanDurationInDays * 86400, "currently unavailable"); 
        uint256 requiredCollateral = (ILocker(info.locker).totalFundAmount() * info.collateralRatio) / 10000;
        require(ILocker(info.locker).collateralAmount() == requiredCollateral, "collateral required to take loan");
        ILocker(info.locker).lendAsset(info.borrower);
    }

    function returnLoan() external payable onlyBorrower{
        require(block.timestamp >= info.collateralDepositStartDate + (info.loanDurationInDays) * 86400 && 
            block.timestamp < info.collateralDepositStartDate + (info.loanDurationInDays + 2) * 86400,"currently unavailable");
        require(ILocker(info.locker).returnedAmount() == 0 && ILocker(info.locker).totalInterest() == 0, "already returned");
        uint256 lendAmount = ILocker(info.locker).lendAmount();
        uint256 borrowerInterest = calculateInterest( lendAmount, info.borrowerAPY, info.loanDurationInDays);
        uint256 lenderInterest = calculateInterest( lendAmount, info.lenderInterestAPY, info.loanDurationInDays);

        if(msg.value > 0 ){
            ILocker(info.locker).returnAsset{value: lendAmount + lenderInterest}(info.borrower, lendAmount, lenderInterest);
            IAdmin(info.admin).collectFee{value: borrowerInterest - lenderInterest}(info.borrower, ILocker(info.locker).fundAsset(), borrowerInterest - lenderInterest);
        }else {
            ILocker(info.locker).returnAsset(info.borrower, lendAmount, lenderInterest);
            IAdmin(info.admin).collectFee(info.borrower, ILocker(info.locker).fundAsset(), borrowerInterest - lenderInterest);
        }
    }

    function withdrawCollateral() external onlyBorrower{
        require(block.timestamp >= info.collateralDepositStartDate + (info.loanDurationInDays + 2) * 86400, "currently unavailable");
        require(ILocker(info.locker).returnedAmount() == ILocker(info.locker).lendAmount(), "loan not returned yet");
        ILocker(info.locker).withdrawCollateral(msg.sender);
    }

    function claim() external onlyLender{
        require(block.timestamp > info.collateralDepositStartDate + (info.loanDurationInDays + 2) * 86400, "currently unavailable");
        require(ILocker(info.locker).returnedAmount() == ILocker(info.locker).lendAmount(), "loan default");

        ILocker(info.locker).claim(msg.sender);
    }

    function claimDefault() external onlyLender{
        require(block.timestamp > info.collateralDepositStartDate + (info.loanDurationInDays + 2) * 86400, "currently unavailable");
        require(ILocker(info.locker).returnedAmount() == 0, "loan returned");

        ILocker(info.locker).claimDefault(msg.sender);
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
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {IERC20Detail} from "./interfaces/IERC20Detail.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {TransferLib} from "./libraries/TransferLib.sol";

contract Locker {
    using SafeERC20 for IERC20Detail;

    IERC20Detail public fundAsset;
    IERC20Detail public collateralAsset;

    address public loanAddress;

    uint256 public totalFundAmount;
    uint256 public lendAmount;
    uint256 public returnedAmount;
    uint256 public collateralAmount;
    uint256 public totalInterest;

    bool initialized;

    mapping(address userAddress => uint256 depositAmount) public deposits;

    modifier onlyLoan() {
        require(msg.sender == loanAddress, "unauthorized");
        _;
    }

    function initialize(address _fundAsset, address _collateralAsset) external {
        require(!initialized, "already initialized");
        initialized = true;
        fundAsset = IERC20Detail(_fundAsset);
        collateralAsset = IERC20Detail(_collateralAsset);
    }

    receive() external payable {}

    function setLoanAddress(address _loanAddress) external {
        require(loanAddress == address(0), "address already set");
        loanAddress = _loanAddress;
    }

    function depositFunds(
        address _from,
        uint256 amount
    ) external payable onlyLoan {
        TransferLib._receive(fundAsset, _from, amount);
        totalFundAmount += amount;
        deposits[_from] += amount;
    }

    function depositCollateral(
        address _from,
        uint256 amount
    ) public payable onlyLoan {
        TransferLib._receive(collateralAsset, _from, amount);
        collateralAmount += amount;
    }

    function withdrawCollateral(address _to) external onlyLoan {
        uint256 amount = collateralAmount;
        collateralAmount = 0;
        TransferLib._send(collateralAsset, _to, amount);
    }

    function claim(address _from) external onlyLoan {
        uint256 userDeposit = deposits[_from];
        uint256 interest = (totalInterest * userDeposit) / lendAmount;
        uint256 claimAmount = interest + userDeposit;

        deposits[_from] = 0;
        totalFundAmount -= claimAmount;
        TransferLib._send(fundAsset, _from, claimAmount);
    }

    function claimDefault(address _from) external onlyLoan {
        uint256 userDeposit = deposits[_from];
        uint256 liquidatedUserAmount = (collateralAmount * userDeposit) /
            lendAmount;
        deposits[_from] = 0;
        TransferLib._send(collateralAsset, _from, liquidatedUserAmount);
    }

    function lendAsset(address _to) external onlyLoan {
        require(lendAmount == 0, "already borrowed");
        lendAmount = totalFundAmount;
        totalFundAmount -= lendAmount;
        TransferLib._send(fundAsset, _to, lendAmount);
    }

    function returnAsset(
        address _from,
        uint256 principal,
        uint256 interest
    ) external payable onlyLoan {
        require(lendAmount > 0, "not borrowed yet");
        uint256 amount = principal + interest;
        TransferLib._receive(fundAsset, _from, amount);
        totalFundAmount += (principal + interest);
        returnedAmount = principal;
        totalInterest = interest;
    }
}

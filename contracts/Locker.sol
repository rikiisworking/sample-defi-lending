// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import { IERC20Detail } from "./interfaces/IERC20Detail.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Locker {
    using SafeERC20 for IERC20Detail;

    IERC20Detail public immutable fundAsset;
    IERC20Detail public immutable collateralAsset;
   
    uint256 public totalFundAmount;
    uint256 public lendAmount;
    uint256 public returnedAmount;
    uint256 public collateralAmount;
    uint256 public totalInterest;
    mapping(address userAddress => uint256 depositAmount) public deposits;

    constructor(address _fundAsset, address _collateralAsset) {
        fundAsset = IERC20Detail(_fundAsset);
        collateralAsset = IERC20Detail(_collateralAsset);
    }

    receive() external payable {}

    function depositFunds(address _from, uint256 amount) public payable {
        if(address(fundAsset) != address(0)){
            require(msg.value == 0, "native token not supported");
            fundAsset.safeTransferFrom(_from, address(this), amount);
        }else{
            require(msg.value == amount, "invalid amount recieved");
        }

        totalFundAmount += amount;
        deposits[_from] += amount;
    }

    function depositCollateral(address _from, uint256 amount) public payable {
        if(address(collateralAsset) != address(0)){
            require(msg.value == 0, "native token not supported");
            collateralAsset.safeTransferFrom(_from, address(this), amount);
        }else{
            require(msg.value == amount, "invalid amount recieved");
        }
        collateralAmount += amount;
    }

    function withdrawCollateral(address _to) public {
        uint256 amount = collateralAmount;
        collateralAmount = 0;

        if (address(collateralAsset) != address(0)){
            collateralAsset.safeTransfer(_to, amount);
        } else {
            (bool sent, ) = _to.call{ value: amount }("");
            require(sent, "failed to send native token");
        }
    } 

    function claim(address _from) public {
        uint256 userDeposit = deposits[_from];
        uint256 interest = totalInterest * userDeposit / lendAmount;
        uint256 claimAmount = interest + userDeposit;
        
        deposits[_from] = 0;
        totalFundAmount -= claimAmount;

        if (address(fundAsset) != address(0)) {
            fundAsset.safeTransfer(_from, claimAmount);
        } else {
            (bool sent, ) = _from.call{ value: claimAmount }("");
            require(sent, "failed to send native token");
        }
    }

    function claimDefault(address _from) public {
        uint256 userDeposit = deposits[_from];
        uint256 liquidatedUserAmount = collateralAmount * userDeposit / lendAmount;
        deposits[_from] = 0;

        if (address(collateralAsset) != address(0)) {
            collateralAsset.safeTransfer(_from, liquidatedUserAmount);
        } else {
            (bool sent, ) = _from.call{ value: liquidatedUserAmount }("");
            require(sent, "failed to send native token");
        }
    }

    function lendAsset(address _to) public {
        require(lendAmount == 0, "already borrowed");
        lendAmount = totalFundAmount;
        totalFundAmount -= lendAmount;

        if (address(fundAsset) != address(0)) {
            fundAsset.safeTransfer(_to, lendAmount);
        } else {
            (bool sent, ) = _to.call{ value: lendAmount }("");
            require(sent, "failed to send native token");
        }
    }

    function returnAsset(address _from, uint256 principal, uint256 interest) public payable {
        require(lendAmount > 0, "not borrowed yet");
        
        uint256 amount = principal + interest;
        if(address(fundAsset) != address(0)){
            require(msg.value == 0, "native token not supported");
            fundAsset.safeTransferFrom(_from, address(this), amount);
        }else{
            require(msg.value == amount, "invalid amount recieved");
        }
        
        totalFundAmount += (principal+interest);
        returnedAmount = principal;
        totalInterest = interest;
    }
}
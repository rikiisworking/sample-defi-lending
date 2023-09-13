// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import { IERC20Detail } from "./interfaces/IERC20Detail.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Locker {
    using SafeERC20 for IERC20Detail;

    IERC20Detail public immutable asset;
   
    uint256 public totalDeposits;
    uint256 public lendAmount;
    uint256 public returnedAmount;
    uint256 public collateralAmount;
    uint256 public totalInterest;
    mapping(address userAddress => uint256 depositAmount) public deposits;

    constructor(address _asset) {
        asset = IERC20Detail(_asset);
    }

    receive() external payable {}

    function deposit(address _from, uint256 amount) public payable {
        if(address(asset) != address(0)){
            require(msg.value == 0, "native token not supported");
            asset.safeTransferFrom(_from, address(this), amount);
        }else{
            require(msg.value == amount, "invalid amount recieved");
        }

        totalDeposits += amount;
        deposits[_from] += amount;
    }

    function depositCollateral(address _from, uint256 amount) public payable {
        if(address(asset) != address(0)){
            require(msg.value == 0, "native token not supported");
            asset.safeTransferFrom(_from, address(this), amount);
        }else{
            require(msg.value == amount, "invalid amount recieved");
        }
        collateralAmount += amount;
    }

    function withdraw(address _to, uint256 amount) public {
        deposits[_to] -= amount;
        totalDeposits -= amount;

        if (address(asset) != address(0)) {
            asset.safeTransfer(_to, amount);
        } else {
            (bool sent, ) = _to.call{ value: amount }("");
            require(sent, "failed to send native token");
        }
    }

    function withdrawCollateral(address _to) public {
        uint256 amount = collateralAmount;
        collateralAmount = 0;

        if (address(asset) != address(0)){
            asset.safeTransfer(_to, amount);
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
        totalDeposits -= userDeposit;

        if (address(asset) != address(0)) {
            asset.safeTransfer(_from, claimAmount);
        } else {
            (bool sent, ) = _from.call{ value: claimAmount }("");
            require(sent, "failed to send native token");
        }
    }

    function claimDefault(address _from) public {
        uint256 userDeposit = deposits[_from];
        uint256 liquidatedUserAmount = collateralAmount * userDeposit / lendAmount;
        deposits[_from] = 0;

        if (address(asset) != address(0)) {
            asset.safeTransfer(_from, liquidatedUserAmount);
        } else {
            (bool sent, ) = _from.call{ value: liquidatedUserAmount }("");
            require(sent, "failed to send native token");
        }
    }

    function lendAsset(address _to) public {
        require(lendAmount == 0, "already borrowed");
        lendAmount = totalDeposits;
        totalDeposits -= lendAmount;

        if (address(asset) != address(0)) {
            asset.safeTransfer(_to, lendAmount);
        } else {
            (bool sent, ) = _to.call{ value: lendAmount }("");
            require(sent, "failed to send native token");
        }
    }

    function returnAsset(address _from, uint256 principal, uint256 interest) public payable {
        require(lendAmount > 0, "not borrowed yet");
        
        uint256 amount = principal + interest;
        if(address(asset) != address(0)){
            require(msg.value == 0, "native token not supported");
            asset.safeTransferFrom(_from, address(this), amount);
        }else{
            require(msg.value == amount, "invalid amount recieved");
        }
        
        totalDeposits += (principal+interest);
        returnedAmount = principal;
        totalInterest = interest;
    }
}
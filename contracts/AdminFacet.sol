// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {ILocker} from "./interfaces/ILocker.sol";
import {LoanInfo} from "./interfaces/ILoanFactory.sol";
import {LoanFactoryFacet} from "./LoanFactoryFacet.sol";
import {LockerFactoryFacet} from "./LockerFactoryFacet.sol";
import {AdminLib} from "./libraries/AdminLib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AdminFacet {
    using SafeERC20 for IERC20;

    modifier onlyOwner() {
        require(msg.sender == AdminLib.getOwner(), "unauthorized");
        _;
    }

    function owner() external view returns (address) {
        return AdminLib.getOwner();
    }

    function addBorrower(address _address) external onlyOwner {
        AdminLib.setBorrower(_address, true);
    }

    function removeBorrower(address _address) external onlyOwner {
        AdminLib.setBorrower(_address, false);
    }

    function setOwner(address _owner) external onlyOwner {
        AdminLib.setOwner(_owner);
    }

    function createProposal(
        uint256[4] memory conditions,
        address _fundAsset,
        address _collateralAsset
    ) external {
        address lockerAddress = LockerFactoryFacet(address(this)).createLocker(
            _fundAsset,
            _collateralAsset
        );
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
        address loanAddress = LoanFactoryFacet(address(this)).createLoan(
            loanInfo
        );
        ILocker(lockerAddress).setLoanAddress(loanAddress);
    }

    function collectFee(
        address _from,
        address asset,
        uint256 amount
    ) external payable {
        if (address(asset) != address(0)) {
            require(msg.value == 0, "native token not supported");
            IERC20(asset).safeTransferFrom(_from, address(this), amount);
        } else {
            require(msg.value == amount, "invalid amount recieved");
        }
        AdminLib.setCollectedFees(asset, amount);
    }

    function withdrawFee(address asset) external onlyOwner {
        uint256 amount = AdminLib.getCollectedFees(asset);
        require(amount > 0, "no fee to withdraw");
        AdminLib.setCollectedFees(asset, 0);

        if (address(asset) != address(0)) {
            IERC20(asset).safeTransfer(AdminLib.getOwner(), amount);
        } else {
            (bool sent, ) = AdminLib.getOwner().call{value: amount}("");
            require(sent, "failed to send native token");
        }
    }
}

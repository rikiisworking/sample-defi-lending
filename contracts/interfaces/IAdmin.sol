// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface IAdmin {
    function owner() external view returns (address);

    function borrowers(address) external view returns (bool);

    function collectedFees(address) external view returns (uint256 amount);

    function addBorrower(address _address) external;

    function removeBorrower(address _address) external;

    function setOwner(address _address) external;

    function collectFee(address _from, address asset, uint256 amount) external payable;
}

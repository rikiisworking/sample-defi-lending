// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface ILocker {
    function asset() external view returns (address);
    function totalDeposits() external view returns (uint256);
    function deposits(address user) external view returns (uint256);
    function deposit(address _from, uint256 amount) external payable;
    function withdraw(address _to, uint256 amount) external;
    function lendAsset(address _to) external;
    function returnAsset(address _from) external payable;
}
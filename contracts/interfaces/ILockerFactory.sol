// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface ILockerFactory {
    function createLocker(address _asset) external returns (address);
}
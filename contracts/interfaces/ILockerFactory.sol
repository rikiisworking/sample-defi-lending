// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface ILockerFactory {
    function createLocker(address _fundAsset, address _collateralAsset) external returns (address);
}
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface ILockerFactory {
    function setLockerImpl(address _address) external;

    function createLocker(address _fundAsset, address _collateralAsset) external returns (address);
}

// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import { Locker } from "./Locker.sol";

contract LockerFactory {
    mapping(uint256 => address) public lockers;
    uint256 public lockerSize;
    address immutable admin;

    constructor(address _admin) {
        admin = _admin;
    }

    function createLocker(address _fundAsset, address _collateralAsset) external returns (address) {
        require(msg.sender == admin, "unauthorized");
        Locker locker = new Locker(_fundAsset, _collateralAsset);
        lockers[lockerSize++] = address(locker);
        return address(locker);
    }

}
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

    function createLocker(address _asset) external returns (address) {
        Locker locker = new Locker(_asset);
        lockers[lockerSize++] = address(locker);
        return address(locker);
    }

}
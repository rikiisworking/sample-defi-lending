// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import { Locker } from "./Locker.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";

contract LockerFactory {
    mapping(uint256 => address) public lockers;
    uint256 public lockerSize;
    address immutable admin;
    address public lockerImplementationAddress;

    constructor(address _admin, address _lockerImpl) {
        admin = _admin;
        lockerImplementationAddress = _lockerImpl;
    }

    function setLockerImpl(address _address) external {
        require(msg.sender == admin, "unauthorized");
        lockerImplementationAddress = _address;
    }

    function createLocker(address _fundAsset, address _collateralAsset) external returns (address) {
        require(msg.sender == admin, "unauthorized");
        Locker locker = Locker(payable(Clones.clone(lockerImplementationAddress)));
        locker.initialize(_fundAsset, _collateralAsset);
        lockers[lockerSize++] = address(locker);
        return address(locker);
    }

}
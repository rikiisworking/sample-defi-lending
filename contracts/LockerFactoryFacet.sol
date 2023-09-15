// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {LockerFactoryLib} from "./libraries/LockerFactoryLib.sol";
import {AdminLib} from "./libraries/AdminLib.sol";

import {Locker} from "./Locker.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

contract LockerFactoryFacet {
    function setLockerImpl(address _address) external {
        require(msg.sender == AdminLib.getOwner(), "unauthorized");
        LockerFactoryLib.setLockerImpl(_address);
    }

    function createLocker(
        address _fundAsset,
        address _collateralAsset
    ) external returns (address) {
        Locker locker = Locker(
            payable(Clones.clone(LockerFactoryLib.getLockerImpl()))
        );
        locker.initialize(_fundAsset, _collateralAsset);
        LockerFactoryLib.setLockerSize(LockerFactoryLib.getLockerSize() + 1);
        LockerFactoryLib.setLocker(
            LockerFactoryLib.getLockerSize(),
            address(locker)
        );
        return address(locker);
    }
}

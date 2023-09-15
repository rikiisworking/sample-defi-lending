// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

library LockerFactoryLib {
    bytes32 constant DIAMOND_STORAGE_POSITION =
        keccak256("diamond.standard.lockerFactory.storage");

    struct LockerFactoryState {
        mapping(uint256 => address) lockers;
        uint256 lockerSize;
        address lockerImplementationAddress;
    }

    function diamondStorage()
        internal
        pure
        returns (LockerFactoryState storage ds)
    {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    function getLocker(uint256 index) internal view returns (address) {
        LockerFactoryState storage lockerFactoryState = diamondStorage();
        return lockerFactoryState.lockers[index];
    }

    function setLocker(uint256 index, address lockerAddress) internal {
        LockerFactoryState storage lockerFactoryState = diamondStorage();
        lockerFactoryState.lockers[index] = lockerAddress;
    }

    function getLockerImpl() internal view returns (address) {
        LockerFactoryState storage lockerFactoryState = diamondStorage();
        return lockerFactoryState.lockerImplementationAddress;
    }

    function setLockerImpl(address _address) internal {
        LockerFactoryState storage lockerFactoryState = diamondStorage();
        lockerFactoryState.lockerImplementationAddress = _address;
    }

    function getLockerSize() internal view returns (uint256) {
        LockerFactoryState storage lockerFactoryState = diamondStorage();
        return lockerFactoryState.lockerSize;
    }

    function setLockerSize(uint256 newSize) internal {
        LockerFactoryState storage lockerFactoryState = diamondStorage();
        lockerFactoryState.lockerSize = newSize;
    }
}

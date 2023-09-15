// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

library AdminLib {
    bytes32 constant DIAMOND_STORAGE_POSITION =
        keccak256("diamond.standard.admin.storage");

    struct AdminState {
        address owner;
        mapping(address borrower => bool isWhitelisted) borrowers;
        mapping(address asset => uint256 amount) collectedFees;
    }

    function diamondStorage() internal pure returns (AdminState storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    function getOwner() internal view returns (address) {
        AdminState storage adminState = diamondStorage();
        return adminState.owner;
    }

    function setOwner(address _owner) internal {
        AdminState storage adminState = diamondStorage();
        adminState.owner = _owner;
    }

    function getBorrower(address _address) internal view returns (bool) {
        AdminState storage adminState = diamondStorage();
        return adminState.borrowers[_address];
    }

    function setBorrower(address _address, bool _isWhitelisted) internal {
        AdminState storage adminState = diamondStorage();
        adminState.borrowers[_address] = _isWhitelisted;
    }

    function getCollectedFees(address _asset) internal view returns (uint256) {
        AdminState storage adminState = diamondStorage();
        return adminState.collectedFees[_asset];
    }

    function setCollectedFees(address _asset, uint256 amount) internal {
        AdminState storage adminState = diamondStorage();
        adminState.collectedFees[_asset] = amount;
    }
}

// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

contract Admin {
    address public owner;
    mapping(address borrower => bool isWhitelisted) public borrowers;

    modifier onlyOwner() {
        require(msg.sender == owner, "unauthorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function addBorrower(address _address) external onlyOwner {
        borrowers[_address] = true;
    }

    function removeBorrower(address _address) external onlyOwner {
        borrowers[_address] = false;
    }

    function setOwner(address _address) external onlyOwner {
        require(_address != address(0), "invalid address");
        owner = _address;
    }
}
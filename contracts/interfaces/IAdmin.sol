// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface IAdmin {
    function owner() external view returns (address);
    function borrowers(address) external view returns (bool);
    function addBorrower(address _address) external;
    function removeBorrower(address _address) external;
    function setOwner(address _address) external;
}
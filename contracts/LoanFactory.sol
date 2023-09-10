// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import { Loan } from "./Loan.sol";

contract LoanFactory {
    mapping(uint256 => address) public loans;
    uint256 public loanSize;
    address immutable admin;
    
    constructor(address _admin) {
        admin = _admin;
    }

    function createLoan(Loan.LoanInfo memory _conditions) external returns (address) {
        Loan loan = new Loan(_conditions);
        loans[loanSize++] = address(loan);
        return address(loan);
    }
}
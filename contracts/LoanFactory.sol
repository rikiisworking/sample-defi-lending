// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Loan, LoanInfo} from "./Loan.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

contract LoanFactory {
    mapping(uint256 => address) public loans;
    uint256 public loanSize;
    address immutable admin;
    address public loanImplementationAddress;

    constructor(address _admin, address _loanImpl) {
        admin = _admin;
        loanImplementationAddress = _loanImpl;
    }

    function setLoanImpl(address _address) external {
        require(msg.sender == admin, "unauthorized");
        loanImplementationAddress = _address;
    }

    function createLoan(LoanInfo memory _conditions) external returns (address) {
        require(msg.sender == admin, "unauthorized");

        Loan loan = Loan(Clones.clone(loanImplementationAddress));
        loan.initialize(_conditions);
        loans[loanSize++] = address(loan);
        return address(loan);
    }
}

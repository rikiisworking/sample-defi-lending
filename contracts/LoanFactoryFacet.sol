// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Loan, LoanInfo} from "./Loan.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {LoanFactoryLib} from "./libraries/LoanFactoryLib.sol";
import {AdminLib} from "./libraries/AdminLib.sol";

contract LoanFactoryFacet {
    function setLoanImpl(address _address) external {
        require(msg.sender == AdminLib.getOwner(), "unauthorized");
        LoanFactoryLib.setLoanImpl(_address);
    }

    function createLoan(
        LoanInfo memory _conditions
    ) external returns (address) {
        Loan loan = Loan(Clones.clone(LoanFactoryLib.getLoanImpl()));
        loan.initialize(_conditions);
        LoanFactoryLib.setLoanSize(LoanFactoryLib.getLoanSize() + 1);
        LoanFactoryLib.setLoan(LoanFactoryLib.getLoanSize(), address(loan));
        return address(loan);
    }
}

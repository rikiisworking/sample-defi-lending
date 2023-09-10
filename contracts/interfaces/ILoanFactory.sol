// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import { LoanInfo } from "../Loan.sol";

interface ILoanFactory {
    function createLoan(LoanInfo memory _conditions) external returns (address);
}
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {LoanInfo} from "../Loan.sol";

interface ILoanFactory {
    function setLoanImpl(address _address) external;

    function createLoan(LoanInfo memory _conditions) external returns (address);
}

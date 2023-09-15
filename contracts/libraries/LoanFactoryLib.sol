// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

library LoanFactoryLib {
    bytes32 constant DIAMOND_STORAGE_POSITION =
        keccak256("diamond.standard.loanFactory.storage");

    struct LoanFactoryState {
        mapping(uint256 => address) loans;
        uint256 loanSize;
        address loanImplementationAddress;
    }

    function diamondStorage()
        internal
        pure
        returns (LoanFactoryState storage ds)
    {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    function getLoan(uint256 index) internal view returns (address) {
        LoanFactoryState storage loanFactoryState = diamondStorage();
        return loanFactoryState.loans[index];
    }

    function setLoan(uint256 index, address loanAddress) internal {
        LoanFactoryState storage loanFactoryState = diamondStorage();
        loanFactoryState.loans[index] = loanAddress;
    }

    function getLoanImpl() internal view returns (address) {
        LoanFactoryState storage loanFactoryState = diamondStorage();
        return loanFactoryState.loanImplementationAddress;
    }

    function setLoanImpl(address _address) internal {
        LoanFactoryState storage loanFactoryState = diamondStorage();
        loanFactoryState.loanImplementationAddress = _address;
    }

    function getLoanSize() internal view returns (uint256) {
        LoanFactoryState storage loanFactoryState = diamondStorage();
        return loanFactoryState.loanSize;
    }

    function setLoanSize(uint256 newSize) internal {
        LoanFactoryState storage loanFactoryState = diamondStorage();
        loanFactoryState.loanSize = newSize;
    }
}

# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```

# Project description

## outline

there are 3 roles for this service,
- borrower: borrows funds and pays back with borrowerInterest
- lender: lends funds and gets lenderInterest
- admin: verify loan condition and approves loan, monetize from interest difference

1. borrower proposes loan with conditions
2. admin fixes condition and approves loan
3. lenders deposits into locker for loan
4. once funding is completed, borrower deposits collateral
5. after depositing collateral, borrower can take loan from locker
6. borrower returns principal with interest after loan duration and withdraws collateral
7. lenders claim their deposits and interest

## details

tbu

## Todos

- [x] Set different assets for collateral and funding
- [x] Default & Liquidate functionality
- [x] test codes for Default & Liquidate functionality
- [x] Separate basic transfer functionality working for both erc20 and native token
- [x] limit function call directly from locker
- [x] complete function call auth check
- [ ] test codes for native tokens for Loan.ts
- [ ] diamondcut pattern adoption
- [ ] scenario test codes
- [ ] update readme with detailed description

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

# Sample Lending Service

1. borrower proposes loan with conditions
2. admin fixes condition and approves loan
3. lenders deposits into locker for loan
4. once funding is completed, borrower deposits collateral
5. after depositing collateral, borrower can take loan from locker
6. borrower returns principal with interest after loan duration
7. lenders claim their deposits and interest
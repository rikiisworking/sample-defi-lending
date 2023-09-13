// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

interface ILocker {
    function fundAsset() external view returns (address);
    function collateralAsset() external view returns (address);
    function totalFundAmount() external view returns (uint256);
    function returnedAmount() external view returns (uint256);
    function collateralAmount() external view returns (uint256);
    function lendAmount() external view returns (uint256);
    function totalInterest() external view returns (uint256);
    function deposits(address user) external view returns (uint256);
    function depositFunds(address _from, uint256 amount) external payable;
    function depositCollateral(address _from, uint256 amount) external payable;
    function withdraw(address _to, uint256 amount) external;
    function withdrawCollateral(address _to) external;
    function claim(address _from) external;
    function claimDefault(address _from) external;
    function lendAsset(address _to) external;
    function returnAsset(address _from, uint256 principal, uint256 interest) external payable;
}
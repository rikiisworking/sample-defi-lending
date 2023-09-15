// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {IERC20Detail} from "../interfaces/IERC20Detail.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

library TransferLib {
    using SafeERC20 for IERC20Detail;

    function _receive(address asset, address _from, uint256 amount) internal {
        if (asset != address(0)) {
            require(msg.value == 0, "native token not supported");
            IERC20Detail(asset).safeTransferFrom(_from, address(this), amount);
        } else {
            require(msg.value == amount, "invalid amount received");
        }
    }

    function _send(address asset, address _to, uint256 amount) internal {
        if (asset != address(0)) {
            IERC20Detail(asset).safeTransfer(_to, amount);
        } else {
            (bool sent, ) = _to.call{value: amount}("");
            require(sent, "failed to send native token");
        }
    }
}

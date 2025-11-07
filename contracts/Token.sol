// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    // Event emitted when faucet is called
    event FaucetUsed(address indexed to, uint256 amount, address indexed caller);

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        // Initial supply: 0, tokens will be minted via faucet
    }

    /**
     * @dev Faucet function to mint tokens to any address
     * @param to Address to receive the tokens
     * @param amount Amount of tokens to mint
     */
    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
        emit FaucetUsed(to, amount, msg.sender);
    }
}


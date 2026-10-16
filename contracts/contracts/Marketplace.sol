// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Project} from "./Project.sol";
import {ProjectFactory} from "./ProjectFactory.sol";
import {ScenarioNFT} from "./ScenarioNFT.sol";

/// @title Marketplace
/// @notice Investors mint an NFT for a chosen project; the full payment is routed to that
///         project's contract. The marketplace keeps nothing and takes no fee.
/// @dev Educational testnet contract. No receive/fallback, so ETH cannot be sent here directly.
contract Marketplace is ReentrancyGuard {
    ProjectFactory public immutable factory;
    ScenarioNFT public immutable nft;

    event PaymentRouted(address indexed project, address indexed investor, uint256 indexed tokenId, uint256 amount);

    error UnknownProject(address project);
    error IncorrectPayment(uint256 expected, uint256 received);

    constructor(ProjectFactory factory_, ScenarioNFT nft_) {
        factory = factory_;
        nft = nft_;
    }

    /// @notice Mints one NFT for `project` to the caller and forwards exactly the mint price to it.
    function mint(address project) external payable nonReentrant returns (uint256 tokenId) {
        if (!factory.isProject(project)) revert UnknownProject(project);
        uint256 price = Project(project).mintPrice();
        if (msg.value != price) revert IncorrectPayment(price, msg.value);

        tokenId = nft.mint(msg.sender, project);
        Project(project).deposit{value: msg.value}(msg.sender, tokenId);
        emit PaymentRouted(project, msg.sender, tokenId, msg.value);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Project
/// @notice One creator's role-play project. Receives mint payments only through the marketplace
///         and lets its creator withdraw them.
/// @dev Deployed by ProjectFactory. Withdrawal rule: only the creator, any time, up to the
///      amount received and not yet withdrawn, always paid to the creator's own address.
///      Educational testnet contract. Funds have no monetary value.
contract Project is ReentrancyGuard {
    uint256 public immutable projectId;
    address public immutable factory;
    address public immutable creator;
    address public immutable marketplace;
    uint256 public immutable mintPrice;
    string public name;
    string public metadataURI;

    uint256 public totalReceived;
    uint256 public totalWithdrawn;

    event FundsReceived(address indexed investor, uint256 indexed tokenId, uint256 amount, uint256 totalReceived);
    event Withdrawn(address indexed to, uint256 amount, uint256 totalWithdrawn);

    error NotMarketplace(address caller);
    error NotCreator(address caller);
    error IncorrectPayment(uint256 expected, uint256 received);
    error InvalidAmount(uint256 requested, uint256 available);
    error TransferFailed();

    constructor(
        uint256 projectId_,
        address creator_,
        address marketplace_,
        string memory name_,
        uint256 mintPrice_,
        string memory metadataURI_
    ) {
        projectId = projectId_;
        factory = msg.sender;
        creator = creator_;
        marketplace = marketplace_;
        name = name_;
        mintPrice = mintPrice_;
        metadataURI = metadataURI_;
    }

    /// @notice Records a mint payment. Marketplace only; must be exactly the mint price.
    function deposit(address investor, uint256 tokenId) external payable {
        if (msg.sender != marketplace) revert NotMarketplace(msg.sender);
        if (msg.value != mintPrice) revert IncorrectPayment(mintPrice, msg.value);
        totalReceived += msg.value;
        emit FundsReceived(investor, tokenId, msg.value, totalReceived);
    }

    /// @notice Funds received through mints and not yet withdrawn.
    /// @dev Based on accounting, not address(this).balance, so ETH forced in by other means is ignored.
    function availableToWithdraw() public view returns (uint256) {
        return totalReceived - totalWithdrawn;
    }

    /// @notice Sends `amount` to the creator. Creator only.
    function withdraw(uint256 amount) external nonReentrant {
        if (msg.sender != creator) revert NotCreator(msg.sender);
        uint256 available = availableToWithdraw();
        if (amount == 0 || amount > available) revert InvalidAmount(amount, available);

        totalWithdrawn += amount;
        emit Withdrawn(creator, amount, totalWithdrawn);

        (bool ok, ) = creator.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}

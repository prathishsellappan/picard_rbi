// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ScenarioNFT
/// @notice One shared ERC-721 collection for every role-play project. Only the marketplace can
///         mint, and each token records the project it was minted for.
/// @dev Educational testnet contract. Tokens have no monetary value.
contract ScenarioNFT is ERC721, Ownable {
    address public marketplace;
    uint256 public totalMinted;
    string private baseTokenURI;

    /// @notice Project contract each token was minted for.
    mapping(uint256 tokenId => address project) public projectOf;

    event MarketplaceSet(address indexed marketplace);
    event BaseURISet(string baseURI);

    error MarketplaceAlreadySet();
    error ZeroAddress();
    error NotMarketplace(address caller);

    constructor(address initialOwner, string memory baseURI_)
        ERC721("Picard Scenario NFT", "PICARD")
        Ownable(initialOwner)
    {
        baseTokenURI = baseURI_;
        emit BaseURISet(baseURI_);
    }

    /// @notice One-time wiring to the marketplace.
    function setMarketplace(address marketplace_) external onlyOwner {
        if (marketplace != address(0)) revert MarketplaceAlreadySet();
        if (marketplace_ == address(0)) revert ZeroAddress();
        marketplace = marketplace_;
        emit MarketplaceSet(marketplace_);
    }

    /// @notice Points token metadata at the application's metadata route.
    function setBaseURI(string calldata baseURI_) external onlyOwner {
        baseTokenURI = baseURI_;
        emit BaseURISet(baseURI_);
    }

    /// @notice Mints the next token to `to` for `project`. Marketplace only.
    /// @dev Uses _mint (not _safeMint) so no external callback runs during a mint.
    function mint(address to, address project) external returns (uint256 tokenId) {
        if (msg.sender != marketplace) revert NotMarketplace(msg.sender);
        tokenId = ++totalMinted;
        projectOf[tokenId] = project;
        _mint(to, tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }
}

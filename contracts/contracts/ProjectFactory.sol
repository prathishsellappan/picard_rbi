// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Project} from "./Project.sol";

/// @title ProjectFactory
/// @notice Deploys one standardized Project per organizer-approved creator and acts as the
///         registry the marketplace trusts.
/// @dev Educational testnet contract.
contract ProjectFactory is Ownable {
    uint256 public constant MAX_NAME_LENGTH = 64;
    uint256 public constant MAX_URI_LENGTH = 256;

    address public marketplace;
    uint256 public minMintPrice;
    uint256 public maxMintPrice;

    mapping(address creator => bool) public isCreatorAllowed;
    mapping(address creator => address project) public projectOfCreator;
    mapping(address project => bool) public isProject;
    address[] private allProjects;

    event MarketplaceSet(address indexed marketplace);
    event CreatorAllowed(address indexed creator, bool allowed);
    event MintPriceBoundsSet(uint256 minMintPrice, uint256 maxMintPrice);
    event ProjectCreated(
        uint256 indexed projectId,
        address indexed project,
        address indexed creator,
        string name,
        uint256 mintPrice,
        string metadataURI
    );

    error MarketplaceAlreadySet();
    error MarketplaceNotSet();
    error ZeroAddress();
    error InvalidPriceBounds(uint256 minMintPrice, uint256 maxMintPrice);
    error CreatorNotAllowed(address creator);
    error CreatorAlreadyHasProject(address creator, address project);
    error InvalidName();
    error InvalidMetadataURI();
    error MintPriceOutOfBounds(uint256 mintPrice, uint256 minMintPrice, uint256 maxMintPrice);

    constructor(address initialOwner, uint256 minMintPrice_, uint256 maxMintPrice_) Ownable(initialOwner) {
        _setMintPriceBounds(minMintPrice_, maxMintPrice_);
    }

    /// @notice One-time wiring to the marketplace that projects will accept payments from.
    function setMarketplace(address marketplace_) external onlyOwner {
        if (marketplace != address(0)) revert MarketplaceAlreadySet();
        if (marketplace_ == address(0)) revert ZeroAddress();
        marketplace = marketplace_;
        emit MarketplaceSet(marketplace_);
    }

    function setCreatorAllowed(address creator, bool allowed) external onlyOwner {
        if (creator == address(0)) revert ZeroAddress();
        isCreatorAllowed[creator] = allowed;
        emit CreatorAllowed(creator, allowed);
    }

    /// @notice Bounds apply to projects created afterwards; existing projects keep their price.
    function setMintPriceBounds(uint256 minMintPrice_, uint256 maxMintPrice_) external onlyOwner {
        _setMintPriceBounds(minMintPrice_, maxMintPrice_);
    }

    /// @notice Called by an approved creator from their own wallet. One project per creator.
    function createProject(
        string calldata name,
        uint256 mintPrice,
        string calldata metadataURI
    ) external returns (address project) {
        if (marketplace == address(0)) revert MarketplaceNotSet();
        if (!isCreatorAllowed[msg.sender]) revert CreatorNotAllowed(msg.sender);
        address existing = projectOfCreator[msg.sender];
        if (existing != address(0)) revert CreatorAlreadyHasProject(msg.sender, existing);
        uint256 nameLength = bytes(name).length;
        if (nameLength == 0 || nameLength > MAX_NAME_LENGTH) revert InvalidName();
        if (bytes(metadataURI).length > MAX_URI_LENGTH) revert InvalidMetadataURI();
        if (mintPrice < minMintPrice || mintPrice > maxMintPrice) {
            revert MintPriceOutOfBounds(mintPrice, minMintPrice, maxMintPrice);
        }

        uint256 projectId = allProjects.length + 1;
        project = address(new Project(projectId, msg.sender, marketplace, name, mintPrice, metadataURI));

        allProjects.push(project);
        isProject[project] = true;
        projectOfCreator[msg.sender] = project;
        emit ProjectCreated(projectId, project, msg.sender, name, mintPrice, metadataURI);
    }

    function projectCount() external view returns (uint256) {
        return allProjects.length;
    }

    /// @notice Project contract by 1-based project ID.
    function projectById(uint256 projectId) external view returns (address) {
        return allProjects[projectId - 1];
    }

    function getProjects() external view returns (address[] memory) {
        return allProjects;
    }

    function _setMintPriceBounds(uint256 minMintPrice_, uint256 maxMintPrice_) private {
        if (minMintPrice_ == 0 || minMintPrice_ > maxMintPrice_) {
            revert InvalidPriceBounds(minMintPrice_, maxMintPrice_);
        }
        minMintPrice = minMintPrice_;
        maxMintPrice = maxMintPrice_;
        emit MintPriceBoundsSet(minMintPrice_, maxMintPrice_);
    }
}

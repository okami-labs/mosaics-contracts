/// SPDX-License-Identifier: GPL-3.0

/// @title The Mosaics ERC-721A Token

pragma solidity ^0.8.6;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import "erc721a/contracts/extensions/ERC721ABurnable.sol";
import "erc721a/contracts/IERC721A.sol";
import "erc721a/contracts/ERC721A.sol";

contract MosaicsToken is ERC721ABurnable, Ownable {
    // The mosaics DAO address
    address public mosaicsDAO;

    // The Okami Labs address
    address public okamiLabs;

    // An address who has permissions to mint Mosaics
    address public minter;

    // Whether the minter can be updated
    bool public isMinterLocked;

    // IPFS content hash of the contract-level metadata
    string private _contractURIHash = "QmX6FPXtrS7nPodsevxgucu2oPhNXKPnob7YESzZDKiRQ5";

    // IPFS hash of the default mosaic image, before the auction ends.
    string private _defaultMosaicURIHash = "";

    // IPFS hashes of the mosaic images, set by the owner after the auction ends.
    string[] private _mosaicURIHashes;

    event MosaicCreated(uint256 indexed tokenId);

    event MosaicBurned(uint256 indexed tokenId);

    event MosaicsDAOUpdated(address mosaicsDAO);

    event MinterUpdated(address minter);

    event MinterLocked();

    /**
     * @notice Require that the minter has not been locked.
     */
    modifier whenMinterNotLocked() {
        require(!isMinterLocked, "Minter is locked");
        _;
    }

    /**
     * @notice Require that the sender is the Mosaics DAO.
     */
    modifier onlyMosaicsDAO() {
        require(msg.sender == mosaicsDAO, "Sender is not the Mosaics DAO");
        _;
    }

    /**
     * @notice Require that the sender is the minter.
     */
    modifier onlyMinter() {
        require(msg.sender == minter, "Sender is not the minter");
        _;
    }

    constructor(
        address _mosaicsDAO,
        address _minter,
        address _okamiLabs
    ) ERC721A("Mosaics", "MOSAIC") {
        mosaicsDAO = _mosaicsDAO;
        okamiLabs = _okamiLabs;
        minter = _minter;
    }

    /**
     * @notice The IPFS URI of the contract-level metadata.
     */
    function contractURI() public view returns (string memory) {
        return string(abi.encodePacked("ipfs://", _contractURIHash));
    }

    /**
     * @notice Set the _contractURIHash.
     * @dev Only callable by the owner.
     */
    function setContractURIHash(string memory newContractURIHash) external onlyOwner {
        _contractURIHash = newContractURIHash;
    }

    /**
     * @notice Mint a new Mosaic.
     * @dev Only callable by the minter.
     */
    function mint() public onlyMinter returns (uint256) {
        uint256 tokenId = _nextTokenId();
        _mint(minter, 1);
        _mosaicURIHashes.push(_defaultMosaicURIHash);
        emit MosaicCreated(tokenId);

        return tokenId;
    }

    /**
     * @notice Burn the mosaicId token.
     * @dev Only callable by the minter.
     */
    function burn(uint256 mosaicId) public override onlyMinter {
        require(_exists(mosaicId), "MosaicsToken: This is a non-existent Mosaic token");
        _burn(mosaicId);
        emit MosaicBurned(mosaicId);
    }

    /**
     * @notice A distinct Uniform Resource Identifier (URI) for a given asset.
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view override(IERC721A, ERC721A) returns (string memory) {
        require(_exists(tokenId), "MosaicsToken: URI query for non-existent token");
        return string(abi.encodePacked("ipfs://", _mosaicURIHashes[tokenId]));
    }

    /**
     * @notice Set the URI of a given mosaic.
     * @dev Only callable by the owner.
     */
    function setMosaicURIHash(uint256 tokenId, string memory mosaicURIHash) external onlyOwner {
        require(_exists(tokenId), "MosaicsToken: This is a non-existent Mosaic token");
        _mosaicURIHashes[tokenId] = mosaicURIHash;
    }

    /**
     * @notice Set the default URI for mosaics.
     * @dev Only callable by the owner.
     */
    function setDefaultMosaicURIHash(string memory defaultMosaicURIHash) external onlyOwner {
        _defaultMosaicURIHash = defaultMosaicURIHash;
    }

    /**
     * @notice Set the Mosaics DAO.
     * @dev Only callable by the Mosaics DAO.
     */
    function setMosaicsDAO(address _mosaicsDAO) external onlyMosaicsDAO {
        mosaicsDAO = _mosaicsDAO;

        emit MosaicsDAOUpdated(_mosaicsDAO);
    }

    /**
     * @notice Set the minter.
     * @dev Only callable by the owner when minter is not locked.
     */
    function setMinter(address _minter) external onlyOwner whenMinterNotLocked {
        minter = _minter;

        emit MinterUpdated(_minter);
    }

    /**
     * @notice Lock the minter.
     * @dev Only callable by the owner.
     */
    function lockMinter() external onlyOwner whenMinterNotLocked {
        isMinterLocked = true;

        emit MinterLocked();
    }
}

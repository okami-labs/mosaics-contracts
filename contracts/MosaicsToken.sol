/// SPDX-License-Identifier: GPL-3.0

/// @title The Mosaics ERC-721 Token

/******************************
 * ░░░░░░░░░░░░░░░░░░░░░░░░░░ *
 * ░░░░░░░████░░░░████░░░░░░░ *
 * ░░░░░░░████░░░░████░░░░░░░ *
 * ░░░████░░░░████░░░░████░░░ *
 * ░░░████░░░░████░░░░████░░░ *
 * ░░░░░░░░░░░░░░░░░░░░░░░░░░ *
 *****************************/

pragma solidity ^0.8.6;

import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';
import { IMosaicsToken } from './interfaces/IMosaicsToken.sol';
import { ERC721 } from '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import { IERC721 } from '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import { ERC721URIStorage } from '@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol';

contract MosaicsToken is IMosaicsToken, Ownable, ERC721URIStorage {
    // The mosaics DAO address
    address public mosaicsDAO;

    // The Okami Labs address
    address public okamiLabs;

    // An address who has permissions to mint Mosaics
    address public minter;

    // Whether the minter can be updated
    bool public isMinterLocked;

    // IPFS content hash of the contract-level metadata
    string private _contractURIHash = 'QmX6FPXtrS7nPodsevxgucu2oPhNXKPnob7YESzZDKiRQ5';

    // IPFS hash of the default mosaic image, before the auction ends.
    string private _defaultMosaicURIHash = 'QmX6FPXtrS7nPodsevxgucu2oPhNXKPnob7YESzZDKiRQ5'; // TODO: Update this

    // IPFS hashes of the mosaic images, set by the owner after the auction ends.
    mapping(uint256 => string) public mosaics;

    // The internal mosaic ID tracker
    uint256 private _currentMosaicId;

    /**
     * @notice Require that the minter has not been locked.
     */
    modifier whenMinterNotLocked() {
        require(!isMinterLocked, 'MosaicsToken: Minter is locked');
        _;
    }

    /**
     * @notice Require that the sender is the Mosaics DAO.
     */
    modifier onlyMosaicsDAO() {
        require(msg.sender == mosaicsDAO, 'MosaicsToken: Sender is not the Mosaics DAO');
        _;
    }

    modifier onlyOkamiLabs() {
        require(msg.sender == okamiLabs, 'MosaicsToken: Sender is not Okami Labs');
        _;
    }

    /**
     * @notice Require that the sender is the minter.
     */
    modifier onlyMinter() {
        require(msg.sender == minter, 'MosaicsToken: Sender is not the minter');
        _;
    }

    constructor(
        address _mosaicsDAO,
        address _minter,
        address _okamiLabs
    ) ERC721('Mosaics', 'MOSAIC') {
        mosaicsDAO = _mosaicsDAO;
        minter = _minter;
        okamiLabs = _okamiLabs;
    }

    /**
     * @notice The IPFS URI of the contract-level metadata.
     */
    function contractURI() public view returns (string memory) {
        return string(abi.encodePacked('ipfs://', _contractURIHash));
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
    function mint() public override onlyMinter returns (uint256) {
        return _mintTo(minter, _currentMosaicId++);
    }

    /**
     * @notice Burn the mosaicId token.
     * @dev Only callable by the minter.
     */
    function burn(uint256 mosaicId) public override onlyMinter {
        _burn(mosaicId);
        emit MosaicBurned(mosaicId);
    }

    /**
     * @notice A distinct Uniform Resource Identifier (URI) for a given asset.
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), 'MosaicsToken: URI query for non-existent token');
        return string(abi.encodePacked('ipfs://', mosaics[tokenId]));
    }

    /**
     * @notice Set the URI of a given mosaic.
     * @dev Only callable by the owner.
     */
    function setMosaicURIHash(uint256 tokenId, string memory mosaicURIHash) external onlyOkamiLabs {
        require(_exists(tokenId), 'MosaicsToken: This is a non-existent Mosaic token');
        mosaics[tokenId] = mosaicURIHash;
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

    /**
     * @notice Mint a Mosaic with `mosaicId` to the provided `to` address.
     */
    function _mintTo(address to, uint256 mosaicId) internal returns (uint256) {
        mosaics[mosaicId] = _defaultMosaicURIHash;

        _mint(to, mosaicId);
        emit MosaicCreated(mosaicId);

        return mosaicId;
    }
}

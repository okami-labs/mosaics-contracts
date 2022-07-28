/// SPDX-License-Identifier: GPL-3.0

/// @title The Mosaics ERC-721 Token

pragma solidity ^0.8.6;

import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';
import { IProxyRegistry } from './external/opensea/IProxyRegistry.sol';
import 'erc721a/contracts/extensions/ERC721ABurnable.sol';
import 'erc721a/contracts/IERC721A.sol';
import 'erc721a/contracts/ERC721A.sol';

contract MosaicsToken is ERC721ABurnable, Ownable {
    // The mosaics DAO address
    address public mosaicsDAO;

    // The Okami Labs address
    address public okamiLabs;

    // An address who has permissions to mint Mosaics
    address public minter;

    // Whether the minter can be updated
    bool public isMinterLocked;

    // The internal mosaic ID tracker
    uint256 private _currentMosaicId;

    // IPFS content hash of the contract-level metadata
    string private _contractURIHash = '0x';

    IProxyRegistry public immutable proxyRegistry;

    event MosaicCreated(uint256 indexed tokenId);

    event MosaicBurned(uint256 indexed tokenId);

    event MosaicsDAOUpdated(address mosaicsDAO);

    event MinterUpdated(address minter);

    event MinterLocked();

    modifier whenMinterNotLocked() {
        require(!isMinterLocked, 'Minter is locked');
        _;
    }

    modifier onlyMosaicsDAO() {
        require(msg.sender == mosaicsDAO, 'Sender is not the mosaics DAO');
        _;
    }

    modifier onlyMinter() {
        require(msg.sender == minter, 'Sender is not the minter');
        _;
    }

    constructor(
        address _mosaicsDAO,
        address _minter,
        address _okamiLabs,
        IProxyRegistry _proxyRegistry
    ) ERC721A('Mosaics', 'MOSAIC') {
        mosaicsDAO = _mosaicsDAO;
        okamiLabs = _okamiLabs;
        minter = _minter;
        proxyRegistry = _proxyRegistry;
    }

    function contractURI() public view returns (string memory) {
        return string(abi.encodePacked('ipfs://', _contractURIHash));
    }

    function setContractURIHash(string memory newContractURIHash) external onlyOwner {
        _contractURIHash = newContractURIHash;
    }

    function isApprovedForAll(address _owner, address _operator)
        public
        view
        override(IERC721A, ERC721A)
        returns (bool)
    {
        // whitelist proxy contract for easy trading
        if (proxyRegistry.proxies(_owner) == _operator) {
            return true;
        }

        return super.isApprovedForAll(_owner, _operator);
    }

    function mint() public onlyMinter returns (uint256) {
        _mint(minter, _currentMosaicId++);
        emit MosaicCreated(_currentMosaicId);

        return _currentMosaicId;
    }

    function burn(uint256 mosaicId) public override onlyMinter {
        _burn(mosaicId);
        emit MosaicBurned(mosaicId);
    }

    function tokenURI(uint256 tokenId) public view override(IERC721A, ERC721A) returns (string memory) {
        require(_exists(tokenId), 'MosaicsToken: URI query for nonexistent token');
        // TODO: implement token uri
        // return string(abi.encodePacked('ipfs://', _tokenURIHash(tokenId)));
        return '';
    }

    // dataURI required?

    function setMosaicsDAO(address _mosaicsDAO) external onlyMosaicsDAO {
        mosaicsDAO = _mosaicsDAO;

        emit MosaicsDAOUpdated(_mosaicsDAO);
    }

    function setMinter(address _minter) external onlyOwner whenMinterNotLocked {
        minter = _minter;

        emit MinterUpdated(_minter);
    }

    function lockMinter() external onlyOwner whenMinterNotLocked {
        isMinterLocked = true;

        emit MinterLocked();
    }
}

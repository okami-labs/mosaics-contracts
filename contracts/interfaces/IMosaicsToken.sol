/// SPDX-License-Identifier: GPL-3.0

/// @title Interface for MosaicsToken

/******************************
 * ░░░░░░░░░░░░░░░░░░░░░░░░░░ *
 * ░░░░░░░████░░░░████░░░░░░░ *
 * ░░░░░░░████░░░░████░░░░░░░ *
 * ░░░████░░░░████░░░░████░░░ *
 * ░░░████░░░░████░░░░████░░░ *
 * ░░░░░░░░░░░░░░░░░░░░░░░░░░ *
 *****************************/

pragma solidity ^0.8.6;

import { IERC721 } from '@openzeppelin/contracts/token/ERC721/IERC721.sol';

interface IMosaicsToken is IERC721 {
    event MosaicCreated(uint256 indexed tokenId);

    event MosaicBurned(uint256 indexed tokenId);

    event MosaicsDAOUpdated(address mosaicsDAO);

    event MinterUpdated(address minter);

    event MinterLocked();

    function mint() external returns (uint256);

    function burn(uint256 tokenId) external;

    function setMosaicsDAO(address mosaicsDAO) external;

    function setMinter(address minter) external;

    function lockMinter() external;
}

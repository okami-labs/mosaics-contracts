// SPDX-License-Identifier: GPL-3.0

/// @title The Mosaics Auction House Proxy Admin

/******************************
 * ░░░░░░░░░░░░░░░░░░░░░░░░░░ *
 * ░░░░░░░████░░░░████░░░░░░░ *
 * ░░░░░░░████░░░░████░░░░░░░ *
 * ░░░████░░░░████░░░░████░░░ *
 * ░░░████░░░░████░░░░████░░░ *
 * ░░░░░░░░░░░░░░░░░░░░░░░░░░ *
 *****************************/

pragma solidity ^0.8.6;

import { ProxyAdmin } from '@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol';

// prettier-ignore
contract MosaicsAuctionHouseProxyAdmin is ProxyAdmin {}

// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.6;

import { IMosaicsAuctionHouse } from '../interfaces/IMosaicsAuctionHouse.sol';

contract MaliciousBidder {
    function bid(IMosaicsAuctionHouse auctionHouse, uint256 tokenId) public payable {
        auctionHouse.createBid{ value: msg.value }(tokenId);
    }

    receive() external payable {
        assembly {
            invalid()
        }
    }
}

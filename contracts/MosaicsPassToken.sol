/// SPDX-License-Identifier: GPL-3.0

/// @title The Mosaics Pass ERC-721A Token

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
import { ReentrancyGuard } from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import 'erc721a/contracts/IERC721A.sol';
import 'erc721a/contracts/ERC721A.sol';

contract MosaicsPassToken is Ownable, ERC721A, ReentrancyGuard {
    struct SaleConfig {
        uint32 publicSaleStartTime;
        uint64 publicPrice;
        uint32 publicSaleBatchSize;
        uint32 allowListStartTime;
        uint64 allowListPrice;
    }

    // Configuration for sale price and start
    SaleConfig public saleConfig;

    // The mapping of address to number of mints allowed
    mapping(address => uint256) public allowList;

    // The Okami Labs address
    address public okamiLabs;

    // The supply reserved for Okami team
    uint32 private amountForOkami;

    // Flag when Okami has minted
    bool private okamiMinted;

    // The maximum supply that can be minted
    uint256 public maxSupply;

    // IPFS content hash of the contract-level metadata
    string private _contractURI = '';

    // Base URI for the Mosaics Pass Token
    string private _mosaicsPassBaseURI = '';

    constructor(
        uint256 _maxSupply,
        uint32 _amountForOkami,
        address _okamiLabs
    ) ERC721A('Mosaics Access Pass', 'MAP') {
        maxSupply = _maxSupply;
        amountForOkami = _amountForOkami;
        okamiLabs = _okamiLabs;
        require(amountForOkami <= maxSupply, 'MosaicsPassToken: Amount exceeds max supply.');
    }

    ///// Minting Functions

    /**
     * @notice Mint a Mosaics Pass for the allow list sale.
     */
    function allowListMint(uint32 quantity) external payable callerIsUser {
        SaleConfig memory config = saleConfig;
        uint256 allowlistPrice = uint256(config.allowListPrice);
        uint256 allowListStartTime = uint256(config.allowListStartTime);

        require(saleStarted(allowListStartTime), 'MosaicsPassToken: Allowlist sale has not started yet.');
        require(allowList[msg.sender] > 0, 'MosaicsPassToken: Not eligible for allowlist mint.');
        require(allowList[msg.sender] - quantity >= 0, 'MosaicsPassToken: Quantity exceeds allowed mints.');
        require(totalSupply() + quantity <= maxSupply, 'MosaicsPassToken: Minting would exceed max supply.');

        allowList[msg.sender] -= quantity;

        _mint(msg.sender, quantity);

        refundIfOver(allowlistPrice * quantity);
    }

    /**
     * @notice Mint a Mosaics Pass for the public sale.
     * @dev Caller cannot be a contract.
     */
    function publicSaleMint(uint32 quantity) external payable callerIsUser {
        SaleConfig memory config = saleConfig;
        uint256 publicPrice = uint256(config.publicPrice);
        uint256 publicSaleStartTime = uint256(config.publicSaleStartTime);
        uint256 publicSaleBatchSize = uint32(config.publicSaleBatchSize);

        require(saleStarted(publicSaleStartTime), 'MosaicsPassToken: Public Sale has not started yet.');
        require(quantity <= publicSaleBatchSize, 'MosaicsPassToken: Quantity would exceed public sale batch size.');
        require(totalSupply() + quantity <= maxSupply, 'MosaicsPassToken: Minting would exceed max supply.');

        _safeMint(msg.sender, quantity);

        refundIfOver(publicPrice * quantity);
    }

    /**
     * @notice Mints the supply of Mosaic Passes reserved for Okami.
     * @dev Only callable by the owner.
     */
    function okamiMint() external {
        require(msg.sender == okamiLabs, 'MosaicsPassToken: Only Okami Labs can mint.');
        require(!okamiMinted, 'MosaicsPassToken: Okami has already minted.');
        require(totalSupply() + amountForOkami <= maxSupply, 'MosaicsPassToken: Minting would exceed max supply.');
        _safeMint(msg.sender, amountForOkami);
        okamiMinted = true;
    }

    ///// Metadata Functions

    /**
     * @notice Return the Mosaic Pass base URI.
     */
    function _baseURI() internal view virtual override(ERC721A) returns (string memory) {
        return _mosaicsPassBaseURI;
    }

    /**
     * @notice Set the Mosaics Pass base URI.
     * @dev Only callable by the owner.
     */
    function setBaseURI(string calldata baseTokenURI) external onlyOwner {
        _mosaicsPassBaseURI = baseTokenURI;
    }

    /**
     * @notice The IPFS URI of the contract-level metadata.
     */
    function contractURI() public view returns (string memory) {
        return _contractURI;
    }

    /**
     * @notice Set the _contractURI.
     * @dev Only callable by the owner.
     */
    function setContractURI(string memory contractURI_) external onlyOwner {
        _contractURI = contractURI_;
    }

    ///// Sale Functions

    /**
     * @notice Set the sales config.
     * @dev Only callable by the owner.
     */
    function setSaleConfig(
        uint32 publicSaleStartTime,
        uint64 publicPrice,
        uint32 publicSaleBatchSize,
        uint32 allowListStartTime,
        uint64 allowListPrice
    ) external onlyOwner {
        saleConfig = SaleConfig(
            publicSaleStartTime,
            publicPrice,
            publicSaleBatchSize,
            allowListStartTime,
            allowListPrice
        );
    }

    ///// Misc. Functions

    /**
     * @notice Withdraw all funds from the contract.
     * @dev Only callable by the owner.
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 _balance = address(this).balance;
        require(_balance > 0, 'MosaicsPassToken: No balance.');

        (bool success, ) = payable(okamiLabs).call{ value: _balance }('');
        require(success, 'MosaicsPassToken: Withdraw failed.');
    }

    /**
     * @notice Refunds the sender if they overpaid.
     * @dev Sender must have sent enough ETH.
     */
    function refundIfOver(uint256 price) private {
        require(msg.value >= price, 'MosaicsPassToken: Not enough ETH sent.');

        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
    }

    /**
     * @notice Check if the current block is after the start time.
     */
    function saleStarted(uint256 startTime) internal view returns (bool) {
        return startTime > 0 && block.timestamp >= startTime;
    }

    /**
     * @notice Set the allowList address and number of mints allowed for each address.
     * @dev Only callable by the owner. Addresses and number of mints allowed must be the same length.
     */
    function setAllowList(address[] memory addresses, uint32[] memory mintsAllowed) external onlyOwner {
        require(
            addresses.length == mintsAllowed.length,
            'MosaicsPassToken: Number of addresses does not match mints allowed.'
        );

        for (uint256 i = 0; i < addresses.length; i++) {
            allowList[addresses[i]] = mintsAllowed[i];
        }
    }

    /**
     * @notice Require that the caller is not a contract.
     */
    modifier callerIsUser() {
        require(tx.origin == msg.sender, 'MosaicsPassToken: The caller is a contract.');
        _;
    }
}

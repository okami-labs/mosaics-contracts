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
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import 'erc721a/contracts/IERC721A.sol';
import 'erc721a/contracts/ERC721A.sol';

contract MosaicsPassToken is Ownable, ERC721A, ReentrancyGuard {
    struct SaleConfig {
        bool publicSaleEnabled;
        bool privateSaleEnabled;
        uint64 premiumPassSalePrice;
        uint32 batchSize;
    }

    // Configuration for sale price and start
    SaleConfig public saleConfig;

    // addresses that minted premium
    mapping(address => uint32) public premiumMinters;

    // Merkle root for allow list
    bytes32 public allowListMerkleRoot;

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
        address _okamiLabs,
        bytes32 _allowListMerkleRoot
    ) ERC721A('Mosaics Access Pass', 'MAP') {
        maxSupply = _maxSupply;
        amountForOkami = _amountForOkami;
        okamiLabs = _okamiLabs;
        allowListMerkleRoot = _allowListMerkleRoot;
        require(amountForOkami <= maxSupply, 'MosaicsPassToken: Amount exceeds max supply.');
    }

    event PremiumPassMinted(address indexed minter, uint32 quantity);
    event FreePassMinted(address indexed minter, uint32 quantity);

    ///// Minting Functions

    /**
     * @dev Mints a batch of tokens to the caller.
     * Caller can only mint one per transaction.
     * There is no benefit to owning more than one free pass.
     */
    function mintFreePass() internal {
        require(totalSupply() + 1 <= maxSupply, 'MosaicsPassToken: Minting would exceed max supply.');
        _safeMint(msg.sender, 1);
        emit FreePassMinted(msg.sender, 1);
    }

    /**
     * @dev Mints a premium pass to the caller.
     */
    function mintPremiumPass(uint32 quantity) internal {
        SaleConfig memory config = saleConfig;
        uint256 salePrice = uint256(config.premiumPassSalePrice);
        uint32 batchSize = uint32(config.batchSize);
        require(quantity <= batchSize, 'MosaicsPassToken: Quantity exceeds allowed mints.');
        require(totalSupply() + quantity <= maxSupply, 'MosaicsPassToken: Minting would exceed max supply.');
        require(premiumMinters[msg.sender] + quantity <= batchSize, 'MosaicsPassToken: Exceeds max mints per address.');
        premiumMinters[msg.sender] += quantity;
        _mint(msg.sender, quantity);
        refundIfOver(salePrice * quantity);
        emit PremiumPassMinted(msg.sender, quantity);
    }

    /**
     * @notice Mint a premium Mosaics Pass for the public sale.
     */
    function mintPremiumPassPublic(uint32 quantity) external payable callerIsUser {
        SaleConfig memory config = saleConfig;
        bool publicSaleEnabled = bool(config.publicSaleEnabled);
        require(publicSaleEnabled, 'MosaicsPassToken: Public sale has not started yet.');
        mintPremiumPass(quantity);
    }

    /**
     * @notice Mint a premium Mosaics Pass for the private sale.
     */
    function mintPremiumPassPrivate(uint32 quantity, bytes32[] calldata proof) external payable callerIsUser {
        SaleConfig memory config = saleConfig;
        bool privateSaleEnabled = bool(config.privateSaleEnabled);
        require(privateSaleEnabled, 'MosaicsPassToken: Allowlist sale has not started yet.');
        require(isAllowlisted(proof), 'MosaicsPassToken: Not eligible for allowlist mint.');
        mintPremiumPass(quantity);
    }

    /**
     * @notice Mint a free Mosaics Pass for the public sale.
     */
    function mintFreePassPublic() external callerIsUser {
        SaleConfig memory config = saleConfig;
        bool publicSaleEnabled = bool(config.publicSaleEnabled);
        require(publicSaleEnabled, 'MosaicsPassToken: Public Sale has not started yet.');
        mintFreePass();
    }
    
    /**
     * @notice Mint a free Mosaics Pass for the private sale.
     * Minting a free pass does not prevent the user from minting a premium pass.
     */
    function mintFreePassPrivate(bytes32[] calldata proof) external callerIsUser {
        SaleConfig memory config = saleConfig;
        bool privateSaleEnabled = bool(config.privateSaleEnabled);
        require(privateSaleEnabled, 'MosaicsPassToken: AllowList Sale has not started yet.');
        require(isAllowlisted(proof), 'MosaicsPassToken: Not eligible for allowlist mint.');
        mintFreePass();
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
        bool publicSaleEnabled,
        bool privateSaleEnabled,
        uint64 premiumPassSalePrice,
        uint32 batchSize
    ) external onlyOwner {
        saleConfig = SaleConfig(
            publicSaleEnabled,
            privateSaleEnabled,
            premiumPassSalePrice,
            batchSize
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
     * @notice Require that the caller is in the allowList.
     */
    function isAllowlisted(bytes32[] calldata proof) public view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        return MerkleProof.verify(proof, allowListMerkleRoot, leaf);
    }

    /**
     * @notice Set the allowListMerkleRoot.
     * @dev Only callable by the owner.
     */
    function updateAllowList(bytes32 newRoot) external onlyOwner {
        allowListMerkleRoot = newRoot;
    }

    /**
     * @notice Require that the caller is not a contract.
     */
    modifier callerIsUser() {
        require(tx.origin == msg.sender, 'MosaicsPassToken: The caller is a contract.');
        _;
    }
}

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
        uint32 maxMintsPerAddress;
    }

    // Configuration for sale price and start
    SaleConfig public saleConfig;

    // addresses that minted premium
    mapping(address => uint32) public premiumMinters;

    // addresses that minted free
    mapping(address => uint32) public freeMinters;

    // Merkle root for allow list
    bytes32 public allowListMerkleRoot;

    // The Okami Labs address
    address public okamiLabs;

    // The maximum supply of premium passes that can be minted
    uint256 public maxSupplyPremium;

    // The number of free passes that have been minted so far
    uint256 public totalPremiumMinted;

    // IPFS content hash of the contract-level metadata
    string private _contractURI = '';

    // Base URI for the Mosaics Pass Token
    string private _mosaicsPassBaseURI = '';

    bool public freezeMinting;

    constructor(
        uint256 _maxSupplyPremium,
        address _okamiLabs
    ) ERC721A('Mosaics Access Pass', 'MAP') {
        maxSupplyPremium = _maxSupplyPremium;
        okamiLabs = _okamiLabs;
    }

    /**
     * @dev Used on the mosaics backend to set premium tier metadata
     */
    event PremiumPassMinted(address to, uint256 startTokenId, uint32 quantity);

    /**
     * @dev Used on the backend to set free tier metadata
     */
    event FreePassMinted(address to, uint256 tokenId);

    /*********************************************
     *            MINTING FUNCTIONS              *
     *********************************************/

    /**
     * @notice Mint a free pass to the caller
     * @dev Can only mint one free pass per address
     */
    function mintFreePass() internal {
        uint256 nextTokenId = _nextTokenId();
        require(freeMinters[msg.sender] == 0, 'MosaicsPassToken: Only one free pass per address.');
        freeMinters[msg.sender] = 1;
        _safeMint(msg.sender, 1);
        emit FreePassMinted(msg.sender, nextTokenId);
    }

    /**
     * @notice Mint a premium pass to the caller
     * @dev Can only mint one free pass per address
     */
    function mintPremiumPass(uint32 quantity) internal {
        SaleConfig memory config = saleConfig;
        uint256 salePrice = uint256(config.premiumPassSalePrice);
        uint32 maxMintsPerAddress = uint32(config.maxMintsPerAddress);
        uint256 nextTokenId = _nextTokenId();

        require(quantity <= maxMintsPerAddress, 'MosaicsPassToken: Quantity exceeds allowed mints.');
        require(totalPremiumMinted + quantity <= maxSupplyPremium, 'MosaicsPassToken: Minting would exceed max supply.');
        require(premiumMinters[msg.sender] + quantity <= maxMintsPerAddress, 'MosaicsPassToken: Exceeds max mints per address.');
       
        premiumMinters[msg.sender] += quantity;
        _mint(msg.sender, quantity);
        refundIfOver(salePrice * quantity);
       
        emit PremiumPassMinted(msg.sender, nextTokenId, quantity);
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
     * @notice Mints the supply of Mosaic Passes reserved for the Okami Labs team.
     * @dev Only callable by the owner.
     */
    function teamMint(address to, uint32 quantity) external onlyOwner {
        require(totalPremiumMinted + quantity <= maxSupplyPremium, 'MosaicsPassToken: Minting would exceed max supply.');
        uint256 nextTokenId = _nextTokenId();
        _safeMint(to, quantity);
        emit PremiumPassMinted(to, nextTokenId, quantity);
    }

    /*********************************************
     *            METADATA FUNCTIONS             *
     *********************************************/

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

    /*********************************************
     *              SALE FUNCTIONS               *
     *********************************************/

    /**
     * @notice Set the sales config.
     * @dev Only callable by the owner.
     */
    function setSaleConfig(
        bool publicSaleEnabled,
        bool privateSaleEnabled,
        uint64 premiumPassSalePrice,
        uint32 maxMintsPerAddress
    ) external onlyOwner {
        require(freezeMinting == false, 'MosaicsPassToken: Sale config is frozen.');

        saleConfig = SaleConfig(
            publicSaleEnabled,
            privateSaleEnabled,
            premiumPassSalePrice,
            maxMintsPerAddress
        );
    }

    /**
     * @notice Freeze the sale config, and disables minting.
     * @dev Only callable by the owner. This should only be called
     * after the sale has ended.
     */
    function freezeSaleConfig() external onlyOwner {
        freezeMinting = true;
        saleConfig = SaleConfig(false, false, 0, 0);
    }

    /*********************************************
     *              MISC. FUNCTIONS              *
     *********************************************/

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

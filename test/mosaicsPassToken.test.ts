import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as EthersBN, utils } from 'ethers';
import { ethers } from 'hardhat';
import keccak256 from 'keccak256';
import { MerkleTree } from 'merkletreejs';
import { MosaicsPassToken } from '../typechain';
import { deployMosaicsPassToken } from './utils';

chai.use(solidity);
const { expect } = chai;

describe('MosaicsPassToken', () => {
  let mosaicsPassToken: MosaicsPassToken;
  let deployer: SignerWithAddress;
  let okamiLabs: SignerWithAddress;
  let testMinter: SignerWithAddress;
  let fakeMinter: SignerWithAddress;
  let snapshotId: number;

  before(async () => {
    [deployer, okamiLabs, testMinter, fakeMinter] = await ethers.getSigners();
    let allowlist = [
      testMinter.address,
    ];
  
    mosaicsPassToken = await deployMosaicsPassToken(deployer, 51, 50, okamiLabs);
  });

  beforeEach(async () => {
    snapshotId = await ethers.provider.send('evm_snapshot', []);
  });

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [snapshotId]);
  });

  it('should set symbol', async () => {
    expect(await mosaicsPassToken.symbol()).to.eq('MAP');
  });

  it('should set name', async () => {
    expect(await mosaicsPassToken.name()).to.eq('Mosaics Access Pass');
  });

  it('should set sale config', async () => {
    const saleConfig = {
      publicSaleEnabled: false,
      privateSaleEnabled: false,
      premiumPassSalePrice: utils.parseEther('0.02'),
      batchSize: EthersBN.from(3),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleEnabled,
      saleConfig.privateSaleEnabled,
      saleConfig.premiumPassSalePrice,
      saleConfig.batchSize,
    );

    const actualSaleConfig = await mosaicsPassToken.saleConfig();
    expect(actualSaleConfig.publicSaleEnabled).to.eq(saleConfig.publicSaleEnabled);
    expect(actualSaleConfig.privateSaleEnabled).to.eq(saleConfig.privateSaleEnabled);
    expect(actualSaleConfig.premiumPassSalePrice).to.eq(saleConfig.premiumPassSalePrice);
    expect(actualSaleConfig.batchSize).to.eq(saleConfig.batchSize);
  });

  it('should set baseURI', async () => {
    const testBaseURI = 'test_base_uri';
    await mosaicsPassToken.setBaseURI(testBaseURI);
  });

  it('should set allowlist', async () => {
    let allowlist = [testMinter.address];
    let leaves = allowlist.map((address) => keccak256(address));
    let merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    let merkleRoot = merkleTree.getHexRoot();
    let proof = merkleTree.getProof(leaves[0]).map((x) => x.data.toString('hex'))
    await mosaicsPassToken.updateAllowList(merkleRoot);

    const isAllowlisted = await mosaicsPassToken.connect(testMinter).isAllowlisted(proof);
    expect(isAllowlisted).to.eq(true);

    let fakeAllowlist = [fakeMinter.address];
    let fakeLeaves = fakeAllowlist.map((address) => keccak256(address));
    let fakeMerkleTree = new MerkleTree(fakeLeaves, keccak256, { sortPairs: true });
    let fakeProof = fakeMerkleTree.getProof(fakeLeaves[0]).map((x) => x.data.toString('hex'))

    const isFakeAllowlisted = await mosaicsPassToken.connect(fakeMinter).isAllowlisted(fakeProof);
    expect(isFakeAllowlisted).to.eq(false);
  });

  it('should mint from allowlist', async () => {
    const saleConfig = {
      publicSaleEnabled: false,
      privateSaleEnabled: true,
      premiumPassSalePrice: utils.parseEther('0.02'),
      batchSize: EthersBN.from(3),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleEnabled,
      saleConfig.privateSaleEnabled,
      saleConfig.premiumPassSalePrice,
      saleConfig.batchSize,
    );

    let allowlist = [testMinter.address];
    let leaves = allowlist.map((address) => keccak256(address));
    let merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    let merkleRoot = merkleTree.getHexRoot();
    let proof = merkleTree.getProof(leaves[0]).map((x) => x.data.toString('hex'))
    await mosaicsPassToken.updateAllowList(merkleRoot);

    await mosaicsPassToken
      .connect(testMinter)
      .mintPremiumPassPrivate(3, proof, { value: ethers.utils.parseEther('0.02').mul(3) });

    let balance = await mosaicsPassToken.balanceOf(testMinter.address);
    expect(balance).to.eq(3);

    await mosaicsPassToken
    .connect(testMinter)
    .mintFreePassPrivate(proof);

    balance = await mosaicsPassToken.balanceOf(testMinter.address);
    expect(balance).to.eq(4);
  });

  it('should mint to okami', async () => {
    await mosaicsPassToken.connect(okamiLabs).okamiMint();

    const balance = await mosaicsPassToken.balanceOf(okamiLabs.address);

    expect(balance).to.eq(50);

    // try to mint again
    await expect(mosaicsPassToken.connect(okamiLabs).okamiMint()).to.be.revertedWith(
      'MosaicsPassToken: Okami has already minted.',
    );
  });

  it('should not mint okami if not okami address', async () => {
    await expect(mosaicsPassToken.okamiMint()).to.be.revertedWith(
      'MosaicsPassToken: Only Okami Labs can mint.',
    );
  });

  it('should mint from public sale', async () => {
    const saleConfig = {
      publicSaleEnabled: true,
      privateSaleEnabled: false,
      premiumPassSalePrice: utils.parseEther('0.02'),
      batchSize: EthersBN.from(3),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleEnabled,
      saleConfig.privateSaleEnabled,
      saleConfig.premiumPassSalePrice,
      saleConfig.batchSize,
    );

    await mosaicsPassToken
      .connect(testMinter)
      .mintPremiumPassPublic(1, { value: ethers.utils.parseEther('0.02') });

    let balance = await mosaicsPassToken.balanceOf(testMinter.address);
    expect(balance).to.eq(1);

    await mosaicsPassToken
      .connect(testMinter)
      .mintFreePassPublic();

    balance = await mosaicsPassToken.balanceOf(testMinter.address);
    expect(balance).to.eq(2);
  });

  it('should not mint before public sale has started', async () => {
    const saleConfig = {
      publicSaleEnabled: false,
      privateSaleEnabled: false,
      premiumPassSalePrice: utils.parseEther('0.02'),
      batchSize: EthersBN.from(3),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleEnabled,
      saleConfig.privateSaleEnabled,
      saleConfig.premiumPassSalePrice,
      saleConfig.batchSize,
    );

    await expect(
      mosaicsPassToken
        .connect(testMinter)
        .mintFreePassPublic(),
    ).to.be.revertedWith('MosaicsPassToken: Public Sale has not started yet.');
  });

  it('should not mint before allowlist sale has started', async () => {
    const saleConfig = {
      publicSaleEnabled: false,
      privateSaleEnabled: false,
      premiumPassSalePrice: utils.parseEther('0.02'),
      batchSize: EthersBN.from(3),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleEnabled,
      saleConfig.privateSaleEnabled,
      saleConfig.premiumPassSalePrice,
      saleConfig.batchSize,
    );

    let allowlist = [testMinter.address];
    let leaves = allowlist.map((address) => keccak256(address));
    let merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    let merkleRoot = merkleTree.getHexRoot();

    await mosaicsPassToken.updateAllowList(merkleRoot);
 
    let proof = merkleTree.getProof(leaves[0]).map((x) => x.data.toString('hex'))

    await expect(
      mosaicsPassToken
        .connect(testMinter)
        .mintFreePassPrivate(proof),
    ).to.be.revertedWith('MosaicsPassToken: AllowList Sale has not started yet.');
  });

  it('should revert if not enough eth sent', async () => {
    const saleConfig = {
      publicSaleEnabled: true,
      privateSaleEnabled: false,
      premiumPassSalePrice: utils.parseEther('0.02'),
      batchSize: EthersBN.from(3),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleEnabled,
      saleConfig.privateSaleEnabled,
      saleConfig.premiumPassSalePrice,
      saleConfig.batchSize,
    );

    await expect(
      mosaicsPassToken
        .connect(testMinter)
        .mintPremiumPassPublic(3, { value: ethers.utils.parseEther('0.02') }),
    ).to.be.revertedWith('MosaicsPassToken: Not enough ETH sent.');
  });

  it('should revert if not enough supply', async () => {
    const saleConfig = {
      publicSaleEnabled: true,
      privateSaleEnabled: false,
      premiumPassSalePrice: utils.parseEther('0.02'),
      batchSize: EthersBN.from(3),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleEnabled,
      saleConfig.privateSaleEnabled,
      saleConfig.premiumPassSalePrice,
      saleConfig.batchSize,
    );

    // mint okami first, 50 supply, then try to mint 3
    await mosaicsPassToken.connect(okamiLabs).okamiMint();

    await expect(
      mosaicsPassToken
        .connect(testMinter)
        .mintPremiumPassPublic(3, { value: ethers.utils.parseEther('0.02').mul(3) }),
    ).to.be.revertedWith('MosaicsPassToken: Minting would exceed max supply.');

    // this should be fine, setting supply to 51, the next mint would fail
    await mosaicsPassToken.connect(testMinter).mintFreePassPublic()
    
    await expect(
      mosaicsPassToken
        .connect(testMinter)
        .mintFreePassPublic(),
    ).to.be.revertedWith('MosaicsPassToken: Minting would exceed max supply.');
  });

  describe('contractURI', async () => {
    it('should return correct contractURI', async () => {
      expect(await mosaicsPassToken.contractURI()).to.eq('');
    });
    it('should allow owner to set contractURI', async () => {
      await mosaicsPassToken.setContractURI('ABC123');
      expect(await mosaicsPassToken.contractURI()).to.eq('ABC123');
    });
    it('should not allow non owner to set contractURI', async () => {
      const [, nonOwner] = await ethers.getSigners();
      await expect(mosaicsPassToken.connect(nonOwner).setContractURI('BAD')).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });
});

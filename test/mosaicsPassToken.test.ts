import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as EthersBN, constants } from 'ethers';
import { ethers } from 'hardhat';
import { MosaicsPassToken } from '../typechain';
import { deployMosaicsPassToken } from './utils';

chai.use(solidity);
const { expect } = chai;

describe('MosaicsPassToken', () => {
  let mosaicsPassToken: MosaicsPassToken;
  let deployer: SignerWithAddress;
  let okamiLabs: SignerWithAddress;
  let testMinter: SignerWithAddress;
  let snapshotId: number;

  before(async () => {
    [deployer, okamiLabs, testMinter] = await ethers.getSigners();
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
      publicSaleStartTime: constants.Zero,
      publicPrice: EthersBN.from(1),
      publicSaleBatchSize: EthersBN.from(1),
      allowListStartTime: constants.Zero,
      allowListPrice: EthersBN.from(1),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleStartTime,
      saleConfig.publicPrice,
      saleConfig.publicSaleBatchSize,
      saleConfig.allowListStartTime,
      saleConfig.allowListPrice,
    );

    const actualSaleConfig = await mosaicsPassToken.saleConfig();
    expect(actualSaleConfig.publicSaleStartTime).to.eq(saleConfig.publicSaleStartTime);
    expect(actualSaleConfig.publicPrice).to.eq(saleConfig.publicPrice);
    expect(actualSaleConfig.publicSaleBatchSize).to.eq(saleConfig.publicSaleBatchSize);
    expect(actualSaleConfig.allowListStartTime).to.eq(saleConfig.allowListStartTime);
    expect(actualSaleConfig.allowListPrice).to.eq(saleConfig.allowListPrice);
  });

  // it("should be able to withdraw", async () => {

  // });

  it('should set baseURI', async () => {
    const testBaseURI = 'test_base_uri';
    await mosaicsPassToken.setBaseURI(testBaseURI);
  });

  it('should set allowlist', async () => {
    const testAllowList = [testMinter.address];

    const testMintsAllowed = [3];

    await mosaicsPassToken.setAllowList(testAllowList, testMintsAllowed);

    const numMints = await mosaicsPassToken.allowList(testMinter.address);
    expect(numMints).to.eq(testMintsAllowed[0]);
  });

  it('should mint from allowlist', async () => {
    const startTime = Math.floor(Date.now() / 1000) - 10000;
    const saleConfig = {
      publicSaleStartTime: startTime, // convert to seconds
      publicPrice: ethers.utils.parseEther('0.1'),
      publicSaleBatchSize: 1,
      allowListStartTime: startTime, // convert to seconds
      allowListPrice: ethers.utils.parseEther('0.1'),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleStartTime,
      saleConfig.publicPrice,
      saleConfig.publicSaleBatchSize,
      saleConfig.allowListStartTime,
      saleConfig.allowListPrice,
    );

    const testAllowList = [testMinter.address];
    const testAllowListMintsAllowed = [3];
    await mosaicsPassToken.setAllowList(testAllowList, testAllowListMintsAllowed);

    await mosaicsPassToken
      .connect(testMinter)
      .allowListMint(3, { value: ethers.utils.parseEther('0.3') });

    const balance = await mosaicsPassToken.balanceOf(testMinter.address);
    expect(balance).to.eq(3);
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

  it('should not mint if not on allowlist', async () => {
    const startTime = Math.floor(Date.now() / 1000) - 10000;
    const saleConfig = {
      publicSaleStartTime: startTime, // convert to seconds
      publicPrice: ethers.utils.parseEther('0.1'),
      publicSaleBatchSize: 1,
      allowListStartTime: startTime, // convert to seconds
      allowListPrice: ethers.utils.parseEther('0.1'),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleStartTime,
      saleConfig.publicPrice,
      saleConfig.publicSaleBatchSize,
      saleConfig.allowListStartTime,
      saleConfig.allowListPrice,
    );

    await expect(
      mosaicsPassToken.allowListMint(3, { value: ethers.utils.parseEther('0.3') }),
    ).to.be.revertedWith('MosaicsPassToken: Not eligible for allowlist mint.');
  });

  it('should mint from public sale', async () => {
    const startTime = Math.floor(Date.now() / 1000) - 10000;
    const saleConfig = {
      publicSaleStartTime: startTime, // convert to seconds
      publicPrice: ethers.utils.parseEther('0.1'),
      publicSaleBatchSize: 1,
      allowListStartTime: startTime, // convert to seconds
      allowListPrice: ethers.utils.parseEther('0.1'),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleStartTime,
      saleConfig.publicPrice,
      saleConfig.publicSaleBatchSize,
      saleConfig.allowListStartTime,
      saleConfig.allowListPrice,
    );

    await mosaicsPassToken
      .connect(testMinter)
      .publicSaleMint(1, { value: ethers.utils.parseEther('0.1') });

    const balance = await mosaicsPassToken.balanceOf(testMinter.address);
    expect(balance).to.eq(1);
  });

  it('should not mint before public sale has started', async () => {
    const startTime = Math.floor(Date.now() / 1000) + 10000;
    const saleConfig = {
      publicSaleStartTime: startTime, // convert to seconds
      publicPrice: ethers.utils.parseEther('0.1'),
      publicSaleBatchSize: 1,
      allowListStartTime: startTime, // convert to seconds
      allowListPrice: ethers.utils.parseEther('0.1'),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleStartTime,
      saleConfig.publicPrice,
      saleConfig.publicSaleBatchSize,
      saleConfig.allowListStartTime,
      saleConfig.allowListPrice,
    );

    await expect(
      mosaicsPassToken
        .connect(testMinter)
        .publicSaleMint(1, { value: ethers.utils.parseEther('0.1') }),
    ).to.be.revertedWith('MosaicsPassToken: Public Sale has not started yet.');
  });

  it('should not mint before allowlist sale has started', async () => {
    const startTime = Math.floor(Date.now() / 1000) + 10000;
    const saleConfig = {
      publicSaleStartTime: startTime, // convert to seconds
      publicPrice: ethers.utils.parseEther('0.1'),
      publicSaleBatchSize: 1,
      allowListStartTime: startTime, // convert to seconds
      allowListPrice: ethers.utils.parseEther('0.1'),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleStartTime,
      saleConfig.publicPrice,
      saleConfig.publicSaleBatchSize,
      saleConfig.allowListStartTime,
      saleConfig.allowListPrice,
    );

    const allowList = [testMinter.address];
    const allowListMintsAllowed = [3];
    await mosaicsPassToken.setAllowList(allowList, allowListMintsAllowed);

    await expect(
      mosaicsPassToken
        .connect(testMinter)
        .allowListMint(3, { value: ethers.utils.parseEther('0.3') }),
    ).to.be.revertedWith('MosaicsPassToken: Allowlist sale has not started yet.');
  });

  it('should revert if not enough eth sent', async () => {
    const startTime = Math.floor(Date.now() / 1000) - 10000;
    const saleConfig = {
      publicSaleStartTime: startTime, // convert to seconds
      publicPrice: ethers.utils.parseEther('0.1'),
      publicSaleBatchSize: 1,
      allowListStartTime: startTime, // convert to seconds
      allowListPrice: ethers.utils.parseEther('0.1'),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleStartTime,
      saleConfig.publicPrice,
      saleConfig.publicSaleBatchSize,
      saleConfig.allowListStartTime,
      saleConfig.allowListPrice,
    );

    const allowList = [testMinter.address];
    const allowListMintsAllowed = [3];
    await mosaicsPassToken.setAllowList(allowList, allowListMintsAllowed);

    await expect(
      mosaicsPassToken
        .connect(testMinter)
        .allowListMint(3, { value: ethers.utils.parseEther('0.2') }),
    ).to.be.revertedWith('MosaicsPassToken: Not enough ETH sent.');
  });

  it('should mint if price is 0', async () => {
    const startTime = Math.floor(Date.now() / 1000) - 10000;
    const saleConfig = {
      publicSaleStartTime: startTime, // convert to seconds
      publicPrice: 0,
      publicSaleBatchSize: 1,
      allowListStartTime: startTime, // convert to seconds
      allowListPrice: ethers.utils.parseEther('0.1'),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleStartTime,
      saleConfig.publicPrice,
      saleConfig.publicSaleBatchSize,
      saleConfig.allowListStartTime,
      saleConfig.allowListPrice,
    );

    await mosaicsPassToken
      .connect(testMinter)
      .publicSaleMint(1, { value: ethers.utils.parseEther('0') });
  });

  it('should revert if not enough supply', async () => {
    const startTime = Math.floor(Date.now() / 1000) - 10000;
    const saleConfig = {
      publicSaleStartTime: startTime, // convert to seconds
      publicPrice: 0,
      publicSaleBatchSize: 3,
      allowListStartTime: startTime, // convert to seconds
      allowListPrice: ethers.utils.parseEther('0.1'),
    };

    await mosaicsPassToken.setSaleConfig(
      saleConfig.publicSaleStartTime,
      saleConfig.publicPrice,
      saleConfig.publicSaleBatchSize,
      saleConfig.allowListStartTime,
      saleConfig.allowListPrice,
    );

    // mint okami first, 50 supply, then try to mint 3
    await mosaicsPassToken.connect(okamiLabs).okamiMint();

    const allowList = [testMinter.address];
    const allowListMintsAllowed = [3];
    await mosaicsPassToken.setAllowList(allowList, allowListMintsAllowed);

    await expect(
      mosaicsPassToken
        .connect(testMinter)
        .allowListMint(3, { value: ethers.utils.parseEther('0.3') }),
    ).to.be.revertedWith('MosaicsPassToken: Minting would exceed max supply.');

    await expect(
      mosaicsPassToken
        .connect(testMinter)
        .publicSaleMint(3, { value: ethers.utils.parseEther('0.3') }),
    ).to.be.revertedWith('MosaicsPassToken: Minting would exceed max supply.');
  });

  describe('contractURI', async () => {
    it('should return correct contractURI', async () => {
      expect(await mosaicsPassToken.contractURI()).to.eq(
        '',
      );
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

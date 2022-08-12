import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { ethers } from 'hardhat';
import { MosaicsToken } from '../typechain';
import { deployMosaicsToken } from './utils';

chai.use(solidity);
const { expect } = chai;

describe('MosaicsPassToken', () => {
  let mosaicsToken: MosaicsToken;
  let deployer: SignerWithAddress;
  let mosaicsDAO: SignerWithAddress;
  let auctionHouse: SignerWithAddress;
  let okamiLabs: SignerWithAddress;
  let snapshotId: number;

  before(async () => {
    [deployer, mosaicsDAO, auctionHouse, okamiLabs] = await ethers.getSigners();
    mosaicsToken = await deployMosaicsToken(
      deployer,
      mosaicsDAO.address,
      auctionHouse.address,
      okamiLabs.address,
    );
  });

  beforeEach(async () => {
    snapshotId = await ethers.provider.send('evm_snapshot', []);
  });

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [snapshotId]);
  });

  it('should set symbol', async () => {
    expect(await mosaicsToken.symbol()).to.eq('MOSAIC');
  });

  it('should set name', async () => {
    expect(await mosaicsToken.name()).to.eq('Mosaics');
  });

  describe('contractURI', async () => {
    it('should return correct contractURI', async () => {
      expect(await mosaicsToken.contractURI()).to.eq(
        'ipfs://QmX6FPXtrS7nPodsevxgucu2oPhNXKPnob7YESzZDKiRQ5',
      );
    });
  });
});

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { constants } from 'ethers';
import { ethers, upgrades } from 'hardhat';
import {
  MaliciousBidder__factory as MaliciousBidderFactory,
  MosaicsAuctionHouse,
  MosaicsToken,
  WETH,
} from '../typechain';
import { deployMosaicsToken, deployWeth } from './utils';

chai.use(solidity);
const { expect } = chai;

describe('MosaicsAuctionHouse', () => {
  let mosaicsAuctionHouse: MosaicsAuctionHouse;
  let mosaicsToken: MosaicsToken;
  let weth: WETH;
  let deployer: SignerWithAddress;
  let mosaicsDAO: SignerWithAddress;
  let okamiLabs: SignerWithAddress;
  let bidderA: SignerWithAddress;
  let bidderB: SignerWithAddress;
  let snapshotId: string;

  const TIME_BUFFER = 15 * 60;
  const RESERVE_PRICE = 2;
  const MIN_INCREMENT_BID_PERCENTAGE = 5;
  const DURATION = 60 * 60 * 24;

  async function deploy(deployer?: SignerWithAddress) {
    const auctionHouseFactory = await ethers.getContractFactory('MosaicsAuctionHouse', deployer);
    return upgrades.deployProxy(auctionHouseFactory, [
      mosaicsToken.address,
      weth.address,
      TIME_BUFFER,
      RESERVE_PRICE,
      MIN_INCREMENT_BID_PERCENTAGE,
      DURATION,
    ]) as Promise<MosaicsAuctionHouse>;
  }

  before(async () => {
    [deployer, mosaicsDAO, okamiLabs, bidderA, bidderB] = await ethers.getSigners();

    mosaicsToken = await deployMosaicsToken(
      deployer,
      mosaicsDAO.address,
      deployer.address,
      okamiLabs.address,
    );
    weth = await deployWeth(deployer);
    mosaicsAuctionHouse = await deploy(deployer);

    await mosaicsToken.setMinter(mosaicsAuctionHouse.address);
  });

  beforeEach(async () => {
    snapshotId = await ethers.provider.send('evm_snapshot', []);
  });

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [snapshotId]);
  });

  it('should revert if a second initialization is attempted', async () => {
    const tx = mosaicsAuctionHouse.initialize(
      mosaicsToken.address,
      weth.address,
      TIME_BUFFER,
      RESERVE_PRICE,
      MIN_INCREMENT_BID_PERCENTAGE,
      DURATION,
    );

    await expect(tx).to.be.revertedWith('Initializable: contract is already initialized');
  });

  it('should allow the mosaicsDAO to unpause the contract and create the first auction', async () => {
    const tx = await mosaicsAuctionHouse.unpause();
    await tx.wait();

    const auction = await mosaicsAuctionHouse.auction();
    expect(auction.startTime.toNumber()).to.be.greaterThan(0);
  });

  it('should revert if a user creates a bid for an inactive auction', async () => {
    await (await mosaicsAuctionHouse.unpause()).wait();

    const { mosaicId } = await mosaicsAuctionHouse.auction();
    const tx = mosaicsAuctionHouse
      .connect(bidderA)
      .createBid(mosaicId.add(1), { value: RESERVE_PRICE });

    await expect(tx).to.be.revertedWith('MosaicsAuctionHouse: Mosaic not up for auction');
  });

  it('should revert if a user creates a bid for an expired auction', async () => {
    await (await mosaicsAuctionHouse.unpause()).wait();

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 25]); // 25 hours

    const { mosaicId } = await mosaicsAuctionHouse.auction();
    const tx = mosaicsAuctionHouse.connect(bidderA).createBid(mosaicId, { value: RESERVE_PRICE });

    await expect(tx).to.be.revertedWith('MosaicsAuctionHouse: Auction expired');
  });

  it('should revert if a user creates a bid with an amount below the reserve price', async () => {
    await (await mosaicsAuctionHouse.unpause()).wait();

    const { mosaicId } = await mosaicsAuctionHouse.auction();
    const tx = mosaicsAuctionHouse
      .connect(bidderA)
      .createBid(mosaicId, { value: RESERVE_PRICE - 1 });

    await expect(tx).to.be.revertedWith('MosaicsAuctionHouse: Must send at least reservePrice');
  });

  it('should revert if a user creates a bid less than the min bid increment percentage', async () => {
    await (await mosaicsAuctionHouse.unpause()).wait();

    const { mosaicId } = await mosaicsAuctionHouse.auction();
    mosaicsAuctionHouse.connect(bidderA).createBid(mosaicId, { value: RESERVE_PRICE * 50 });
    const tx = mosaicsAuctionHouse
      .connect(bidderB)
      .createBid(mosaicId, { value: RESERVE_PRICE * 51 });
    await expect(tx).to.be.revertedWith(
      'MosaicsAuctionHouse: Must send more than last bid by minBidIncrementPercentage amount',
    );
  });

  it('should refund the previous bidder when the following user creates a bid', async () => {
    await (await mosaicsAuctionHouse.unpause()).wait();

    const { mosaicId } = await mosaicsAuctionHouse.auction();
    await mosaicsAuctionHouse.connect(bidderA).createBid(mosaicId, { value: RESERVE_PRICE });

    const bidderAPostBidBalance = await bidderA.getBalance();
    await mosaicsAuctionHouse.connect(bidderB).createBid(mosaicId, { value: RESERVE_PRICE * 2 });
    const bidderAPostRefundBalance = await bidderA.getBalance();

    expect(bidderAPostRefundBalance).to.equal(bidderAPostBidBalance.add(RESERVE_PRICE));
  });

  it('should cap the maximum bid griefing cost at 30K gas + the cost to wrap the transfer WETH', async () => {
    await (await mosaicsAuctionHouse.unpause()).wait();

    const { mosaicId } = await mosaicsAuctionHouse.auction();

    const maliciousBidderFactory = new MaliciousBidderFactory(bidderA);
    const maliciousBidder = await maliciousBidderFactory.deploy();

    const maliciousBid = await maliciousBidder
      .connect(bidderA)
      .bid(mosaicsAuctionHouse.address, mosaicId, {
        value: RESERVE_PRICE,
      });
    await maliciousBid.wait();

    const tx = await mosaicsAuctionHouse.connect(bidderB).createBid(mosaicId, {
      value: RESERVE_PRICE * 2,
      gasLimit: 1_000_000,
    });
    const result = await tx.wait();

    expect(result.gasUsed.toNumber()).to.be.lessThan(200_000);
    expect(await weth.balanceOf(maliciousBidder.address)).to.equal(RESERVE_PRICE);
  });

  it('should emit an `AuctionBid` event on a successful bid', async () => {
    await (await mosaicsAuctionHouse.unpause()).wait();

    const { mosaicId } = await mosaicsAuctionHouse.auction();
    const tx = await mosaicsAuctionHouse
      .connect(bidderA)
      .createBid(mosaicId, { value: RESERVE_PRICE });

    await expect(tx)
      .to.emit(mosaicsAuctionHouse, 'AuctionBid')
      .withArgs(mosaicId, bidderA.address, RESERVE_PRICE, false);
  });

  it('should emit an `AuctionExtended` event if the auction end time is within the time buffer', async () => {
    await (await mosaicsAuctionHouse.unpause()).wait();

    const { mosaicId, endTime } = await mosaicsAuctionHouse.auction();

    await ethers.provider.send('evm_setNextBlockTimestamp', [endTime.sub(60 * 5).toNumber()]); // 5 minutes before auction end time

    const tx = mosaicsAuctionHouse.connect(bidderA).createBid(mosaicId, { value: RESERVE_PRICE });

    await expect(tx)
      .to.emit(mosaicsAuctionHouse, 'AuctionExtended')
      .withArgs(mosaicId, endTime.add(60 * 10));
  });

  it('should revert if auction settlement is attempted while the auction is still active', async () => {
    await (await mosaicsAuctionHouse.unpause()).wait();

    const { mosaicId } = await mosaicsAuctionHouse.auction();

    await mosaicsAuctionHouse.connect(bidderA).createBid(mosaicId, {
      value: RESERVE_PRICE,
    });
    const tx = mosaicsAuctionHouse.connect(bidderA).settleCurrentAndCreateNewAuction();

    await expect(tx).to.be.revertedWith('MosaicsAuctionHouse: The auction has not ended');
  });

  it('should emit `AuctionSettled` and `AuctionCreated` events if all conditions are met', async () => {
    await (await mosaicsAuctionHouse.unpause()).wait();

    const { mosaicId } = await mosaicsAuctionHouse.auction();

    await mosaicsAuctionHouse.connect(bidderA).createBid(mosaicId, {
      value: RESERVE_PRICE,
    });

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 25]); // Add 25 hours
    const tx = await mosaicsAuctionHouse.connect(bidderA).settleCurrentAndCreateNewAuction();

    const receipt = await tx.wait();
    const { timestamp } = await ethers.provider.getBlock(receipt.blockHash);

    const settledEvent = receipt.events?.find(e => e.event === 'AuctionSettled');
    const createdEvent = receipt.events?.find(e => e.event === 'AuctionCreated');

    expect(settledEvent?.args?.mosaicId).to.equal(mosaicId);
    expect(settledEvent?.args?.winner).to.equal(bidderA.address);
    expect(settledEvent?.args?.amount).to.equal(RESERVE_PRICE);

    expect(createdEvent?.args?.mosaicId).to.equal(mosaicId.add(1));
    expect(createdEvent?.args?.startTime).to.equal(timestamp);
    expect(createdEvent?.args?.endTime).to.equal(timestamp + DURATION);
  });

  it('should not create a new auction if the auction house is paused and unpaused while an auction is ongoing', async () => {
    await (await mosaicsAuctionHouse.unpause()).wait();

    await (await mosaicsAuctionHouse.pause()).wait();

    await (await mosaicsAuctionHouse.unpause()).wait();

    const { mosaicId } = await mosaicsAuctionHouse.auction();

    expect(mosaicId).to.equal(0);
  });

  it('should create a new auction if the auction house is paused and unpaused after an auction is settled', async () => {
    await (await mosaicsAuctionHouse.unpause()).wait();

    const { mosaicId } = await mosaicsAuctionHouse.auction();

    await mosaicsAuctionHouse.connect(bidderA).createBid(mosaicId, {
      value: RESERVE_PRICE,
    });

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 25]); // Add 25 hours

    await (await mosaicsAuctionHouse.pause()).wait();

    const settleTx = mosaicsAuctionHouse.connect(bidderA).settleAuction();

    await expect(settleTx)
      .to.emit(mosaicsAuctionHouse, 'AuctionSettled')
      .withArgs(mosaicId, bidderA.address, RESERVE_PRICE);

    const unpauseTx = await mosaicsAuctionHouse.unpause();
    const receipt = await unpauseTx.wait();
    const { timestamp } = await ethers.provider.getBlock(receipt.blockHash);

    const createdEvent = receipt.events?.find(e => e.event === 'AuctionCreated');

    expect(createdEvent?.args?.mosaicId).to.equal(mosaicId.add(1));
    expect(createdEvent?.args?.startTime).to.equal(timestamp);
    expect(createdEvent?.args?.endTime).to.equal(timestamp + DURATION);
  });

  it('should settle the current auction and pause the contract if the minter is updated while the auction house is unpaused', async () => {
    await (await mosaicsAuctionHouse.unpause()).wait();

    const { mosaicId } = await mosaicsAuctionHouse.auction();

    await mosaicsAuctionHouse.connect(bidderA).createBid(mosaicId, {
      value: RESERVE_PRICE,
    });

    await mosaicsToken.setMinter(constants.AddressZero);

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 25]); // Add 25 hours

    const settleTx = mosaicsAuctionHouse.connect(bidderA).settleCurrentAndCreateNewAuction();

    await expect(settleTx)
      .to.emit(mosaicsAuctionHouse, 'AuctionSettled')
      .withArgs(mosaicId, bidderA.address, RESERVE_PRICE);

    const paused = await mosaicsAuctionHouse.paused();

    expect(paused).to.equal(true);
  });

  it('should burn a Mosaic on auction settlement if no bids are received', async () => {
    await (await mosaicsAuctionHouse.unpause()).wait();

    const { mosaicId } = await mosaicsAuctionHouse.auction();

    await ethers.provider.send('evm_increaseTime', [60 * 60 * 25]); // Add 25 hours

    const tx = mosaicsAuctionHouse.connect(bidderA).settleCurrentAndCreateNewAuction();

    await expect(tx)
      .to.emit(mosaicsAuctionHouse, 'AuctionSettled')
      .withArgs(mosaicId, '0x0000000000000000000000000000000000000000', 0);
  });
});

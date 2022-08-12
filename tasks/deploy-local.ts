import { Contract as EthersContract } from 'ethers';
import { Interface } from 'ethers/lib/utils';
import { task, types } from 'hardhat/config';
import { default as MosaicsAuctionHouseABI } from '../abi/contracts/MosaicsAuctionHouse.sol/MosaicsAuctionHouse.json';
import { ContractName } from './types';

type LocalContractName = ContractName | 'WETH';

interface Contract {
  args?: (string | number | (() => string | undefined))[];
  instance?: EthersContract;
  libraries?: () => Record<string, string>;
  waitForConfirmation?: boolean;
}

task('deploy-local', 'Deploy contracts to local hardhat node')
  .addOptionalParam('mosaicsDAO', 'The Mosaics DAO contract address')
  .addOptionalParam('okamiLabs', 'The Okami Labs address')
  .addOptionalParam('auctionTimeBuffer', 'The time buffer for the auction (seconds)', 30, types.int) // default to 30 seconds
  .addOptionalParam('auctionReservePrice', 'The auction reserve price (wei)', 1, types.int) // default to 1 wei
  .addOptionalParam(
    'auctionMinIncrementBidPercentage',
    'The minimum increment bid percentage (out of 100)', // default to 5%
    5,
    types.int,
  )
  .addOptionalParam('auctionDuration', 'The auction duration (seconds)', 60 * 2, types.int) // default to 2 minutes
  .setAction(async (args, { ethers }) => {
    const network = await ethers.provider.getNetwork();
    if (network.chainId != 31337) {
      console.log(`Invalid chain id. Expected 31337, got ${network.chainId}`);
      return;
    }

    const [deployer] = await ethers.getSigners();
    const nonce = await deployer.getTransactionCount();

    if (!args.mosaicsDAO) {
      console.log(`Mosaics DAO address not provided. Setting to deployer (${deployer.address})...`);
      args.mosaicsDAO = deployer.address;
    }

    if (!args.okamiLabs) {
      console.log(`Okami Labs address not provided. Setting to deployer (${deployer.address})...`);
      args.okamiLabs = deployer.address;
    }

    const AUCTION_HOUSE_PROXY_NONCE_OFFSET = 5;

    const expectedAuctionHouseProxyAddress = ethers.utils.getContractAddress({
      from: deployer.address,
      nonce: nonce + AUCTION_HOUSE_PROXY_NONCE_OFFSET,
    });

    const contracts: Record<LocalContractName, Contract> = {
      WETH: {},
      MosaicsPassToken: {
        args: [1_000, 50, args.okamiLabs],
      },
      MosaicsToken: {
        args: [args.mosaicsDAO, expectedAuctionHouseProxyAddress, args.okamiLabs],
      },
      MosaicsAuctionHouse: {
        waitForConfirmation: true,
      },
      MosaicsAuctionHouseProxyAdmin: {},
      MosaicsAuctionHouseProxy: {
        args: [
          () => contracts.MosaicsAuctionHouse.instance?.address,
          () => contracts.MosaicsAuctionHouseProxyAdmin.instance?.address,
          () =>
            new Interface(MosaicsAuctionHouseABI).encodeFunctionData('initialize', [
              contracts.MosaicsToken.instance?.address,
              contracts.WETH.instance?.address,
              args.auctionTimeBuffer,
              args.auctionReservePrice,
              args.auctionMinIncrementBidPercentage,
              args.auctionDuration,
            ]),
        ],
      },
    };

    for (const [name, contract] of Object.entries(contracts)) {
      const factory = await ethers.getContractFactory(name, {
        libraries: contract?.libraries?.(),
      });

      const deployedContract = await factory.deploy(
        ...(contract.args?.map(a => (typeof a === 'function' ? a() : a)) ?? []),
      );

      if (contract.waitForConfirmation) {
        await deployedContract.deployed();
      }

      contracts[name as ContractName].instance = deployedContract;

      console.log(`${name} contract deployed to ${deployedContract.address}`);
    }

    return contracts;
  });

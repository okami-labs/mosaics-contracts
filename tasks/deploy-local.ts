import { Contract as EthersContract } from 'ethers'
import { task, types } from 'hardhat/config'
import { ContractName } from './types'

type LocalContractName = ContractName | 'WETH';

interface Contract {
  args?: (string | number | (() => string | undefined))[];
  instance?: EthersContract;
  libraries?: () => Record<string, string>;
  waitForConfirmation?: boolean;
}

task('deploy-local', 'Deploy contracts to local hardhat node')
  .addOptionalParam(
    'mosaicsDAO',
    'The Mosaics DAO contract address',
    '0x5Fe11f9351e043B2B85A80f540af545462E8269d',
  )
  .addOptionalParam(
    'okamiLabsAddress',
    'The Okami Labs address',
    '0x5Fe11f9351e043B2B85A80f540af545462E8269d',
  )
  .addOptionalParam('auctionTimeBuffer', 'The time buffer for the auction (seconds)', 30, types.int) // default to 30 seconds
  .addOptionalParam('auctionReservePrice', 'The auction reserve price (wei)', 1, types.int) // default to 1 wei
  .addOptionalParam(
    'auctionMinIncrementBidPercentage',
    'The minimum increment bid percentage (out of 100)', // default to 5%
    5,
    types.int,
  )
  .addOptionalParam('auctionDuration', 'The auction duration (seconds)', 60 * 2, types.int) // default to 2 minutes
  .addOptionalParam('timelockDelay', 'The timelock delay (seconds)', 60 * 60 * 24 * 2, types.int) // default to 2 days
  .setAction(async (args, { ethers }) => {
    const network = await ethers.provider.getNetwork();
    if (network.chainId != 31337) {
      console.log(`Invalid chain id. Expected 31337, got ${network.chainId}`);
      return;
    }

    const [deployer] = await ethers.getSigners();

    const contracts: Record<LocalContractName, Contract> = {
      WETH: {},
      MosaicsPassToken: {
        args: [1_000, 50, args.okamiLabsAddress],
      },
      MosaicsToken: {
        args: [
          args.mosaicsDAO,
          deployer.address, // minter - TODO: change to auction house address
          args.okamiLabsAddress,
        ],
      },
      // TODO: Not yet implemented
      // MosaicsAuctionHouse: {},
      // MosaicsAuctionHouseProxyAdmin: {},
      // MosaicsAuctionHouseProxy: {},
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

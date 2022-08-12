import { Interface } from 'ethers/lib/utils';
import { task, types } from 'hardhat/config';
import promptjs from 'prompt';
import { default as MosaicsAuctionHouseABI } from '../abi/contracts/MosaicsAuctionHouse.sol/MosaicsAuctionHouse.json';
import { ChainId, ContractDeployment, ContractName, DeployedContract } from './types';

promptjs.colors = false;
promptjs.message = '> ';
promptjs.delimiter = '';

const wethContracts: Record<number, string> = {
  [ChainId.Mainnet]: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  [ChainId.Ropsten]: '0xc778417e063141139fce010982780140aa0cd5ab',
  [ChainId.Rinkeby]: '0xc778417e063141139fce010982780140aa0cd5ab',
  [ChainId.Kovan]: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
};

task('deploy', 'Deploy Mosaics Contracts')
  .addFlag('autoDeploy', 'Deploy all contracts without user interaction')
  .addOptionalParam('weth', 'The WETH contract address', undefined, types.string)
  .addOptionalParam('mosaicsDAO', 'The deployer address', undefined, types.string)
  .addOptionalParam('okamiLabs', 'The Okami Labs address', undefined, types.string)
  .addOptionalParam(
    'auctionTimeBuffer',
    'The auction time buffer (seconds)',
    5 * 60 /* 5 minutes */,
    types.int,
  )
  .addOptionalParam(
    'auctionReservePrice',
    'The auction reserve price (wei)',
    1 /* 1 wei */,
    types.int,
  )
  .addOptionalParam(
    'auctionMinIncrementBidPercentage',
    'The minimum increment bid percentage (out of 100)',
    2 /* 2% */,
    types.int,
  )
  .addOptionalParam(
    'auctionDuration',
    'The auction duration (seconds)',
    60 * 60 * 24 /* 1 day */,
    types.int,
  )
  .setAction(async (args, { ethers }) => {
    const network = await ethers.provider.getNetwork();
    const [deployer] = await ethers.getSigners();

    if (!args.mosaicsDAO) {
      console.log(`Mosaics DAO address not provided. Setting to deployer (${deployer.address})...`);
      args.mosaicsDAO = deployer.address;
    }

    if (!args.okamiLabs) {
      console.log(`Okami Labs address not provided. Setting to deployer (${deployer.address})...`);
      args.okamiLabs = deployer.address;
    }

    if (!args.weth) {
      const deployedWETHContract = wethContracts[network.chainId];
      if (!deployedWETHContract) {
        throw new Error(
          `Can not auto-detect WETH contract address for chain id ${network.chainId}. Provide it with the --weth arg.`,
        );
      }
      args.weth = deployedWETHContract;
    }

    const nonce = await deployer.getTransactionCount();

    const AUCTION_HOUSE_PROXY_NONCE_OFFSET = 4;

    const expectedAuctionHouseProxyAddress = ethers.utils.getContractAddress({
      from: deployer.address,
      nonce: nonce + AUCTION_HOUSE_PROXY_NONCE_OFFSET,
    });

    const deployment: Record<ContractName, DeployedContract> = {} as Record<
      ContractName,
      DeployedContract
    >;
    const contracts: Record<ContractName, ContractDeployment> = {
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
          () => deployment.MosaicsAuctionHouse.address,
          () => deployment.MosaicsAuctionHouseProxyAdmin.address,
          () =>
            new Interface(MosaicsAuctionHouseABI).encodeFunctionData('initialize', [
              deployment.MosaicsToken.address,
              args.weth,
              args.auctionTimeBuffer,
              args.auctionReservePrice,
              args.auctionMinIncrementBidPercentage,
              args.auctionDuration,
            ]),
        ],
        waitForConfirmation: true,
        validateDeployment: () => {
          const expected = expectedAuctionHouseProxyAddress.toLowerCase();
          const actual = deployment.MosaicsAuctionHouseProxy.address.toLowerCase();
          if (expected !== actual) {
            throw new Error(
              `Auction House Proxy address mismatch. Expected ${expected}, got ${actual}`,
            );
          }
        },
      },
    };

    for (const [name, contract] of Object.entries(contracts)) {
      let gasPrice = await ethers.provider.getGasPrice();
      if (!args.autoDeploy) {
        const gasInGwei = Math.round(Number(ethers.utils.formatUnits(gasPrice, 'gwei')));

        promptjs.start();

        const result = await promptjs.get([
          {
            properties: {
              gasPrice: {
                type: 'integer',
                required: true,
                description: `Gas price (in Gwei)`,
                default: gasInGwei,
              },
            },
          },
        ]);

        gasPrice = ethers.utils.parseUnits(result.gasPrice.toString(), 'gwei');
      }

      const factory = await ethers.getContractFactory(name, {
        libraries: contract?.libraries?.(),
      });

      const deploymentGas = await factory.signer.estimateGas(
        factory.getDeployTransaction(
          ...(contract.args?.map(a => (typeof a === 'function' ? a() : a)) ?? []),
          {
            gasPrice,
          },
        ),
      );

      const deploymentCost = deploymentGas.mul(gasPrice);

      console.log(
        `Estimated cost to deploy ${name}: ${ethers.utils.formatUnits(
          deploymentCost,
          'ether',
        )} ETH`,
      );

      if (!args.autoDeploy) {
        const result = await promptjs.get([
          {
            properties: {
              confirm: {
                pattern: /^(DEPLOY|SKIP|EXIT)$/,
                description: `Type "DEPLOY" to confirm, "SKIP" to skip this contract, or "EXIT" to exit`,
              },
            },
          },
        ]);

        if (result.operation === 'SKIP') {
          console.log(`Skipping ${name} deployment...`);
          continue;
        }

        if (result.operation === 'EXIT') {
          console.log(`Exiting...`);
          process.exit(0);
        }
      }

      console.log(`Deploying ${name}...`);

      const deployedContract = await factory.deploy(
        ...(contract.args?.map(a => (typeof a === 'function' ? a() : a)) ?? []),
        {
          gasPrice,
        },
      );

      if (contract.waitForConfirmation) {
        await deployedContract.deployed();
      }

      deployment[name as ContractName] = {
        name,
        instance: deployedContract,
        address: deployedContract.address,
        constructorArguments: contract.args?.map(a => (typeof a === 'function' ? a() : a)) ?? [],
        libraries: contract.libraries?.() ?? {},
      };

      contract.validateDeployment?.();

      console.log(`Deployed ${name} at ${deployedContract.address}`);
    }

    console.log(`Deployment complete!`);
    return deployment;
  });

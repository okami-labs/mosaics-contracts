import { task, types } from 'hardhat/config';
import promptjs from 'prompt';
import { ContractDeployment, ContractName, DeployedContract } from './types';

promptjs.colors = false;
promptjs.message = '> ';
promptjs.delimiter = '';

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

task('deploy-map', 'Deploy Mosaics Pass Contract')
  .addOptionalParam('okamiLabs', 'The Okami Labs address', undefined, types.string)
  .addOptionalParam(
    'maxSupplyPremium',
    'The maximum supply of mosaics premium pass',
    10_000,
    types.int,
  )
  .setAction(async (args, { ethers, run }) => {
    const [deployer] = await ethers.getSigners();

    if (!args.okamiLabs) {
      console.log(`Okami Labs address not provided. Setting to deployer (${deployer.address})...`);
      args.okamiLabs = deployer.address;
    }

    const name: ContractName = 'MosaicsPassToken';
    const contract: ContractDeployment = {
      args: [        
        args.maxSupplyPremium,
        args.okamiLabs,
      ]
    }

    let gasPrice = await ethers.provider.getGasPrice();
    const factory = await ethers.getContractFactory(name, {});
    const deploymentGas = await factory.signer.estimateGas(
      factory.getDeployTransaction(
        args.maxSupplyPremium,
        args.okamiLabs,
        {
          gasPrice,
        },
      ),
    );

    console.log(
      `Estimated cost to deploy MosaicsPassToken: ${ethers.utils.formatUnits(
        deploymentGas.mul(gasPrice),
        'ether',
      )} ETH`,
    );

    console.log(`Deploying MosaicsPassToken...`);
    const deployedContract = await factory.deploy(
      args.maxSupplyPremium,
      args.okamiLabs,
      {
        gasPrice,
      },
    );

    await deployedContract.deployed();

    const deployment: DeployedContract = {
      name,
      instance: deployedContract,
      address: deployedContract.address,
      constructorArguments: [
        args.maxSupplyPremium,
        args.okamiLabs,
      ],
      libraries: contract.libraries?.() ?? {},
    };

    contract.validateDeployment?.();

    console.log(`Deployed ${name} at ${deployedContract.address}`);
    console.log('Waiting for etherscan to index. Sleeping for 60 seconds...');
    await sleep(60 * 1000);

    try {
      console.log(`Verifying ${name}: ${deployment.address}`);
      await run('verify:verify', {
        address: deployment.address,
        contract: `contracts/${name}.sol:${name}`,
        constructorArguments: deployment.constructorArguments,
      });

      console.log(`Verified ${name}: ${deployment.address}`);
    } catch (e) {
      console.error(`Failed to verify ${name}: ${deployment.address}`);
      console.error(e);
    }

    return deployment;
  });

import { task } from 'hardhat/config';
import { ContractName, DeployedContract } from './types';

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

task('deploy-ci', 'Deploy contracts (automated by CI)')
  .addOptionalParam(
    'weth',
    'The WETH contract address',
    '0xc778417e063141139fce010982780140aa0cd5ab',
  )
  .setAction(async ({ weth }, { ethers, run }) => {
    const [deployer] = await ethers.getSigners();
    const contracts: Record<ContractName, DeployedContract> = await run('deploy', {
      weth,
      mosaicsDAO: deployer.address,
      autoDeploy: true,
    });

    console.log('Waiting for etherscan to index. Sleeping for 60 seconds...');
    await sleep(60 * 1000);

    for (const [, contract] of Object.entries(contracts)) {
      console.log(`Verifying ${contract.name}: ${contract.address}`);
      await run('verify:verify', {
        address: contract.address,
        constructorArguments: contract.constructorArguments,
      });
      console.log(`Verified ${contract.name}: ${contract.address}`);
    }

    // if (!fs.existsSync('logs')) {
    //   fs.mkdirSync('logs');
    // }

    // console.log(contracts.MosaicsPassToken.constructorArguments);

    // fs.writeFileSync(
    //   'logs/deploy.json',
    //   JSON.stringify({
    //     contractAddresses: {
    //       MosaicsToken: contracts.MosaicsToken.address,
    //       MosaicsPassToken: contracts.MosaicsPassToken.address,
    //       // missing contract args
    //     },
    //     gitHub: {
    //       // Get the commit sha when running in CI
    //       sha: process.env.GITHUB_SHA,
    //     },
    //   }),
    //   { flag: 'w' },
    // );
  });

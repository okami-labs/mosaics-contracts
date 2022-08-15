import fs from 'fs';
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
    const [mosaicsDAO, okamiLabs] = await ethers.getSigners();
    const contracts: Record<ContractName, DeployedContract> = await run('deploy', {
      weth,
      mosaicsDAO: mosaicsDAO.address,
      okamiLabs: okamiLabs.address,
      autoDeploy: true,
    });

    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs');
    }

    fs.writeFileSync(
      'logs/deploy.json',
      JSON.stringify({
        contractAddresses: {
          MosaicsToken: contracts.MosaicsToken.address,
          MosaicsPassToken: contracts.MosaicsPassToken.address,
          MosaicsAuctionHouse: contracts.MosaicsAuctionHouse.address,
          MosaicsAuctionHouseProxy: contracts.MosaicsAuctionHouseProxy.address,
          MosaicsAuctionHouseProxyAdmin: contracts.MosaicsAuctionHouseProxyAdmin.address,
        },
        constructorArguments: {
          MosaicsToken: contracts.MosaicsToken.constructorArguments,
          MosaicsPassToken: contracts.MosaicsPassToken.constructorArguments,
          MosaicsAuctionHouse: contracts.MosaicsAuctionHouse.constructorArguments,
          MosaicsAuctionHouseProxy: contracts.MosaicsAuctionHouseProxy.constructorArguments,
          MosaicsAuctionHouseProxyAdmin:
            contracts.MosaicsAuctionHouseProxyAdmin.constructorArguments,
        },
        gitHub: {
          // Get the commit sha when running in CI
          sha: process.env.GITHUB_SHA,
        },
      }, null, 2),
      { flag: 'w'},
    );

    console.log('Waiting for etherscan to index. Sleeping for 60 seconds...');
    await sleep(60 * 1000);

    for (const [, contract] of Object.entries(contracts)) {
      try {
        console.log(`Verifying ${contract.name}: ${contract.address}`);
        await run('verify:verify', {
          address: contract.address,
          contract: `contracts/${contract.name.includes("Proxy") ? "proxies/": ""}${contract.name}.sol:${contract.name}`,
          constructorArguments: contract.constructorArguments,
        });
        console.log(`Verified ${contract.name}: ${contract.address}`);
      } catch (e) {
        console.error(`Failed to verify ${contract.name}: ${contract.address}`);
        console.error(e);
      }
    }
  });

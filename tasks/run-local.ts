import { TASK_COMPILE, TASK_NODE } from 'hardhat/builtin-tasks/task-names';
import { task } from 'hardhat/config';

task(
  'run-local',
  'Start a hardhat node, deploy contracts, and execute setup transactions',
).setAction(async (_, { ethers, run }) => {
  await run(TASK_COMPILE);

  await Promise.race([run(TASK_NODE), new Promise(resolve => setTimeout(resolve, 2_000))]);

  const contracts = await run('deploy-local');

  const { chainId } = await ethers.provider.getNetwork();

  console.log(
    `Mosaics contracts deploy to local node at http://localhost:8545 (Chain ID: ${chainId})`,
  );
  console.log(`Mosaics Pass ERC721 address: ${contracts.MosaicsPassToken.instance.address}`);

  await ethers.provider.send('evm_setIntervalMining', [12_000]);

  await new Promise(() => {
    // keep node alive until this process is killed
  });
});

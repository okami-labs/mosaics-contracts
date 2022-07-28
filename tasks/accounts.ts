import { task } from 'hardhat/config';

task('accounts', 'Prints the list of accounts', async (_, { ethers }) => {
  const accounts = await ethers.getSigners();
  console.log(accounts.map(account => account.address));
});

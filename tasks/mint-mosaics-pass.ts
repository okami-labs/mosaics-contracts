import { task, types } from 'hardhat/config';

task('mint-mosaics-pass', 'Mints a Mosaic Pass')
  .addOptionalParam(
    'token',
    'The `MosaicsPassToken` contract address',
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    types.string,
  )
  .setAction(async ({ token }, { ethers }) => {
    const nftFactory = await ethers.getContractFactory('MosaicsPassToken');
    const nftContract = await nftFactory.attach(token);

    const receipt = await (await nftContract.publicSaleMint(1)).wait();

    console.log(receipt);
  });

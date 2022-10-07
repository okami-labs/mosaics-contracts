import { Block } from '@ethersproject/abstract-provider';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, network } from 'hardhat';
import {
  MosaicsPassToken,
  MosaicsPassToken__factory as MosaicsPassTokenFactory,
  MosaicsToken,
  MosaicsToken__factory as MosaicsTokenFactory,
  WETH,
  WETH__factory as WethFactory
} from '../typechain';

export type TestSigners = {
  deployer: SignerWithAddress;
  account0: SignerWithAddress;
  account1: SignerWithAddress;
  account2: SignerWithAddress;
};

export const getSigners = async (): Promise<TestSigners> => {
  const [deployer, account0, account1, account2] = await ethers.getSigners();
  return {
    deployer,
    account0,
    account1,
    account2,
  };
};

export const deployMosaicsPassToken = async (
  deployer: SignerWithAddress,
  maxSupply: number,
  amountForOkami: number,
  okamiLabs: SignerWithAddress,
): Promise<MosaicsPassToken> => {
  const factory = new MosaicsPassTokenFactory(deployer);

  return factory.deploy(maxSupply, amountForOkami, okamiLabs.address);
};

export const deployMosaicsToken = async (
  deployer: SignerWithAddress,
  mosaicsDAO: string,
  minter: string,
  okamiLabs: string,
): Promise<MosaicsToken> => {
  const factory = new MosaicsTokenFactory(deployer);

  return factory.deploy(mosaicsDAO, minter, okamiLabs);
};

export const deployWeth = async (deployer?: SignerWithAddress): Promise<WETH> => {
  const factory = new WethFactory(deployer || (await getSigners()).deployer);

  return factory.deploy();
};

export const MintMosaics = (token: MosaicsToken): ((amount: number) => Promise<void>) => {
  return async (amount: number): Promise<void> => {
    for (let i = 0; i < amount; i++) {
      await token.mint();
    }
  };
};

// The following adapted from `https://github.com/compound-finance/compound-protocol/blob/master/tests/Utils/Ethereum.js`

const rpc = <T = unknown>({
  method,
  params,
}: {
  method: string;
  params?: unknown[];
}): Promise<T> => {
  return network.provider.send(method, params);
};

export const encodeParameters = (types: string[], values: unknown[]): string => {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
};

export const blockByNumber = async (n: number | string): Promise<Block> => {
  return rpc({ method: 'eth_getBlockByNumber', params: [n, false] });
};

export const increaseTime = async (seconds: number): Promise<unknown> => {
  await rpc({ method: 'evm_increaseTime', params: [seconds] });
  return rpc({ method: 'evm_mine' });
};

export const freezeTime = async (seconds: number): Promise<unknown> => {
  await rpc({ method: 'evm_increaseTime', params: [-1 * seconds] });
  return rpc({ method: 'evm_mine' });
};

export const advanceBlocks = async (blocks: number): Promise<void> => {
  for (let i = 0; i < blocks; i++) {
    await mineBlock();
  }
};

export const blockNumber = async (parse = true): Promise<number> => {
  const result = await rpc<number>({ method: 'eth_blockNumber' });
  return parse ? parseInt(result.toString()) : result;
};

export const blockTimestamp = async (
  n: number | string,
  parse = true,
): Promise<number | string> => {
  const block = await blockByNumber(n);
  return parse ? parseInt(block.timestamp.toString()) : block.timestamp;
};

export const setNextBlockTimestamp = async (n: number, mine = true): Promise<void> => {
  await rpc({ method: 'evm_setNextBlockTimestamp', params: [n] });
  if (mine) await mineBlock();
};

export const minerStop = async (): Promise<void> => {
  await network.provider.send('evm_setAutomine', [false]);
  await network.provider.send('evm_setIntervalMining', [0]);
};

export const minerStart = async (): Promise<void> => {
  await network.provider.send('evm_setAutomine', [true]);
};

export const mineBlock = async (): Promise<void> => {
  await network.provider.send('evm_mine');
};

export const chainId = async (): Promise<number> => {
  return parseInt(await network.provider.send('eth_chainId'), 16);
};

export const address = (n: number): string => {
  return `0x${n.toString(16).padStart(40, '0')}`;
};

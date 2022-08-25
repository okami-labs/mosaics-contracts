import { Contract } from 'ethers';

export enum ChainId {
  Mainnet = 1,
  Goerli = 5,
}

// prettier-ignore
export type ContractName = 'MosaicsPassToken' | 'MosaicsToken' | 'MosaicsAuctionHouse' | 'MosaicsAuctionHouseProxy' | 'MosaicsAuctionHouseProxyAdmin';

export interface ContractDeployment {
  args?: (string | number | (() => string))[];
  libraries?: () => Record<string, string>;
  waitForConfirmation?: boolean;
  validateDeployment?: () => void;
}

export interface DeployedContract {
  name: string;
  address: string;
  instance: Contract;
  constructorArguments: (string | number)[];
  libraries: Record<string, string>;
}

export interface ContractRow {
  Address: string;
  'Deployment Hash'?: string;
}

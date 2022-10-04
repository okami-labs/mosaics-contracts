const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const ethers = require('ethers');
const fs = require('fs');

// read the data from the file
console.log('Reading allowlist from file...');
const allowlist = fs.readFileSync('scripts/allowlist.txt', 'utf8').split('\n'); // split by new line
console.log(allowlist);

// hash the data
console.log('Hashing the data...');
const leaves = allowlist.map((x) => keccak256(x));

// create the merkle tree
console.log('Creating the merkle tree...');
const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

// get the merkle root
console.log('Getting the merkle root...');
const root = tree.getRoot().toString('hex');

// get the merkle proof
console.log('Getting the merkle proof...');
const proof = tree.getProof(leaves[0]).map((x) => x.data.toString('hex'));

// print the merkle root and proof
console.log('Merkle root: ', root);
console.log('Merkle proof: ', proof);

// test that allowlist[0] is in the tree
console.log('Testing that allowlist[0] is in the tree...');
console.log(tree.verify(proof, leaves[0], root));
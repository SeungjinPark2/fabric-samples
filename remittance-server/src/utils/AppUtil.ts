import { Wallet, Wallets } from 'fabric-network';
import * as fs from 'fs';
import * as path from 'path';

const buildCCPOrg = (org: number): Record<string, any> => {
    // load the common connection configuration file
    // docker mount 시키기
    const ccpPath = path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        'test-network',
        'organizations',
        'peerOrganizations',
        `org${org}.example.com`,
        `connection-org${org}.json`
    );
    const fileExists = fs.existsSync(ccpPath);
    if (!fileExists) {
        throw new Error(`no such file or directory: ${ccpPath}`);
    }
    const contents = fs.readFileSync(ccpPath, 'utf8');

    // build a JSON object from the file contents
    const ccp = JSON.parse(contents);

    console.log(`Loaded the network configuration located at ${ccpPath}`);
    return ccp;
};

const buildWallet = async (walletPath: string): Promise<Wallet> => {
    // Create a new  wallet : Note that wallet is for managing identities.
    let wallet: Wallet;
    if (walletPath) {
        // remove any pre-existing wallet from prior runs
        // fs.rmSync(walletPath, { recursive: true, force: true });

        wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Built a file system wallet at ${walletPath}`);
    } else {
        wallet = await Wallets.newInMemoryWallet();
        console.log('Built an in memory wallet');
    }

    return wallet;
};

const prettyJSONString = (inputString: string): string => {
    if (inputString) {
        return JSON.stringify(JSON.parse(inputString), null, 2);
    } else {
        return inputString;
    }
};

export { buildCCPOrg, buildWallet, prettyJSONString };

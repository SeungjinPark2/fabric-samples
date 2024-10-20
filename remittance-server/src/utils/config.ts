import { Contract, Gateway, Network } from 'fabric-network';
import path from 'path';
import 'dotenv/config';

const getConfiguration = (): {
    port: number;
    channelName: string;
    chaincodeName: string;
    orgNum: number;
    userId: string;
    mspOrg: string;
    walletPath: string;
    peerOrgPath: string;
    gateway: Gateway;
    jwtsecret: string;
    network: Network | null;
    contract: Contract | null;
} => {
    const port = parseInt(process.env.PORT || '3000');
    const channelName = process.env.CHANNEL_NAME || '';
    const chaincodeName = process.env.CHAINCODE_NAME || '';
    const orgNum = parseInt(process.env.ORGNUM || '0');
    const userId = process.env.USERID || '';
    const mspOrg = `Org${orgNum}MSP`;
    const jwtsecret = process.env.JWTSECRET || '';
    const peerOrgPath =
        process.env.PEERORGPATH ||
        '../test-network/organizations/peerOrganizations';
    const walletPath = path.join(__dirname, '..', 'wallet', `org${orgNum}`);

    console.log(`
        ----------------- env variables -----------------
        port: ${port}
        channelName: ${channelName}
        chaincodeName: ${chaincodeName}
        orgNum: ${orgNum}
        userId: ${userId}
        mspOrg: ${mspOrg}
        walletPath: ${walletPath}
        peerOrgPath: ${peerOrgPath}
        jwtsecret: ${jwtsecret}
        ----------------- env variables -----------------
        `);

    return {
        port,
        channelName,
        chaincodeName,
        orgNum,
        userId,
        mspOrg,
        walletPath,
        peerOrgPath,
        jwtsecret,
        gateway: new Gateway(),
        network: null,
        contract: null,
    };
};

export const configuration = getConfiguration();

/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
import { Gateway, GatewayOptions } from 'fabric-network';
import * as path from 'path';
import { buildCCPOrg, buildWallet, prettyJSONString } from './utils//AppUtil';
import { buildCAClient, enrollAdmin, registerAndEnrollUser } from './utils/CAUtil';
import 'dotenv/config';

const channelName = process.env.CHANNEL_NAME || '';
const chaincodeName = process.env.CHAINCODE_NAME || '';
const orgNum = parseInt(process.env.ORGNUM || '0') || 0;
const mspOrg = `Org${orgNum}MSP`;
const userId = process.env.USERID || '';
const skipInit = process.env.SKIPINIT || true;
const skipChaincodeInit = process.env.SKIP_CHAINCODE_INIT || true;

const walletPath = path.join(__dirname, 'wallet', `org${orgNum}`);

let gateway;
let network;
let contract;

async function createNetwork(ccp, gatewayOpts) {
    await gateway.connect(ccp, gatewayOpts);
    network = await gateway.getNetwork(channelName);
    contract = network.getContract(chaincodeName);
}

async function setup() {
    try {
        const ccp = buildCCPOrg(orgNum);
        const caClient = buildCAClient(ccp, `ca.org${orgNum}.example.com`);
        const wallet = await buildWallet(walletPath);

        if (!skipInit) {
            await enrollAdmin(caClient, wallet, mspOrg);
            await registerAndEnrollUser(caClient, wallet, mspOrg, userId, `org${orgNum}.department${orgNum}`);
        }

        gateway = new Gateway();

        const gatewayOpts: GatewayOptions = {
            wallet,
            identity: 'admin',
            discovery: { enabled: true, asLocalhost: true },
        };

        await createNetwork(ccp, gatewayOpts);

        if (!skipChaincodeInit) {
            console.log('\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger');
            await contract.submitTransaction('Init','fxr_live_b1e7580ba98491842a59797583c3d681e5af', 'https://api.fxratesapi.com/');
            console.log('*** Result: committed');
        }

        gateway.disconnect();
        gatewayOpts.identity = userId;
        await createNetwork(ccp, gatewayOpts);
    } catch (error) {
        console.error(`******** FAILED to run the application: ${error}`);
        process.exit(1);
    }
}

setup();

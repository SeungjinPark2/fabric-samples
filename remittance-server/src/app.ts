/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
import { Contract, Gateway, GatewayOptions } from 'fabric-network';
import * as path from 'path';
import { buildCCPOrg, buildWallet, prettyJSONString } from './utils//AppUtil';
import { buildCAClient, enrollAdmin, registerAndEnrollUser } from './utils/CAUtil';
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import 'express-async-errors';
import {uuid} from 'uuidv4';

const app = express();

const port = parseInt(process.env.PORT || '3000');
const channelName = process.env.CHANNEL_NAME || '';
const chaincodeName = process.env.CHAINCODE_NAME || '';
const orgNum = parseInt(process.env.ORGNUM || '0') || 0;
const mspOrg = `Org${orgNum}MSP`;
const userId = process.env.USERID || '';
const skipInit: boolean = process.env.SKIPINIT === 'true';
const skipChaincodeInit: boolean = process.env.SKIP_CHAINCODE_INIT === 'true';

const walletPath = path.join(__dirname, 'wallet', `org${orgNum}`);

let gateway: Gateway;
let network;
let contract: Contract;

async function createNetwork(ccp: Record<string, any>, gatewayOpts: GatewayOptions) {
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
            await registerAndEnrollUser(caClient, wallet, mspOrg, userId, `org${orgNum}.department1`);
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

app.use(bodyParser.json());

app.get('/bank', async (req: Request, res: Response, next: NextFunction) => {
    const code = req.query.code as (string | undefined);

    const result = (await contract.evaluateTransaction('ReadBank', code ?? '')).toString();

    res.send(JSON.parse(result));
});

app.get('/transaction', async (req: Request, res: Response, next: NextFunction) => {
    const id = req.query.id as string;

    const result = (await contract.evaluateTransaction('ReadTransaction', id)).toString();

    res.send(JSON.parse(result));
});

app.get('/receipt', async (req: Request, res: Response, next: NextFunction) => {
    const id = req.query.id as string;

    const result = (await contract.evaluateTransaction('ReadReceipt', id)).toString();

    res.send(JSON.parse(result));
});

app.post('/bank', async (req: Request, res: Response, next: NextFunction) => {
    const currencyCode = req.body.currencyCode ?? 'KRW';
    const result = (await contract.submitTransaction('RegisterBank', currencyCode)).toString();

    res.send(JSON.parse(result));
});

app.post('/account', async (req: Request, res: Response, next: NextFunction) => {
    const code = req.body.code ?? '';
    const result = (await contract.submitTransaction('CreateAccount', code)).toString();

    res.send(JSON.parse(result));
});

app.post('/liquidity', async (req: Request, res: Response, next: NextFunction) => {
    const targetCode = req.body.code ?? '';
    const liquidity = req.body.liquidity ?? '';

    const result = (await contract.submitTransaction('ApplyLiquidity', targetCode, liquidity, '')).toString();

    res.send(JSON.parse(result));
});

type PersonInfo = {
    address: string,
    name: string,
    birthday: number,
    phoneNumber: string,
};

type Participant = {
    code: string,
    type: 'sender' | 'receiver' | 'intermediary',
};

app.post('/transaction', async (req: Request, res: Response, next: NextFunction) => {
    const id = uuid();
    const senderInfo = JSON.stringify(req.body.senderInfo as PersonInfo);
    const receiverInfo = JSON.stringify(req.body.receiverInfo as PersonInfo);
    const value = req.body.value as string;
    const participants = JSON.stringify(req.body.participants as Participant[]);
    console.log(req.body);

    const result = (await contract.submitTransaction('ProposeTransaction', id, senderInfo, receiverInfo, value, participants)).toString();

    res.send(JSON.parse(result));
});

app.post('/approve', async (req: Request, res: Response, next: NextFunction) => {
    const txid = req.body.id ?? '';
    const choice = req.body.choice ?? '';
    const reason = req.body.reason ?? '';

    const result = (await contract.submitTransaction('ApproveTransaction', txid, choice, reason)).toString();

    res.send(JSON.parse(result));
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? '' : err.stack,
  });
});

app.listen(port, () => {
    console.log(`
      ################################################
      🛡️  Server listening on port: ${port}
      ################################################
    `);
});

['SIGINT', 'SIGTERM'].forEach(sig => {
    process.on(sig, async function () {
        // Do some cleanup such as close db
        console.log('program accepted interrupt! getting exited...');
        gateway.disconnect();

        console.log('close succeeded');
        process.exit(0);
    });
});


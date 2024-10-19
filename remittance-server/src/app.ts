import { Contract, Gateway, GatewayOptions, Network } from 'fabric-network';
import { buildCCPOrg, buildWallet } from './utils//AppUtil';
import {
    buildCAClient,
    enrollAdmin,
    registerAndEnrollUser,
} from './utils/CAUtil';
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import 'express-async-errors';
import { getConfiguration } from './utils/config';

const conf = getConfiguration();
const app = express();

let gateway: Gateway;
let network: Network;
let contract: Contract;

async function connectGateway(
    ccp: Record<string, any>,
    gatewayOpts: GatewayOptions,
    channelName: string,
    chaincodeName: string
) {
    await gateway.connect(ccp, gatewayOpts);
    network = await gateway.getNetwork(channelName);
    contract = network.getContract(chaincodeName);
}

app.use(bodyParser.json());

app.post('/gateway', async (_req: Request, res: Response) => {
    const ccp = buildCCPOrg(conf.orgNum);
    const caClient = buildCAClient(ccp, `ca.org${conf.orgNum}.example.com`);
    const wallet = await buildWallet(conf.walletPath);

    await enrollAdmin(caClient, wallet, conf.mspOrg);
    await registerAndEnrollUser(
        caClient,
        wallet,
        conf.mspOrg,
        conf.userId,
        `org${conf.orgNum}.department1`
    );

    gateway = new Gateway();

    const gatewayOpts: GatewayOptions = {
        wallet,
        identity: conf.userId,
        discovery: { enabled: true, asLocalhost: true },
    };

    await connectGateway(
        ccp,
        gatewayOpts,
        conf.channelName,
        conf.chaincodeName
    );

    res.status(200);
});

app.post('/init', async (req: Request, res: Response) => {
    // init chaincode
});

app.get('/bank', async (req: Request, res: Response, _next: NextFunction) => {
    const code = req.query.code;
    if (code == null) res.status(400);

    const result = (
        await contract.evaluateTransaction('ReadBank', code as string)
    ).toString();

    res.send(JSON.parse(result));
});

app.get(
    '/transaction',
    async (req: Request, res: Response, _next: NextFunction) => {
        const id = req.query.id;
        if (id == null) res.status(400);

        const result = (
            await contract.evaluateTransaction('ReadTransaction', id as string)
        ).toString();

        res.send(JSON.parse(result));
    }
);

app.post('/bank', async (req: Request, res: Response, _next: NextFunction) => {
    const currencyCode = req.body.currencyCode;
    if (currencyCode == null) res.status(400);

    const result = (
        await contract.submitTransaction('RegisterBank', currencyCode)
    ).toString();

    res.send(JSON.parse(result));
});

app.post(
    '/transaction',
    async (req: Request, res: Response, _next: NextFunction) => {
        // propose transaction
    }
);

app.get('/preflight', (req: Request, res: Response, _next: NextFunction) => {
    // preflight transaction
});

app.post(
    '/approve',
    async (req: Request, res: Response, _next: NextFunction) => {}
);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? '' : err.stack,
    });
});

app.listen(conf.port, () => {
    console.log(`
      ################################################
      🛡️  Server listening on port: ${conf.port}
      ################################################
    `);
});

['SIGINT', 'SIGTERM'].forEach((sig) => {
    process.on(sig, () => {
        // Do some cleanup such as close db
        console.log('program accepted interrupt! getting exited...');
        gateway.disconnect();

        console.log('close succeeded');
        process.exit(0);
    });
});

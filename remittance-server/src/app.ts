import { GatewayOptions } from 'fabric-network';
import { buildCCPOrg, buildWallet } from './utils//AppUtil';
import {
    buildCAClient,
    enrollAdmin,
    registerAndEnrollUser,
} from './utils/CAUtil';
import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import 'express-async-errors';
import { configuration } from './utils/config';
import { router as bankRouter } from './routes/bank';
import { router as transactionRouter } from './routes/transaction';
import { connectGateway } from './utils/connectGateway';

const app = express();

app.use(bodyParser.json());

// gateway init
app.post('/gateway', async (_req: Request, res: Response) => {
    const ccp = buildCCPOrg(configuration.orgNum);
    const caClient = buildCAClient(
        ccp,
        `ca.org${configuration.orgNum}.example.com`
    );
    const wallet = await buildWallet(configuration.walletPath);

    await enrollAdmin(caClient, wallet, configuration.mspOrg);
    await registerAndEnrollUser(
        caClient,
        wallet,
        configuration.mspOrg,
        configuration.userId,
        `org${configuration.orgNum}.department1`
    );

    const gatewayOpts: GatewayOptions = {
        wallet,
        identity: configuration.userId,
        discovery: { enabled: true, asLocalhost: true },
    };

    await connectGateway(
        ccp,
        gatewayOpts,
        configuration.channelName,
        configuration.chaincodeName
    );

    res.status(200);
});

// init chaincode
app.post('/init', async (req: Request, res: Response) => {
    // init chaincode
});

app.use('bank', bankRouter);
app.use('transaction', transactionRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? '' : err.stack,
    });
});

app.listen(configuration.port, () => {
    console.log(`
      ################################################
      🛡️  Server listening on port: ${configuration.port}
      ################################################
    `);
});

['SIGINT', 'SIGTERM'].forEach((sig) => {
    process.on(sig, () => {
        // Do some cleanup such as close db
        console.log('program accepted interrupt! getting exited...');
        configuration.gateway.disconnect();

        console.log('close succeeded');
        process.exit(0);
    });
});

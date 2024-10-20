import { GatewayOptions } from 'fabric-network';
import { buildCCPOrg, buildWallet } from './utils//AppUtil';
import {
    buildCAClient,
    enrollAdmin,
    registerAndEnrollUser,
} from './utils/CAUtil';
import express, { NextFunction, Request, Response } from 'express';
import bodyParser from 'body-parser';
import 'express-async-errors';
import { configuration } from './utils/config';
import { connectGateway } from './utils/connectGateway';

import { router as bankRouter } from './routes/bank';
import { router as transactionRouter } from './routes/transaction';
import { router as authRouter } from './routes/auth';
import { router as accountRouter } from './routes/account';
import { router as userRouter } from './routes/user';

import { authenticateJWT } from './middlewares/jwtAuthenticate';
import { authenticateRole } from './middlewares/roleAuthentocate';
import morgan from 'morgan';

const app = express();

app.use(bodyParser.json());
app.use(morgan('tiny'));

// gateway init
app.post(
    '/gateway',
    authenticateJWT,
    authenticateRole(['ADMIN']),
    async (_req: Request, res: Response) => {
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
    }
);

// init chaincode
app.post(
    '/init',
    authenticateJWT,
    authenticateRole(['ADMIN']),
    async (req: Request, res: Response) => {
        // init chaincode
    }
);

app.use('/auth', authRouter);
app.use('/user', authenticateJWT, userRouter);
app.use('/bank', authenticateJWT, bankRouter);
app.use('/account', authenticateJWT, accountRouter);
app.use('/transaction', authenticateJWT, transactionRouter);

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

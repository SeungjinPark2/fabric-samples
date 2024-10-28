import express, { NextFunction, Request, Response } from 'express';
import bodyParser from 'body-parser';
import 'express-async-errors';
import { configuration } from './utils/config';

import { router as bankRouter } from './routes/bank';
import { router as transactionRouter } from './routes/transaction';
import { router as authRouter } from './routes/auth';
import { router as accountRouter } from './routes/account';
import { router as userRouter } from './routes/user';

import { authenticateJWT } from './middlewares/jwtAuthenticate';
import morgan from 'morgan';
import { init } from './init';

const app = express();

app.use(bodyParser.json());
app.use(morgan('tiny'));

init();

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

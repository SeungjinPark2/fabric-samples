import { NextFunction, Request, Response, Router } from 'express';
import { configuration } from '../utils/config';
import { Contract } from 'fabric-network';
import { txs, users } from '../tempDB';
import { Role, User } from '../model/user';
import { authenticateRole } from '../middlewares/roleAuthentocate';
import { PreflightedTx, TxObject } from '../model/transaction';

export const router = Router();

router.get('', async (req: Request, res: Response, _next: NextFunction) => {
    const filteredTxs = txs.filter(
        (tx) =>
            tx.sender.firstname === req.user?.firstname &&
            tx.sender.lastname === req.user?.lastname
    );

    res.send(filteredTxs);
});

router.get(
    '/status/:status',
    authenticateRole([Role.ADMIN]),
    async (req: Request, res: Response, _next: NextFunction) => {
        const status = parseInt(req.params.status);
        if (!(status === 0 || status === 1 || status === 2)) {
            res.status(400).send();
        }

        const filteredTxs = txs.filter((tx) => tx.status === status);

        res.send(filteredTxs);
    }
);

router.post('', async (req: Request, res: Response, _next: NextFunction) => {
    let result: TxObject;
    try {
        result = JSON.parse(
            (
                await (configuration.contract as Contract).submitTransaction(
                    'ProposeTransaction',
                    JSON.stringify(req.body)
                )
            ).toString()
        );
    } catch (error) {
        throw new Error('Failed to submit transaction');
    }

    txs.push(result);
    res.send(result);
});

router.post(
    '/preflight',
    async (req: Request, res: Response, _next: NextFunction) => {
        // preflight transaction
        const _user = users.find((u) => u.id === req.user?.id) as User;

        const sender = JSON.stringify({
            firstname: _user.firstname,
            lastname: _user.lastname,
            accountNumber: _user.account.accountNumber,
        });

        const receiver = JSON.stringify({
            firstname: req.body.receiver.firstname,
            lastname: req.body.receiver.lastname,
            accountNumber: req.body.receiver.accountNumber,
        });

        const preflightedTx = JSON.parse(
            (
                await (configuration.contract as Contract).evaluateTransaction(
                    'PreflightTx',
                    sender,
                    receiver,
                    req.body.code,
                    req.body.amount
                )
            ).toString()
        ) as PreflightedTx;

        // 본 예제에서는 경로 하나에 대해서만 다루도록 하자.
        const result = {
            sender: preflightedTx.sender,
            receiver: preflightedTx.receiver,
            agreements: preflightedTx.preparedTxs[0],
        };

        res.send(result);
    }
);

router.post(
    '/approve',
    async (req: Request, res: Response, _next: NextFunction) => {}
);

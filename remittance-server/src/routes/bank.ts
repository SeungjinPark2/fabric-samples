import { NextFunction, Request, Response, Router } from 'express';
import { configuration } from '../utils/config';
import { Contract } from 'fabric-network';

export const router = Router();

router.get('', async (_req: Request, res: Response, _next: NextFunction) => {
    const code = configuration.userId;

    const bufferData = JSON.parse(
        (
            await (configuration.contract as Contract).evaluateTransaction(
                'ReadBank',
                code as string
            )
        ).toString()
    );

    const jsonString = Buffer.from(bufferData.data).toString();
    const jsonData = JSON.parse(jsonString);

    res.send(jsonData);
});

router.post(
    '/associate',
    async (req: Request, res: Response, _next: NextFunction) => {
        const code = req.body.code;
        if (code == null) res.status(400);
        const contract = configuration.contract;
        if (contract == null) throw new Error('invalid initialization');

        try {
            await contract.submitTransaction('CreateAccount', code);
        } catch (error) {
            res.status(400).send();
        }

        res.send();
    }
);

import { NextFunction, Request, Response, Router } from 'express';
import { configuration } from '../utils/config';
import { Contract } from 'fabric-network';

export const router = Router();

router.get('', async (req: Request, res: Response, _next: NextFunction) => {
    const code = req.query.code;
    if (code == null) res.status(400);

    const result = (
        await (configuration.contract as Contract).evaluateTransaction(
            'ReadBank',
            code as string
        )
    ).toString();

    res.send(JSON.parse(result));
});

router.post('', async (req: Request, res: Response, _next: NextFunction) => {
    const currencyCode = req.body.currencyCode;
    if (currencyCode == null) res.status(400);

    const result = (
        await (configuration.contract as Contract).submitTransaction(
            'RegisterBank',
            currencyCode
        )
    ).toString();

    res.send(JSON.parse(result));
});

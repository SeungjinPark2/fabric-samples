import { NextFunction, Request, Response, Router } from 'express';
import { configuration } from '../utils/config';
import { Contract } from 'fabric-network';

export const router = Router();

router.get(
    '/transaction',
    async (req: Request, res: Response, _next: NextFunction) => {
        const id = req.query.id;
        if (id == null) res.status(400);

        const result = (
            await (configuration.contract as Contract).evaluateTransaction(
                'ReadTransaction',
                id as string
            )
        ).toString();

        res.send(JSON.parse(result));
    }
);
router.post(
    '/transaction',
    async (req: Request, res: Response, _next: NextFunction) => {
        // propose transaction
    }
);

router.post(
    '/preflight',
    (req: Request, res: Response, _next: NextFunction) => {
        // preflight transaction
    }
);

router.post(
    '/approve',
    async (req: Request, res: Response, _next: NextFunction) => {}
);

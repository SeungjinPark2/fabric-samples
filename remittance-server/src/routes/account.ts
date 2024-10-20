import { Request, Response, Router } from 'express';
import { users } from '../tempDB';
import { User } from '../model/user';

export const router = Router();

router.get('/', (req: Request, res: Response) => {
    const user = users.find(
        (u) => u.username == (req.user as User).username
    ) as User;
    res.send(user.account);
});

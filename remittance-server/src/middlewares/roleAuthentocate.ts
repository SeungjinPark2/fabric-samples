import { NextFunction, Request, Response } from 'express';
import { Role } from '../model/user';

export const authenticateRole = (roles: Role[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = req.user?.role;

        if (!userRole || !roles.includes(userRole)) {
            return res
                .status(403)
                .json({ message: 'Access forbidden: insufficient privileges' });
        }

        next(); // 권한이 있는 경우 다음 미들웨어 또는 라우트 핸들러로 진행
    };
};

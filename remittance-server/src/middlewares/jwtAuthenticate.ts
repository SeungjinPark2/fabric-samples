import jwt from 'jsonwebtoken';
import { configuration } from '../utils/config';
import { NextFunction, Request, Response } from 'express';
import { User } from '../model/user';

export const authenticateJWT = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access Token Required' });
    }

    try {
        const decoded = jwt.verify(token, configuration.jwtsecret) as User;
        req.user = decoded; // 토큰의 페이로드 데이터를 req 객체에 저장
        next(); // 다음 미들웨어 또는 라우트로 진행
    } catch (error) {
        console.log(error);
        return res.status(403).json({ message: 'Invalid Token' });
    }
};

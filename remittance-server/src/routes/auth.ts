import { Request, Response, Router } from 'express';
import { configuration } from '../utils/config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { users } from '../tempDB';
import { Role } from '../model/user';

export const router = Router();

router.post('/signup', async (req: Request, res: Response) => {
    const { username, password, firstName, lastName } = req.body; // TODO fix "Name" things..

    // 유저가 이미 존재하는지 확인
    const existingUser = users.find((user) => user.username === username);
    if (existingUser) {
        return res.status(409).json({ message: 'Username already exists' });
    }

    // 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 새로운 유저 추가
    const newUser = {
        id: users.length + 1,
        username,
        password: hashedPassword,
        role: Role.USER,
        firstname: firstName,
        lastname: lastName,
        account: {
            balance: 1000000,
            accountNumber: Math.round(Math.random() * 10000000),
        },
    };
    users.push(newUser);

    res.status(201).json({ message: 'User created successfully' });
});

router.post('/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;

    // 유저 찾기
    const user = users.find((user) => user.username === username);
    if (!user) {
        return res
            .status(401)
            .json({ message: 'Invalid username or password' });
    }

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res
            .status(401)
            .json({ message: 'Invalid username or password' });
    }

    // JWT 토큰 발급
    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        configuration.jwtsecret,
        {
            expiresIn: '12h',
        }
    );

    res.json({ token });
});

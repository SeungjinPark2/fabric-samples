import bcrypt from 'bcryptjs';
import { Role, User } from './model/user';
import { TxObject } from './model/transaction';

// 본 프로젝트에서는 데이터 영속성이 주된 관심사가 아니기 때문에, 인메모리 형태로 진행한다.
// 데이터 영속성을 위한 DB 커넥트는 고도화 영역으로 분리하도록 한다.
export const users: User[] = [];
export const txs: TxObject[] = [];

const initDemoUsers = async () => {
    const hashedPassword = await bcrypt.hash('1234', 10);
    const userTemplates = [
        {
            username: 'adminUser',
            firstname: 'ZEROM',
            lastname: 'MORROW',
            role: Role.ADMIN,
        },
        {
            username: 'park',
            firstname: 'PARK',
            lastname: 'SEUNGJIN',
            role: Role.USER,
        },
        {
            username: 'mike',
            firstname: 'MIKE',
            lastname: 'WILLIAMS',
            role: Role.USER,
        },
        {
            username: 'jose',
            firstname: 'JOSE',
            lastname: 'PAKO',
            role: Role.USER,
        },
    ];

    userTemplates.forEach((template, idx) => {
        users.push({
            id: idx,
            password: hashedPassword,
            ...template,
            account: {
                balance: 1000000,
                accountNumber: Math.round(Math.random() * 10000000),
            },
        });
    });
};

initDemoUsers();

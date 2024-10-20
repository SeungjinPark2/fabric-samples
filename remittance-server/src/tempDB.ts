import bcrypt from 'bcryptjs';
import { Role, User } from './model/user';

// 본 프로젝트에서는 데이터 영속성이 주된 관심사가 아니기 때문에, 인메모리 형태로 진행한다.
// 데이터 영속성을 위한 DB 커넥트는 고도화 영역으로 분리하도록 한다.
export const users: User[] = [];

const initDemoUsers = async () => {
    const hashedPassword = await bcrypt.hash('1234', 10);

    const demoAdmin: User = {
        id: users.length + 1,
        username: 'adminUser',
        firstname: 'PARK',
        lastname: 'SEUNGJIN',
        password: hashedPassword,
        role: 'ADMIN' as Role,
        account: {
            balance: 1000000,
            accountNumber: Math.round(Math.random() * 10000000),
        },
    };

    const demoUser = {
        id: users.length + 1,
        username: 'park',
        firstname: 'PARK',
        lastname: 'SEUNGJIN',
        password: hashedPassword,
        role: 'USER' as Role,
        account: {
            balance: 1000000,
            accountNumber: Math.round(Math.random() * 10000000),
        },
    };

    users.push(demoAdmin);
    users.push(demoUser);
};

initDemoUsers();

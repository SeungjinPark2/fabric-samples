import { Account } from './account';

export type User = {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    password: string;
    role: Role;
    account: Account;
};

export type Role = 'USER' | 'ADMIN';

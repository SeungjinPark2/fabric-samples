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

export type SimplifiedUserInfo = {
    firstname: string;
    lastname: string;
    accountNumber: string;
};

export enum Role {
    USER = 'USER',
    ADMIN = 'ADMIN',
}

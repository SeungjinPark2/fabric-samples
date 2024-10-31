import { SimplifiedUserInfo } from './user';

export enum Status {
    ONGOING,
    DONE,
    REJECTED,
}

export interface BaseTx {
    sender: SimplifiedUserInfo;
    receiver: SimplifiedUserInfo;
}

export interface PreflightedTx extends BaseTx {
    preparedTxs: AgreementBase[][];
}

export interface TxObject extends BaseTx {
    id: string;
    status: Status;
    agreements: Agreement[];
}

interface AgreementBase {
    code: string;
    currencyCode: string;
    collectedFee: string;
    amount: string;
}

interface Agreement extends AgreementBase {
    status: Status;
}

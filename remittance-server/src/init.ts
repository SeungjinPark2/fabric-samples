import { ContractListener, GatewayOptions } from 'fabric-network';
import { buildCCPOrg, buildWallet } from './utils/AppUtil';
import {
    buildCAClient,
    enrollAdmin,
    registerAndEnrollUser,
} from './utils/CAUtil';
import { configuration } from './utils/config';
import { connectGateway } from './utils/connectGateway';
import { txs, users } from './tempDB';
import { Status, TxObject } from './model/transaction';
import { User } from './model/user';
import BigNumber from 'bignumber.js';

export const init = async () => {
    const ccp = buildCCPOrg(configuration.orgNum);
    const caClient = buildCAClient(
        ccp,
        `ca.org${configuration.orgNum}.example.com`
    );
    const wallet = await buildWallet(configuration.walletPath);

    await enrollAdmin(caClient, wallet, configuration.mspOrg);
    await registerAndEnrollUser(
        caClient,
        wallet,
        configuration.mspOrg,
        configuration.userId,
        `org${configuration.orgNum}.department1`
    );

    const gatewayOpts: GatewayOptions = {
        wallet,
        identity: configuration.userId,
        discovery: {
            enabled: true,
            asLocalhost: process.env.NODE_ENV !== 'prod',
        },
    };

    await connectGateway(
        ccp,
        gatewayOpts,
        configuration.channelName,
        configuration.chaincodeName
    );

    const contract = configuration.contract;
    if (contract == null) {
        console.log(
            'can not load contract object, maybe something wrong while initializing gateway.'
        );
        return;
    }
    const result = await contract.submitTransaction(
        'Init',
        configuration.fxRateAPIToken, // api token
        configuration.fxRateAPIEnpoint, // api endpoint
        '0.01' // fee
    );

    console.log(`init done - ${result.toString()}`);

    try {
        const registered = await contract.submitTransaction(
            'RegisterBank',
            configuration.currencyCode
        );
        console.log(`register done - ${registered}`);
    } catch (error) {
        console.log(error);
    }

    // 체인코드 이벤트 리스너등록
    const listener: ContractListener = async (event) => {
        const eventPayload: TxObject = JSON.parse(
            (event.payload as Buffer).toString('utf8')
        );

        if (event.eventName === 'txCreated') {
            txs.push(eventPayload);
        }

        if (event.eventName === 'txApproved') {
            const idx = txs.findIndex((tx) => tx.id === eventPayload.id);
            txs[idx] = eventPayload;

            // 반영하기
            if (eventPayload.status === Status.DONE) {
                const index = eventPayload.agreements.findIndex((agreement) => {
                    return agreement.code === configuration.userId;
                });

                // 중개 은행은 해당 은행의 양측 은행 계좌부분을 반영해주어야 하는 것이 정상이다.
                // 보여주기 용도, 프로토타입이므로 해당 부분은 건너뛰고 전송자와 수신자의 잔고만 처리해주도록 하자.
                if (index === 0) {
                    const sender = users.find(
                        (u) =>
                            u.firstname === eventPayload.sender.firstname &&
                            u.lastname === eventPayload.sender.lastname
                    ) as User;
                    let balance = new BigNumber(sender.account.balance)
                        .minus(eventPayload.agreements[index].amount)
                        .minus(eventPayload.agreements[index].collectedFee);
                    sender.account.balance = balance
                        .decimalPlaces(0, 1)
                        .toNumber();
                } else if (index === eventPayload.agreements.length - 1) {
                    const receiver = users.find(
                        (u) =>
                            u.firstname === eventPayload.receiver.firstname &&
                            u.lastname === eventPayload.receiver.lastname
                    ) as User;
                    let balance = new BigNumber(receiver.account.balance).plus(
                        eventPayload.agreements[index].amount
                    );
                    receiver.account.balance = balance
                        .decimalPlaces(0, 1)
                        .toNumber();
                }
            }
        }
    };

    await contract.addContractListener(listener);
};

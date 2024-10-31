import { ContractListener, GatewayOptions } from 'fabric-network';
import { buildCCPOrg, buildWallet } from './utils/AppUtil';
import {
    buildCAClient,
    enrollAdmin,
    registerAndEnrollUser,
} from './utils/CAUtil';
import { configuration } from './utils/config';
import { connectGateway } from './utils/connectGateway';
import { txs } from './tempDB';
import { TxObject } from './model/transaction';

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
            console.log(eventPayload);
            txs.push(eventPayload);
        }

        if (event.eventName === 'txApproved') {
            const idx = txs.findIndex((tx) => tx.id === eventPayload.id);
            txs[idx] = eventPayload;
        }
    };

    await contract.addContractListener(listener);
};

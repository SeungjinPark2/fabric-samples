'use strict';
const sinon = require('sinon');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const { describe, it, before } = require('mocha');
const expect = chai.expect;

const { Context } = require('fabric-contract-api');
const { ChaincodeStub, ClientIdentity } = require('fabric-shim');

const Remittance = require('../lib/remittance.js');
const { banks, preparedTx, sender, receiver } = require('./utils/mock.json');
const { fakeChaincodeStub, prank } = require('./utils/index.js');
chai.use(sinonChai);

describe('Remittance Tests', () => {
    // TEST vars
    let transactionContext;
    let chaincodeStub;
    let clientIdentity;
    let remittance;

    let txId;

    before(async () => {
        transactionContext = new Context();

        chaincodeStub = sinon.createStubInstance(ChaincodeStub);
        clientIdentity = sinon.createStubInstance(ClientIdentity);
        transactionContext.setChaincodeStub(chaincodeStub);
        transactionContext.setClientIdentity(clientIdentity);
        remittance = new Remittance();

        fakeChaincodeStub(chaincodeStub);

        for (const bank of banks) {
            prank(clientIdentity, bank.code);
            await remittance.RegisterBank(
                transactionContext,
                bank.currencyCode
            );
        }

        for (let i = 0; i < banks.length - 1; i++) {
            prank(clientIdentity, banks[i].code);
            await remittance.CreateAccount(
                transactionContext,
                banks[i + 1].currencyCode
            );
        }
    });

    // describe('PreflightTx', () => {
    //     it('should work without error', async () => {
    //         prank(clientIdentity, banks[2].code);
    //         await remittance.RegisterBank(
    //             transactionContext,
    //             banks[2].currencyCode
    //         );

    //         prank(clientIdentity, banks[1].code);
    //         await remittance.CreateAccount(transactionContext, banks[2].code);

    //         prank(clientIdentity, banks[0].code);
    //         const txs = await remittance.PreflightTx(
    //             transactionContext,
    //             banks[2].code,
    //             10000 // 10000원
    //         );

    //         console.dir(txs, { depth: null });
    //     });
    // });

    describe('ProposeTransaction', () => {
        it('should work without error', async () => {
            prank(clientIdentity, banks[0].code);
            const txObject = {
                sender,
                receiver,
                agreements: preparedTx,
            };
            const ret = JSON.parse(
                await remittance.ProposeTransaction(
                    transactionContext,
                    txObject
                )
            );
            console.dir(ret, { depth: null });
            txId = ret.id;
        });
    });

    describe('ApproveTransaction', () => {
        it('should work without error', async () => {
            prank(clientIdentity, banks[1].code);
            const ret = JSON.parse(
                await remittance.ApproveTransaction(
                    transactionContext,
                    txId,
                    'approve'
                )
            );
            console.dir(ret, { depth: null });
        });
    });

    describe('ApproveTransaction', () => {
        it('should make tx status done', async () => {
            prank(clientIdentity, banks[2].code);
            const ret = JSON.parse(
                await remittance.ApproveTransaction(
                    transactionContext,
                    txId,
                    'approve'
                )
            );
            expect(ret.status).eql(1);
        });
    });

    describe('ApproveTransaction', () => {
        it('should make tx status rejected', async () => {
            prank(clientIdentity, banks[0].code);
            const txObject = {
                sender,
                receiver,
                agreements: preparedTx,
            };
            let ret = JSON.parse(
                await remittance.ProposeTransaction(
                    transactionContext,
                    txObject
                )
            );
            txId = ret.id;
            prank(clientIdentity, banks[1].code);

            ret = JSON.parse(
                await remittance.ApproveTransaction(
                    transactionContext,
                    txId,
                    'reject',
                    'invalid fee'
                )
            );
            expect(ret.status).eql(2);
            expect(ret.reason).eql('invalid fee');
        });
    });
});

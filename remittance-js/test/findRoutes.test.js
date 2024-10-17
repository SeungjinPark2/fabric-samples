'use strict';
const sinon = require('sinon');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const { describe, it, beforeEach } = require('mocha');
const expect = chai.expect;

const { Context } = require('fabric-contract-api');
const { ChaincodeStub, ClientIdentity } = require('fabric-shim');

const Remittance = require('../lib/remittance.js');
const { banks } = require('./utils/mock.json');
const { fakeChaincodeStub, prank } = require('./utils/index.js');
chai.use(sinonChai);

describe('Remittance Tests', () => {
    // TEST vars
    let transactionContext;
    let chaincodeStub;
    let clientIdentity;
    let remittance;

    beforeEach(async () => {
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
    });

    describe('FindRoutes', () => {
        it('should not find any routes', async () => {
            prank(clientIdentity, banks[0].code);
            const routes = [];

            await remittance.FindRoutes(
                transactionContext,
                banks[1].code,
                routes,
                [banks[0].code]
            );
            expect(routes).eql([]);
        });

        it('should find one route', async () => {
            prank(clientIdentity, banks[0].code);
            await remittance.CreateAccount(transactionContext, banks[1].code);
            await remittance.CreateAccount(transactionContext, banks[3].code);

            prank(clientIdentity, banks[1].code);
            await remittance.CreateAccount(transactionContext, banks[0].code);
            await remittance.CreateAccount(transactionContext, banks[2].code);

            prank(clientIdentity, banks[3].code);
            await remittance.CreateAccount(transactionContext, banks[0].code);
            await remittance.CreateAccount(transactionContext, banks[4].code);

            prank(clientIdentity, banks[4].code);
            await remittance.CreateAccount(transactionContext, banks[5].code);

            const routes = [];

            await remittance.FindRoutes(
                transactionContext,
                banks[5].code,
                routes,
                [banks[0].code],
                4
            );

            expect(routes).eql([
                [banks[0].code, banks[3].code, banks[4].code, banks[5].code],
            ]);
        });

        it('should find two route', async () => {
            prank(clientIdentity, banks[0].code);
            await remittance.CreateAccount(transactionContext, banks[1].code);
            await remittance.CreateAccount(transactionContext, banks[3].code);

            prank(clientIdentity, banks[1].code);
            await remittance.CreateAccount(transactionContext, banks[0].code);
            await remittance.CreateAccount(transactionContext, banks[2].code);
            await remittance.CreateAccount(transactionContext, banks[5].code);

            prank(clientIdentity, banks[3].code);
            await remittance.CreateAccount(transactionContext, banks[0].code);
            await remittance.CreateAccount(transactionContext, banks[4].code);

            prank(clientIdentity, banks[4].code);
            await remittance.CreateAccount(transactionContext, banks[5].code);

            const routes = [];

            await remittance.FindRoutes(
                transactionContext,
                banks[5].code,
                routes,
                [banks[0].code],
                4
            );

            expect(routes).eql([
                [banks[0].code, banks[1].code, banks[5].code],
                [banks[0].code, banks[3].code, banks[4].code, banks[5].code],
            ]);
        });

        it('should find three route', async () => {
            prank(clientIdentity, banks[0].code);
            await remittance.CreateAccount(transactionContext, banks[1].code);
            await remittance.CreateAccount(transactionContext, banks[3].code);

            prank(clientIdentity, banks[1].code);
            await remittance.CreateAccount(transactionContext, banks[0].code);
            await remittance.CreateAccount(transactionContext, banks[2].code);
            await remittance.CreateAccount(transactionContext, banks[5].code);

            prank(clientIdentity, banks[3].code);
            await remittance.CreateAccount(transactionContext, banks[0].code);
            await remittance.CreateAccount(transactionContext, banks[4].code);
            await remittance.CreateAccount(transactionContext, banks[5].code);

            prank(clientIdentity, banks[4].code);
            await remittance.CreateAccount(transactionContext, banks[5].code);

            const routes = [];

            await remittance.FindRoutes(
                transactionContext,
                banks[5].code,
                routes,
                [banks[0].code],
                4
            );

            expect(routes).eql([
                [banks[0].code, banks[1].code, banks[5].code],
                [banks[0].code, banks[3].code, banks[4].code, banks[5].code],
                [banks[0].code, banks[3].code, banks[5].code],
            ]);
        });
    });
});

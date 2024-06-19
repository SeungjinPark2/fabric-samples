#!/bin/bash

curl -X POST localhost:3001/bank -d '{"currencyCode": "USD"}' -H 'Content-Type: application/json'
curl -X POST localhost:3000/bank -d '{"currencyCode": "KRW"}' -H 'Content-Type: application/json'

curl localhost:3000/account -d '{"code": "tempuser2"}' -H 'Content-Type: application/json'
curl localhost:3001/account -d '{"code": "tempuser"}' -H 'Content-Type: application/json'

curl localhost:3000/liquidity -d '{"code": "tempuser2", "liquidity": "10000"}' -H 'Content-Type: application/json'
curl localhost:3001/liquidity -d '{"code": "tempuser", "liquidity": "100"}' -H 'Content-Type: application/json'

# curl localhost:3000/transaction -d @tx.json -H 'Content-Type: application/json'


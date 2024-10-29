#!/bin/bash

./network.sh down
./network.sh up createChannel -ca
./network.sh deployCC -ccn remittance -ccp ../remittance-js -ccl javascript

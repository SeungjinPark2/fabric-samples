#!/bin/bash

IMAGE=$1
PORT=$2

docker run -it \
    --name $IMAGE \
    --rm \
    -e NODE_ENV=prod \
    -p $PORT:3000 \
    -v $(pwd)/src/wallet/:/opt/dist/wallet/ \
    --network fabric_test \
    $IMAGE
    
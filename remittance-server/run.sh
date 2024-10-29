#!/bin/bash

IMAGE=$1
NAME=$2

docker run -it \
    --rm \
    --name $NAME \
    -e NODE_ENV=prod \
    --network fabric_test \
    $IMAGE
    
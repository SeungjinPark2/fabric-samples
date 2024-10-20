#!/bin/bash

IMAGE=$1
NAME=$2

docker run -it \
    --rm \
    --name $NAME \
    -d \
    --network host \
    -v $(pwd)/../test-network/organizations/peerOrganizations:/opt/peerOrganizations \
    $IMAGE
    
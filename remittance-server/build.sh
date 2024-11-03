#!/bin/bash

./build-ccp.sh

cp .env.krbank .env
docker build -t krbank .

cp .env.usbank .env
docker build -t usbank .

cp .env.mxbank .env
docker build -t mxbank .

cp .env.krbank .env

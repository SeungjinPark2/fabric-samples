#!/bin/bash

# 파일 번호 목록 배열 정의 (필요에 따라 확장 가능)
BASE="../test-network/organizations/peerOrganizations"

numbers=(1 2)

for number in "${numbers[@]}"; do
  # 원본 JSON 파일 경로
  SOURCE_FILE="${BASE}/org${number}.example.com/connection-org${number}.json"
  
  DEST_FILE="./ccp/prod/connection-org${number}.json"
  # jq 명령을 사용하여 URL 수정
  jq --arg peer_url "peer0.org${number}.example.com" \
      --arg ca_url "ca_org${number}" \
      '
      .peers[$peer_url].url |= gsub("localhost"; $peer_url) |
      .certificateAuthorities["ca.org'${number}'.example.com"].url |= gsub("localhost"; $ca_url)
      ' "$SOURCE_FILE" > "$DEST_FILE"
  
  echo "Processed $DEST_FILE - prod"

  DEST_FILE="./ccp/dev/connection-org${number}.json"
  cp $SOURCE_FILE $DEST_FILE

  echo "Processed $DEST_FILE - dev"
done
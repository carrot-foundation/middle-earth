#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/news-digest-pipeline"

echo "Logging in to ECR..."
aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "Tagging image..."
docker tag news-digest-pipeline:latest "${ECR_REPO}:latest"

echo "Pushing to ECR..."
docker push "${ECR_REPO}:latest"

echo "Done. Image pushed to ${ECR_REPO}:latest"

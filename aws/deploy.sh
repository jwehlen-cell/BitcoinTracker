#!/bin/bash

# Bitcoin Tracker - AWS Deployment Script
# This script automates the deployment of the Bitcoin Tracker application to AWS

set -e

# Configuration
APP_NAME="bitcoin-tracker"
AWS_REGION="us-east-1"
CLUSTER_NAME="bitcoin-tracker-cluster"
SERVICE_NAME="bitcoin-tracker-service"
ECR_REPO_NAME="bitcoin-tracker"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if AWS CLI is installed
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    print_success "AWS CLI is installed"
}

# Function to check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi
    print_success "Docker is installed"
}

# Function to get AWS account ID
get_aws_account_id() {
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    if [ $? -eq 0 ]; then
        print_success "AWS Account ID: $AWS_ACCOUNT_ID"
    else
        print_error "Failed to get AWS Account ID. Please check your AWS credentials."
        exit 1
    fi
}

# Function to create ECR repository
create_ecr_repository() {
    print_status "Creating ECR repository..."
    
    aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region $AWS_REGION &> /dev/null
    if [ $? -eq 0 ]; then
        print_warning "ECR repository $ECR_REPO_NAME already exists"
    else
        aws ecr create-repository --repository-name $ECR_REPO_NAME --region $AWS_REGION
        if [ $? -eq 0 ]; then
            print_success "ECR repository created: $ECR_REPO_NAME"
        else
            print_error "Failed to create ECR repository"
            exit 1
        fi
    fi
}

# Function to build and push Docker image
build_and_push_image() {
    print_status "Building Docker image..."
    
    # Build the image
    docker build -t $ECR_REPO_NAME:latest .
    if [ $? -eq 0 ]; then
        print_success "Docker image built successfully"
    else
        print_error "Failed to build Docker image"
        exit 1
    fi
    
    # Login to ECR
    print_status "Logging in to ECR..."
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
    
    # Tag the image
    docker tag $ECR_REPO_NAME:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:latest
    
    # Push the image
    print_status "Pushing image to ECR..."
    docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:latest
    if [ $? -eq 0 ]; then
        print_success "Image pushed to ECR successfully"
    else
        print_error "Failed to push image to ECR"
        exit 1
    fi
}

# Function to deploy CloudFormation stack
deploy_cloudformation() {
    print_status "Deploying CloudFormation stack..."
    
    STACK_NAME="bitcoin-tracker-stack"
    
    # Get default VPC ID
    VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query 'Vpcs[0].VpcId' --output text --region $AWS_REGION)
    
    # Get subnet IDs
    SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[].SubnetId' --output text --region $AWS_REGION | tr '\t' ',')
    
    # Deploy the stack
    aws cloudformation deploy \
        --template-file aws/cloudformation-template.json \
        --stack-name $STACK_NAME \
        --parameter-overrides \
            VpcId=$VPC_ID \
            SubnetIds=$SUBNET_IDS \
            ImageUri=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME:latest \
        --capabilities CAPABILITY_NAMED_IAM \
        --region $AWS_REGION
    
    if [ $? -eq 0 ]; then
        print_success "CloudFormation stack deployed successfully"
        
        # Get the load balancer URL
        LB_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerURL`].OutputValue' --output text --region $AWS_REGION)
        print_success "Application URL: $LB_URL"
    else
        print_error "Failed to deploy CloudFormation stack"
        exit 1
    fi
}

# Function to update ECS service
update_service() {
    print_status "Updating ECS service..."
    
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --force-new-deployment \
        --region $AWS_REGION
    
    if [ $? -eq 0 ]; then
        print_success "ECS service updated successfully"
    else
        print_error "Failed to update ECS service"
        exit 1
    fi
}

# Function to show deployment status
show_status() {
    print_status "Checking deployment status..."
    
    # Check ECS service status
    aws ecs describe-services \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME \
        --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}' \
        --output table \
        --region $AWS_REGION
}

# Main deployment function
main() {
    print_status "Starting Bitcoin Tracker deployment to AWS..."
    
    # Check prerequisites
    check_aws_cli
    check_docker
    get_aws_account_id
    
    # Build and deploy
    create_ecr_repository
    build_and_push_image
    
    # Check if this is an initial deployment or update
    aws ecs describe-clusters --clusters $CLUSTER_NAME --region $AWS_REGION &> /dev/null
    if [ $? -eq 0 ]; then
        print_status "Cluster exists, updating service..."
        update_service
    else
        print_status "Creating new deployment..."
        deploy_cloudformation
    fi
    
    # Show status
    show_status
    
    print_success "Deployment completed!"
    print_status "Your Bitcoin Tracker application is now running on AWS."
    print_status "It may take a few minutes for the load balancer to become available."
}

# Help function
show_help() {
    echo "Bitcoin Tracker AWS Deployment Script"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  deploy     Deploy the application (default)"
    echo "  status     Show deployment status"
    echo "  logs       Show application logs"
    echo "  help       Show this help message"
    echo ""
    echo "Prerequisites:"
    echo "  - AWS CLI installed and configured"
    echo "  - Docker installed"
    echo "  - Proper AWS permissions for ECS, ECR, CloudFormation, etc."
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "status")
        show_status
        ;;
    "logs")
        print_status "Fetching logs..."
        aws logs tail "/ecs/bitcoin-tracker" --follow --region $AWS_REGION
        ;;
    "help")
        show_help
        ;;
    *)
        print_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac
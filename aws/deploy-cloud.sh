#!/bin/bash

# Bitcoin Mining Tracker - AWS Cloud Deployment Script
# This script deploys the application to AWS without requiring local Docker

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="bitcoin-tracker"
REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${APP_NAME}-stack"
ECR_REPO_NAME="${APP_NAME}"
CODEBUILD_PROJECT="${APP_NAME}-build"

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

# Function to check if AWS CLI is configured
check_aws_cli() {
    print_status "Checking AWS CLI configuration..."
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first:"
        echo "  brew install awscli"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Please run:"
        echo "  aws configure"
        exit 1
    fi
    
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    print_success "AWS CLI configured for account: $AWS_ACCOUNT_ID"
}

# Function to get VPC and subnets
get_vpc_info() {
    print_status "Getting VPC information..."
    
    # Use environment variables if provided, otherwise get default VPC
    if [ -n "$VPC_ID" ] && [ -n "$SUBNET_IDS" ]; then
        print_status "Using provided VPC and subnets from environment variables"
    else
        print_status "Looking for default VPC..."
        VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query 'Vpcs[0].VpcId' --output text --region $REGION)
        
        if [ "$VPC_ID" = "None" ] || [ -z "$VPC_ID" ]; then
            print_error "No default VPC found. Checking for bitcoin-tracker VPC..."
            
            # Try to get VPC from our CloudFormation stack
            VPC_ID=$(aws cloudformation describe-stacks --stack-name bitcoin-tracker-vpc --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`VpcId`].OutputValue' --output text 2>/dev/null || echo "")
            
            if [ -z "$VPC_ID" ]; then
                print_error "No VPC found. Please run: aws cloudformation deploy --template-file aws/vpc-template.json --stack-name bitcoin-tracker-vpc --region $REGION"
                exit 1
            fi
            
            # Get subnets from CloudFormation stack
            SUBNET1=$(aws cloudformation describe-stacks --stack-name bitcoin-tracker-vpc --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet1Id`].OutputValue' --output text)
            SUBNET2=$(aws cloudformation describe-stacks --stack-name bitcoin-tracker-vpc --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet2Id`].OutputValue' --output text)
            SUBNET_IDS="$SUBNET1,$SUBNET2"
        else
            SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[*].SubnetId' --output text --region $REGION | tr '\t' ',')
        fi
    fi
    
    if [ -z "$SUBNET_IDS" ]; then
        print_error "No subnets found."
        exit 1
    fi
    
    print_success "Using VPC: $VPC_ID"
    print_success "Using Subnets: $SUBNET_IDS"
}

# Function to create ECR repository
create_ecr_repo() {
    print_status "Creating ECR repository..."
    
    # Check if repository already exists
    if aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region $REGION &> /dev/null; then
        print_warning "ECR repository '$ECR_REPO_NAME' already exists"
    else
        aws ecr create-repository \
            --repository-name $ECR_REPO_NAME \
            --region $REGION \
            --image-scanning-configuration scanOnPush=true > /dev/null
        print_success "ECR repository '$ECR_REPO_NAME' created"
    fi
    
    ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_NAME"
    print_success "ECR URI: $ECR_URI"
}

# Function to create CodeBuild project
create_codebuild_project() {
    print_status "Creating CodeBuild project..."
    
    # Create service role for CodeBuild
    cat > /tmp/codebuild-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "codebuild.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    cat > /tmp/codebuild-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:GetAuthorizationToken",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload",
                "ecr:PutImage"
            ],
            "Resource": "*"
        }
    ]
}
EOF

    # Create IAM role if it doesn't exist
    ROLE_NAME="${APP_NAME}-codebuild-role"
    if ! aws iam get-role --role-name $ROLE_NAME --region $REGION &> /dev/null; then
        aws iam create-role \
            --role-name $ROLE_NAME \
            --assume-role-policy-document file:///tmp/codebuild-trust-policy.json \
            --region $REGION > /dev/null
        
        aws iam put-role-policy \
            --role-name $ROLE_NAME \
            --policy-name "${APP_NAME}-codebuild-policy" \
            --policy-document file:///tmp/codebuild-policy.json \
            --region $REGION
        
        print_success "CodeBuild IAM role created"
        sleep 10  # Wait for role to be available
    else
        print_warning "CodeBuild IAM role already exists"
    fi
    
    ROLE_ARN="arn:aws:iam::$AWS_ACCOUNT_ID:role/$ROLE_NAME"
    
    # Create buildspec.yml content
    cat > /tmp/buildspec-cloud.yml << EOF
version: 0.2

phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI
      - echo Build started on \`date\`
      - IMAGE_TAG=\${CODEBUILD_RESOLVED_SOURCE_VERSION:-latest}
  build:
    commands:
      - echo Building the Docker image...
      - docker build -t $ECR_REPO_NAME:\$IMAGE_TAG .
      - docker tag $ECR_REPO_NAME:\$IMAGE_TAG $ECR_URI:\$IMAGE_TAG
      - docker tag $ECR_REPO_NAME:\$IMAGE_TAG $ECR_URI:latest
  post_build:
    commands:
      - echo Build completed on \`date\`
      - echo Pushing the Docker images...
      - docker push $ECR_URI:\$IMAGE_TAG
      - docker push $ECR_URI:latest
      - echo Writing image definitions file...
      - printf '[{"name":"bitcoin-tracker","imageUri":"%s"}]' $ECR_URI:latest > imagedefinitions.json

artifacts:
  files:
    - imagedefinitions.json
EOF

    # Create CodeBuild project
    if ! aws codebuild batch-get-projects --names $CODEBUILD_PROJECT --region $REGION &> /dev/null; then
        aws codebuild create-project \
            --name $CODEBUILD_PROJECT \
            --source type=NO_SOURCE,buildspec=file:///tmp/buildspec-cloud.yml \
            --artifacts type=NO_ARTIFACTS \
            --environment type=LINUX_CONTAINER,image=aws/codebuild/amazonlinux2-x86_64-standard:5.0,computeType=BUILD_GENERAL1_MEDIUM,privilegedMode=true \
            --service-role $ROLE_ARN \
            --region $REGION > /dev/null
        
        print_success "CodeBuild project '$CODEBUILD_PROJECT' created"
    else
        print_warning "CodeBuild project already exists"
    fi
    
    # Clean up temp files
    rm -f /tmp/codebuild-trust-policy.json /tmp/codebuild-policy.json /tmp/buildspec-cloud.yml
}

# Function to upload source code and build image
build_image_in_cloud() {
    print_status "Creating source archive..."
    
    # Create a zip file with the source code
    zip -r /tmp/bitcoin-tracker-source.zip . -x "*.git*" "node_modules/*" ".env*" "*.log" > /dev/null
    
    # Create S3 bucket for source code (if needed)
    BUCKET_NAME="${APP_NAME}-source-${AWS_ACCOUNT_ID}"
    if ! aws s3 ls "s3://$BUCKET_NAME" --region $REGION &> /dev/null; then
        if [ "$REGION" = "us-east-1" ]; then
            aws s3 mb "s3://$BUCKET_NAME" --region $REGION > /dev/null
        else
            aws s3 mb "s3://$BUCKET_NAME" --region $REGION --create-bucket-configuration LocationConstraint=$REGION > /dev/null
        fi
        print_success "S3 bucket '$BUCKET_NAME' created"
    fi
    
    # Upload source code to S3
    aws s3 cp /tmp/bitcoin-tracker-source.zip "s3://$BUCKET_NAME/source.zip" --region $REGION > /dev/null
    print_success "Source code uploaded to S3"
    
    # Update CodeBuild project to use S3 source
    aws codebuild update-project \
        --name $CODEBUILD_PROJECT \
        --source type=S3,location="$BUCKET_NAME/source.zip" \
        --region $REGION > /dev/null
    
    # Start build
    print_status "Starting CodeBuild to build Docker image..."
    BUILD_ID=$(aws codebuild start-build \
        --project-name $CODEBUILD_PROJECT \
        --environment-variables-override name=ECR_URI,value=$ECR_URI name=ECR_REPO_NAME,value=$ECR_REPO_NAME name=AWS_DEFAULT_REGION,value=$REGION \
        --query 'build.id' \
        --output text \
        --region $REGION)
    
    print_status "Build started with ID: $BUILD_ID"
    print_status "Waiting for build to complete (this may take 5-10 minutes)..."
    
    # Wait for build to complete
    while true; do
        BUILD_STATUS=$(aws codebuild batch-get-builds \
            --ids $BUILD_ID \
            --query 'builds[0].buildStatus' \
            --output text \
            --region $REGION)
        
        case $BUILD_STATUS in
            "SUCCEEDED")
                print_success "Docker image built successfully!"
                break
                ;;
            "FAILED"|"FAULT"|"STOPPED"|"TIMED_OUT")
                print_error "Build failed with status: $BUILD_STATUS"
                print_error "Check CodeBuild logs in AWS Console for details"
                exit 1
                ;;
            "IN_PROGRESS")
                echo -n "."
                sleep 15
                ;;
        esac
    done
    
    # Clean up
    rm -f /tmp/bitcoin-tracker-source.zip
    
    IMAGE_URI="$ECR_URI:latest"
    print_success "Image built and pushed: $IMAGE_URI"
}

# Function to deploy CloudFormation stack
deploy_stack() {
    print_status "Deploying CloudFormation stack..."
    
    aws cloudformation deploy \
        --template-file aws/cloudformation-template.json \
        --stack-name $STACK_NAME \
        --parameter-overrides \
            VpcId=$VPC_ID \
            SubnetIds=$SUBNET_IDS \
            ImageUri=$IMAGE_URI \
        --capabilities CAPABILITY_NAMED_IAM \
        --region $REGION
    
    print_success "CloudFormation stack '$STACK_NAME' deployed successfully"
}

# Function to get application URL
get_app_url() {
    print_status "Getting application URL..."
    
    ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
        --output text \
        --region $REGION)
    
    if [ -n "$ALB_DNS" ]; then
        APP_URL="http://$ALB_DNS"
        print_success "Application deployed successfully!"
        echo ""
        echo "🚀 Your Bitcoin Mining Tracker is now live at:"
        echo "   $APP_URL"
        echo ""
        echo "📊 Health Check:"
        echo "   $APP_URL/api/health"
        echo ""
        echo "🔌 API Documentation:"
        echo "   $APP_URL/api"
        echo ""
        echo "📝 Note: It may take a few minutes for the application to be fully available."
    else
        print_error "Could not retrieve application URL"
    fi
}

# Main deployment function
deploy() {
    echo "🚀 Bitcoin Mining Tracker - AWS Cloud Deployment"
    echo "=============================================="
    echo ""
    echo "ℹ️  This deployment method builds the Docker image in AWS CodeBuild"
    echo "   No local Docker installation required!"
    echo ""
    
    check_aws_cli
    get_vpc_info
    create_ecr_repo
    create_codebuild_project
    build_image_in_cloud
    deploy_stack
    get_app_url
    
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo ""
    echo "💡 The application is running on AWS ECS Fargate with:"
    echo "   - Auto-scaling enabled"
    echo "   - Load balancer for high availability"
    echo "   - CloudWatch logging"
    echo "   - Health checks"
}

# Function to clean up resources
cleanup() {
    print_status "Cleaning up resources..."
    
    read -p "Are you sure you want to delete all AWS resources? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Delete CloudFormation stack
        aws cloudformation delete-stack \
            --stack-name $STACK_NAME \
            --region $REGION
        print_success "CloudFormation stack deletion initiated"
        
        # Delete CodeBuild project
        aws codebuild delete-project \
            --name $CODEBUILD_PROJECT \
            --region $REGION > /dev/null 2>&1 || true
        print_success "CodeBuild project deleted"
        
        # Delete ECR repository
        read -p "Do you want to delete the ECR repository as well? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            aws ecr delete-repository \
                --repository-name $ECR_REPO_NAME \
                --region $REGION \
                --force > /dev/null 2>&1 || true
            print_success "ECR repository deleted"
        fi
        
        # Delete S3 bucket
        BUCKET_NAME="${APP_NAME}-source-${AWS_ACCOUNT_ID}"
        aws s3 rb "s3://$BUCKET_NAME" --force --region $REGION > /dev/null 2>&1 || true
        print_success "S3 bucket deleted"
        
        # Delete IAM role
        ROLE_NAME="${APP_NAME}-codebuild-role"
        aws iam delete-role-policy \
            --role-name $ROLE_NAME \
            --policy-name "${APP_NAME}-codebuild-policy" \
            --region $REGION > /dev/null 2>&1 || true
        aws iam delete-role \
            --role-name $ROLE_NAME \
            --region $REGION > /dev/null 2>&1 || true
        print_success "IAM role deleted"
        
    else
        print_status "Cleanup cancelled"
    fi
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "cleanup")
        cleanup
        ;;
    "help"|"--help"|"-h")
        echo "Bitcoin Mining Tracker - AWS Cloud Deployment Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy    Deploy the application to AWS (default)"
        echo "  cleanup   Delete all AWS resources"
        echo "  help      Show this help message"
        echo ""
        echo "This script builds the Docker image in AWS CodeBuild"
        echo "No local Docker installation required!"
        echo ""
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
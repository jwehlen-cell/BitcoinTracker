#!/bin/bash

# Bitcoin Mining Tracker - Simple AWS Deployment
# This script deploys using AWS Fargate with a simple approach

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_NAME="bitcoin-tracker"
REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${APP_NAME}-stack"

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check AWS CLI
check_aws_cli() {
    print_status "Checking AWS CLI configuration..."
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Please run: aws configure"
        exit 1
    fi
    
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    print_success "AWS CLI configured for account: $AWS_ACCOUNT_ID"
}

# Get VPC info
get_vpc_info() {
    print_status "Getting VPC information..."
    
    # Try to get VPC from our CloudFormation stack first
    VPC_ID=$(aws cloudformation describe-stacks --stack-name bitcoin-tracker-vpc --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`VpcId`].OutputValue' --output text 2>/dev/null || echo "")
    
    if [ -n "$VPC_ID" ]; then
        SUBNET1=$(aws cloudformation describe-stacks --stack-name bitcoin-tracker-vpc --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet1Id`].OutputValue' --output text)
        SUBNET2=$(aws cloudformation describe-stacks --stack-name bitcoin-tracker-vpc --region $REGION --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet2Id`].OutputValue' --output text)
        SUBNET_IDS="$SUBNET1,$SUBNET2"
        print_success "Using VPC from bitcoin-tracker-vpc stack: $VPC_ID"
    else
        # Fallback to default VPC
        VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query 'Vpcs[0].VpcId' --output text --region $REGION)
        if [ "$VPC_ID" = "None" ] || [ -z "$VPC_ID" ]; then
            print_error "No VPC found. Please create VPC first:"
            print_error "aws cloudformation deploy --template-file aws/vpc-template.json --stack-name bitcoin-tracker-vpc --region $REGION"
            exit 1
        fi
        SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[*].SubnetId' --output text --region $REGION | tr '\t' ',')
    fi
    
    print_success "Using VPC: $VPC_ID"
    print_success "Using Subnets: $SUBNET_IDS"
}

# Deploy using CloudFormation with a public Node.js image
deploy_with_public_image() {
    print_status "Deploying with public Node.js image..."
    
    # Create a simplified CloudFormation template
    cat > /tmp/simple-deployment.json << EOF
{
  "AWSTemplateFormatVersion": "2010-09-09",
  "Description": "Bitcoin Mining Tracker - Simple deployment with public image",
  "Parameters": {
    "VpcId": {
      "Type": "String",
      "Default": "$VPC_ID"
    },
    "SubnetIds": {
      "Type": "CommaDelimitedList",
      "Default": "$SUBNET_IDS"
    }
  },
  "Resources": {
    "ECSCluster": {
      "Type": "AWS::ECS::Cluster",
      "Properties": {
        "ClusterName": "bitcoin-tracker-cluster"
      }
    },
    "TaskExecutionRole": {
      "Type": "AWS::IAM::Role",
      "Properties": {
        "AssumeRolePolicyDocument": {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Principal": {
                "Service": "ecs-tasks.amazonaws.com"
              },
              "Action": "sts:AssumeRole"
            }
          ]
        },
        "ManagedPolicyArns": [
          "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
        ]
      }
    },
    "LogGroup": {
      "Type": "AWS::Logs::LogGroup",
      "Properties": {
        "LogGroupName": "/ecs/bitcoin-tracker",
        "RetentionInDays": 7
      }
    },
    "TaskDefinition": {
      "Type": "AWS::ECS::TaskDefinition",
      "Properties": {
        "Family": "bitcoin-tracker",
        "NetworkMode": "awsvpc",
        "RequiresCompatibilities": ["FARGATE"],
        "Cpu": "256",
        "Memory": "512",
        "ExecutionRoleArn": {
          "Fn::GetAtt": ["TaskExecutionRole", "Arn"]
        },
        "ContainerDefinitions": [
          {
            "Name": "bitcoin-tracker",
            "Image": "node:18-alpine",
            "Essential": true,
            "Command": [
              "sh",
              "-c",
              "apk add --no-cache git && git clone https://github.com/jwehlen-cell/BitcoinTracker.git /app && cd /app && npm install && npm start"
            ],
            "PortMappings": [
              {
                "ContainerPort": 3000,
                "Protocol": "tcp"
              }
            ],
            "Environment": [
              {
                "Name": "NODE_ENV",
                "Value": "production"
              },
              {
                "Name": "PORT",
                "Value": "3000"
              }
            ],
            "LogConfiguration": {
              "LogDriver": "awslogs",
              "Options": {
                "awslogs-group": {
                  "Ref": "LogGroup"
                },
                "awslogs-region": {
                  "Ref": "AWS::Region"
                },
                "awslogs-stream-prefix": "ecs"
              }
            }
          }
        ]
      }
    },
    "SecurityGroup": {
      "Type": "AWS::EC2::SecurityGroup",
      "Properties": {
        "GroupDescription": "Security group for Bitcoin Tracker",
        "VpcId": {
          "Ref": "VpcId"
        },
        "SecurityGroupIngress": [
          {
            "IpProtocol": "tcp",
            "FromPort": 80,
            "ToPort": 80,
            "CidrIp": "0.0.0.0/0"
          },
          {
            "IpProtocol": "tcp",
            "FromPort": 3000,
            "ToPort": 3000,
            "SourceSecurityGroupId": {
              "Ref": "AWS::NoValue"
            }
          }
        ]
      }
    },
    "LoadBalancer": {
      "Type": "AWS::ElasticLoadBalancingV2::LoadBalancer",
      "Properties": {
        "Name": "bitcoin-tracker-alb",
        "Scheme": "internet-facing",
        "Type": "application",
        "Subnets": {
          "Ref": "SubnetIds"
        },
        "SecurityGroups": [
          {
            "Ref": "SecurityGroup"
          }
        ]
      }
    },
    "TargetGroup": {
      "Type": "AWS::ElasticLoadBalancingV2::TargetGroup",
      "Properties": {
        "Name": "bitcoin-tracker-tg",
        "Port": 3000,
        "Protocol": "HTTP",
        "VpcId": {
          "Ref": "VpcId"
        },
        "TargetType": "ip",
        "HealthCheckPath": "/api/health",
        "HealthCheckIntervalSeconds": 30,
        "HealthCheckTimeoutSeconds": 5,
        "HealthyThresholdCount": 2,
        "UnhealthyThresholdCount": 5
      }
    },
    "Listener": {
      "Type": "AWS::ElasticLoadBalancingV2::Listener",
      "Properties": {
        "DefaultActions": [
          {
            "Type": "forward",
            "TargetGroupArn": {
              "Ref": "TargetGroup"
            }
          }
        ],
        "LoadBalancerArn": {
          "Ref": "LoadBalancer"
        },
        "Port": 80,
        "Protocol": "HTTP"
      }
    },
    "ECSService": {
      "Type": "AWS::ECS::Service",
      "DependsOn": "Listener",
      "Properties": {
        "ServiceName": "bitcoin-tracker-service",
        "Cluster": {
          "Ref": "ECSCluster"
        },
        "TaskDefinition": {
          "Ref": "TaskDefinition"
        },
        "DesiredCount": 1,
        "LaunchType": "FARGATE",
        "NetworkConfiguration": {
          "AwsvpcConfiguration": {
            "AssignPublicIp": "ENABLED",
            "Subnets": {
              "Ref": "SubnetIds"
            },
            "SecurityGroups": [
              {
                "Ref": "SecurityGroup"
              }
            ]
          }
        },
        "LoadBalancers": [
          {
            "ContainerName": "bitcoin-tracker",
            "ContainerPort": 3000,
            "TargetGroupArn": {
              "Ref": "TargetGroup"
            }
          }
        ]
      }
    }
  },
  "Outputs": {
    "LoadBalancerDNS": {
      "Description": "DNS name of the load balancer",
      "Value": {
        "Fn::GetAtt": ["LoadBalancer", "DNSName"]
      }
    },
    "AppURL": {
      "Description": "URL of the application",
      "Value": {
        "Fn::Sub": "http://\${LoadBalancer.DNSName}"
      }
    }
  }
}
EOF

    # Deploy the stack
    aws cloudformation deploy \
        --template-file /tmp/simple-deployment.json \
        --stack-name $STACK_NAME \
        --capabilities CAPABILITY_IAM \
        --region $REGION
    
    print_success "Application deployed successfully!"
    
    # Get the URL
    ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
        --output text \
        --region $REGION)
    
    if [ -n "$ALB_DNS" ]; then
        APP_URL="http://$ALB_DNS"
        echo ""
        echo "🚀 Your Bitcoin Mining Tracker is now live at:"
        echo "   $APP_URL"
        echo ""
        echo "📊 Health Check:"
        echo "   $APP_URL/api/health"
        echo ""
        echo "📝 Note: It may take 5-10 minutes for the application to be fully available"
        echo "   (the container needs to download code and install dependencies)"
    fi
    
    # Clean up temp file
    rm -f /tmp/simple-deployment.json
}

# Main function
deploy() {
    echo "🚀 Bitcoin Mining Tracker - Simple AWS Deployment"
    echo "================================================"
    echo ""
    
    check_aws_cli
    get_vpc_info
    deploy_with_public_image
    
    echo ""
    echo "🎉 Deployment completed!"
}

deploy
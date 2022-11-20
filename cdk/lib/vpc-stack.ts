import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";
import {
  Vpc,
  SubnetType,
  InterfaceVpcEndpointAwsService,
  GatewayVpcEndpointAwsService,
} from "aws-cdk-lib/aws-ec2";

interface VpcStackProps extends StackProps {
  cidr: string;
  subnetCiderMask: number;
}

export class VpcStack extends Stack {
  public readonly vpc: Vpc;

  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);

    const cidrMask = props.subnetCiderMask;
    this.vpc = new Vpc(this, "vpc", {
      cidr: props.cidr,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask,
          name: "ingress",
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask,
          name: "isolated",
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    this.vpc.addInterfaceEndpoint("ecr-endpoint", {
      service: InterfaceVpcEndpointAwsService.ECR,
    });
    this.vpc.addInterfaceEndpoint("ecr-dkr-endpoint", {
      service: InterfaceVpcEndpointAwsService.ECR_DOCKER,
    });
    this.vpc.addInterfaceEndpoint("secret-manager-endpoint", {
      service: InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });
    this.vpc.addInterfaceEndpoint("logs-endpoint", {
      service: InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
    });
    this.vpc.addInterfaceEndpoint("ssmmessage-endpoint", {
      service: InterfaceVpcEndpointAwsService.SSM_MESSAGES,
    });

    this.vpc.addGatewayEndpoint("s3-endpoint", {
      service: GatewayVpcEndpointAwsService.S3,
      subnets: [
        {
          subnets: this.vpc.isolatedSubnets,
        },
      ],
    });
  }
}

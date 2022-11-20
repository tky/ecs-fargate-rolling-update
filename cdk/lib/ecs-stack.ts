import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  Vpc,
  SecurityGroup,
  Connections,
  Port,
  Peer,
} from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { ApplicationLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import {
  AwsLogDriver,
  Cluster,
  ContainerImage,
  FargateService,
  FargateTaskDefinition,
  FargatePlatformVersion,
  Protocol,
} from "aws-cdk-lib/aws-ecs";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";

interface EcsStackProps extends StackProps {
  vpc: Vpc;
  repository: Repository;
  circuitBreakerRollback: boolean;
  containerName: string;
}

export class EcsStack extends Stack {
  public fargateService: FargateService;
  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);
    const vpc = props.vpc;

    const albSecurityGroup = new SecurityGroup(this, "alb-security-group", {
      vpc,
      securityGroupName: "ecs-fargate-rolling-update-abl-sg",
    });
    albSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80));

    const loadBalancer = new ApplicationLoadBalancer(this, "LB", {
      loadBalancerName: "application-elb",
      vpc,
      securityGroup: albSecurityGroup,
      internetFacing: true,
      vpcSubnets: {
        subnets: vpc.publicSubnets,
      },
    });

    const taskSecurityGroup = new SecurityGroup(this, "task-security-group", {
      vpc,
      securityGroupName: "ecs-fargate-rolling-update-task-sg",
    });
    taskSecurityGroup.connections.allowFrom(
      new Connections({
        securityGroups: [albSecurityGroup],
      }),
      Port.tcp(80)
    );

    const cluster = new Cluster(this, "cluster", {
      vpc,
      clusterName: "ecs-fargate-rolling-update-cluster",
    });

    const logGroup = new LogGroup(this, "log-group", {
      logGroupName: "/ecs-fargate-rolling-update-cluster",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const taskDefinition = new FargateTaskDefinition(this, "task-definition", {
      family: "ecs-fargate-rolling-update-task-definition",
      cpu: 512,
      memoryLimitMiB: 1024,
    });

    taskDefinition.addContainer("application-container", {
      containerName: props.containerName,
      image: ContainerImage.fromEcrRepository(props.repository),
      portMappings: [
        {
          protocol: Protocol.TCP,
          containerPort: 80,
          hostPort: 80,
        },
      ],
      logging: new AwsLogDriver({ streamPrefix: "application", logGroup }),
    });

    const service = new ApplicationLoadBalancedFargateService(this, "service", {
      serviceName: "application-service",
      cluster,
      loadBalancer,
      taskDefinition,
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      assignPublicIp: false,
      publicLoadBalancer: false,
      taskSubnets: { subnets: vpc.isolatedSubnets },
      securityGroups: [taskSecurityGroup],
      platformVersion: FargatePlatformVersion.VERSION1_4,
      circuitBreaker: {
        rollback: props.circuitBreakerRollback,
      },
    });
    this.fargateService = service.service;
  }
}

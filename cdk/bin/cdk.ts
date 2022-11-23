#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VpcStack } from "../lib/vpc-stack";
import { EcrStack } from "../lib/ecr-stack";
import { EcsStack } from "../lib/ecs-stack";
import { CodeCommitStack } from "../lib/code-commit-stack";
import { PipelineStack } from "../lib/pipeline-stack";

const prefix = "ecs-fargate-rolling-update";
const app = new cdk.App();

const vpcStack = new VpcStack(app, `${prefix}-vpc-stack`, {
  cidr: "10.9.0.0/16",
  subnetCiderMask: 24,
});

const ecrStack = new EcrStack(app, `${prefix}-ecr-stack`, {
  repositoryName: `${prefix}-nginx`,
});

const containerName = "application";
const ecsStack = new EcsStack(app, `${prefix}-ecs-stack`, {
  vpc: vpcStack.vpc,
  repository: ecrStack.repository,
  circuitBreakerRollback: true,
  containerName,
});

const codeCommitStack = new CodeCommitStack(
  app,
  `${prefix}-code-commit-stack`,
  {
    repositoryName: `${prefix}`,
  }
);

new PipelineStack(app, `${prefix}-pipeline-stack`, {
  fargateService: ecsStack.fargateService,
  ecrRepository: ecrStack.repository,
  ecsContainerName: containerName,
  sourceRepositoryName: codeCommitStack.repository.repositoryName,
  useApprovalState: true,
});

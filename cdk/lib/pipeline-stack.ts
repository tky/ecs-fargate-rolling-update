import { Construct } from "constructs";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codePipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import { IRole } from "aws-cdk-lib/aws-iam";
import * as cdk from "aws-cdk-lib";
import {
  CodeCommitSourceAction,
  CodeBuildAction,
} from "aws-cdk-lib/aws-codepipeline-actions";
import { Repository } from "aws-cdk-lib/aws-codecommit";

interface PipelineProps extends cdk.StackProps {
  fargateService: ecs.FargateService;
  ecrRepository: ecr.IRepository;
  ecsContainerName: string;
  sourceRepositoryName: string;
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineProps) {
    super(scope, id, props);

    const pipeline = new codePipeline.Pipeline(this, "pipeline", {
      crossAccountKeys: false,
    });

    const sourceArtifact = new codePipeline.Artifact();

    this.addSourceStage(pipeline, sourceArtifact, props.sourceRepositoryName);

    const codebuildProject: codebuild.PipelineProject =
      this.createRollingUpdateCodeBuildWithinCodePipeline(
        props.ecrRepository,
        props.ecsContainerName
      );

    const imageArtifact = new codePipeline.Artifact("imageDetail");
    let manifestArtifact = null;

    this.addBuildStage(
      pipeline,
      codebuildProject,
      sourceArtifact,
      imageArtifact,
      manifestArtifact
    );

    this.addRollingUpdateDeploymentStage(
      pipeline,
      props.fargateService,
      imageArtifact
    );
  }

  addRollingUpdateDeploymentStage(
    pipeline: codePipeline.Pipeline,
    fargateService: ecs.FargateService,
    afterBuildArtifact: codePipeline.Artifact
  ) {
    pipeline.addStage({
      stageName: "Deployment",
      actions: [
        new codepipeline_actions.EcsDeployAction({
          actionName: "EcsCodeDeployRollingUpdate",
          service: fargateService,
          imageFile: afterBuildArtifact.atPath("imagedefinitions.json"),
        }),
      ],
    });
  }

  createECSCodeDeployRole(): iam.Role {
    const role = new iam.Role(this, "CodeDeployECSRole", {
      assumedBy: new iam.ServicePrincipal(
        `codedeploy.${cdk.Aws.REGION}.amazonaws.com`
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AWSCodeDeployRoleForECS"),
      ],
    });

    return role;
  }

  addBuildStage(
    pipeline: codePipeline.Pipeline,
    codebuildProject: codebuild.PipelineProject,
    sourceArtifact: codePipeline.Artifact,
    imageArtifact: codePipeline.Artifact,
    manifestArtifact: codePipeline.Artifact | null
  ) {
    pipeline.addStage({
      stageName: "Build",
      actions: [
        new CodeBuildAction({
          actionName: "AWS_CodeBuild",
          input: sourceArtifact,
          project: codebuildProject,
          type: codepipeline_actions.CodeBuildActionType.BUILD,
          outputs:
            manifestArtifact == null
              ? [imageArtifact]
              : [imageArtifact, manifestArtifact],
        }),
      ],
    });
  }

  createRollingUpdateCodeBuildWithinCodePipeline(
    ecrRepository: ecr.IRepository,
    ecsContainerName: string
  ) {
    const codeBuild = new codebuild.PipelineProject(
      this,
      "CodeBuildWithinCodePipeline",
      {
        buildSpec: codebuild.BuildSpec.fromObject({
          version: "0.2",
          env: {
            shell: "bash",
          },
          phases: {
            pre_build: {
              commands: [
                "echo Logging in to Amazon ECR...",
                "AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)",
                "aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com",
                "COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)",
                "IMAGE_TAG=${COMMIT_HASH:=latest}",
              ],
            },
            build: {
              "on-failure": "ABORT",
              commands: [
                "echo Build started on `date`",
                "echo Building the Docker image...",
                "docker build -t $REPOSITORY_URI:latest .",
                "docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$IMAGE_TAG",
              ],
            },
            post_build: {
              commands: [
                "echo Build completed on `date`",
                "echo Pushing the Docker images...",
                "docker push $REPOSITORY_URI:latest",
                "docker push $REPOSITORY_URI:$IMAGE_TAG",
                'printf \'[{"name":"%s","imageUri":"%s"}]\' $ECS_CONTAINER_NAME $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json',
                "cat imagedefinitions.json",
              ],
            },
          },
          artifacts: {
            files: "imagedefinitions.json",
          },
        }),
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
          computeType: codebuild.ComputeType.SMALL,
          privileged: true,
        },
        environmentVariables: {
          REPOSITORY_URI: {
            value: ecrRepository.repositoryUri,
          },
          ECS_CONTAINER_NAME: {
            value: ecsContainerName,
          },
        },
        cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
      }
    );

    ecrRepository.grantPullPush(codeBuild.role as IRole);

    return codeBuild;
  }

  addSourceStage(
    pipeline: codePipeline.Pipeline,
    sourceArtifact: codePipeline.Artifact,
    repositoryName: string
  ) {
    const repository = Repository.fromRepositoryName(
      this,
      "repository",
      repositoryName
    );
    pipeline.addStage({
      stageName: "Source",
      actions: [
        new CodeCommitSourceAction({
          actionName: "codecommit-source-action",
          runOrder: 1,
          repository,
          branch: "main",
          output: sourceArtifact,
        }),
      ],
    });
  }
}

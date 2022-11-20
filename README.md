# ECS Fargete Rolling Update CDK

## Run

```
$ cd cdk
$ npm install
```

1. Creates a vpc stack.

```
$ cdk deploy ecs-fargate-rolling-update-vpc-stack
```

2. Creates a ECR stack.

```
$ cdk deploy ecs-fargate-rolling-update-ecr-stack
```

3. Put a initail image to the ECR.

```
$ cd <root>/application
$ export PROFILE=<YOUR_AWS_PROFILE>
$ ./upload.sh
```

4. Creates a ECS stack.

```
$ cd <root>/cdk
$ cdk deploy ecs-fargate-rolling-update-ecs-stack
```

Now, you can access your sample page via the Application Loadbalancer.

5. Creates a CodeCommit stack.

```
$ cdk deploy ecs-fargate-rolling-update-code-commit-stack
```

6. Push the application code to the CodeCommit.

Login the aws console, and go to [CodeCommit](https://ap-northeast-1.console.aws.amazon.com/codesuite/codecommit/start?region=ap-northeast-1) you created,
then upload default.conf, DockerFile, index.html under the application.

7. Creates a Pipline stack.

```
$ cdk deploy ecs-fargate-rolling-update-pipeline-stack
```

## Reference Site

- https://github.com/toku-shun/ecs-fargate-rolling-update-demo
- https://github.com/kimisme9386/lab-ecs-fargate-cd-infra
- https://chariosan.com/2021/04/18/aws_cdk_vpc_endpoint/
- https://dev.classmethod.jp/articles/codepipeline-support-ecs-deploy/

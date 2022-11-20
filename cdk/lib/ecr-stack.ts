import { Construct } from "constructs";
import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import {
  Repository,
  TagMutability,
  RepositoryEncryption,
} from "aws-cdk-lib/aws-ecr";

interface EcrStackProps extends StackProps {
  repositoryName: string;
}

export class EcrStack extends Stack {
  public repository: Repository;
  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    this.repository = new Repository(this, "repository", {
      repositoryName: props.repositoryName,
      imageTagMutability: TagMutability.MUTABLE,
      encryption: RepositoryEncryption.AES_256,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}

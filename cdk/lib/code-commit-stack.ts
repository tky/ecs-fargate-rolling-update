import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Repository } from "aws-cdk-lib/aws-codecommit";

interface CodeCommitStackProps extends StackProps {
  repositoryName: string;
}

export class CodeCommitStack extends Stack {
  public readonly repository: Repository;
  constructor(scope: Construct, id: string, props: CodeCommitStackProps) {
    super(scope, id, props);
    this.repository = new Repository(this, "repository", {
      repositoryName: props.repositoryName,
    });
  }
}

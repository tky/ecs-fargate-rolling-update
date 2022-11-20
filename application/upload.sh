APPLICATION_NAME="ecs-fargate-rolling-update-nginx"
DOCKERFILE="Dockerfile"
REGION="ap-northeast-1"

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text --profile $PROFILE)

docker image build --platform=linux/amd64 -f ${DOCKERFILE} -t ${APPLICATION_NAME} .

docker image tag ${APPLICATION_NAME} ${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${APPLICATION_NAME}:latest
aws ecr get-login-password --region ${REGION} --profile ${PROFILE} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com
docker image push ${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${APPLICATION_NAME}

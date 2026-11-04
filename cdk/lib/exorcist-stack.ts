import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";

export class ExorcistStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const modelId = this.node.tryGetContext("bedrockModelId") as string;
    const allowReal = String(this.node.tryGetContext("allowRealExorcism"));

    // Where the ghosts are remembered
    const table = new dynamodb.Table(this, "FindingsTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // hackathon only
    });

    // Scanner: READ-ONLY on EC2, plus Bedrock + table write
    const scanner = new lambda.Function(this, "ScannerFn", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../lambdas/scanner")),
      timeout: cdk.Duration.minutes(2),
      memorySize: 256,
      environment: { TABLE_NAME: table.tableName, BEDROCK_MODEL_ID: modelId },
    });
    table.grantWriteData(scanner);
    scanner.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ec2:DescribeVolumes", "ec2:DescribeAddresses", "ec2:DescribeInstances"],
        resources: ["*"],
      })
    );
    scanner.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["*"], // tighten to the model ARN once confirmed
      })
    );

    // Nightly haunting patrol
    new events.Rule(this, "NightlyScan", {
      schedule: events.Schedule.rate(cdk.Duration.days(1)),
      targets: [new targets.LambdaFunction(scanner)],
    });

    // API: list findings + exorcise (real deletion gated by context flag)
    const api = new lambda.Function(this, "ApiFn", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../../lambdas/api")),
      timeout: cdk.Duration.seconds(30),
      environment: {
        TABLE_NAME: table.tableName,
        ALLOW_REAL_EXORCISM: allowReal,
        SCANNER_NAME: scanner.functionName,
      },
    });
    table.grantReadWriteData(api);
    scanner.grantInvoke(api);
    api.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ec2:DescribeVolumes", "ec2:CreateSnapshot", "ec2:DeleteVolume", "ec2:ReleaseAddress"],
        resources: ["*"],
      })
    );

    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST],
        allowHeaders: ["content-type"],
      },
    });
    const integration = new HttpLambdaIntegration("ApiIntegration", api);
    httpApi.addRoutes({ path: "/findings", methods: [apigwv2.HttpMethod.GET], integration });
    httpApi.addRoutes({ path: "/scan", methods: [apigwv2.HttpMethod.POST], integration });
    httpApi.addRoutes({ path: "/exorcise/{id}", methods: [apigwv2.HttpMethod.POST], integration });

    new cdk.CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "ScannerName", { value: scanner.functionName });
  }
}

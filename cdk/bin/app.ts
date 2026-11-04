import * as cdk from "aws-cdk-lib";
import { ExorcistStack } from "../lib/exorcist-stack";

const app = new cdk.App();
new ExorcistStack(app, "ExorcistExeStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

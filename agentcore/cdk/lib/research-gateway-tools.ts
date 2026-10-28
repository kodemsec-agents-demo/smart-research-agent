import { Duration, Stack, aws_bedrockagentcore as agentcore } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The AgentCore gateway the agent's tools run behind. It's created outside this
 * project (in the AgentCore console), so the stack only adds targets to it.
 */
export interface ResearchGatewayContext {
  id: string;
  url: string;
  roleArn: string;
  /** The gateway's Cognito sign-in: the OAuth2 credential provider and its scopes */
  credentialProvider: string;
  scopes: string[];
  /** The AgentCore Identity API key provider holding the GitHub token of the github target */
  githubApiKeyProviderArn: string;
}

export interface ResearchGatewayToolsProps {
  gateway: ResearchGatewayContext;
  /** The agent runtimes that call the tools through the gateway, with a Cognito token */
  runtimes: {
    role: iam.IRole;
    addEnvironmentVariable(name: string, value: string): void;
    /** Grants the AgentCore Identity token vault and its secrets */
    grantCredentialAccess(): void;
  }[];
}

// The CLI runs CDK from agentcore/cdk/, so the repository root is two levels up
const TOOLS_DIR = path.resolve(process.cwd(), '..', '..', 'gateway', 'research_tools');
// GitHub's remote MCP server, which takes the token as a bearer token
const GITHUB_MCP_URL = 'https://api.githubcopilot.com/mcp/';
const TARGETS = { tools: 'research-tools', github: 'github' };

/**
 * Runs the research tools in one Lambda behind the gateway's research-tools
 * target, puts GitHub's remote MCP server behind its github target, and lets the
 * agent runtimes get the gateway's Cognito token as their own workload identity.
 */
export class ResearchGatewayTools extends Construct {
  constructor(scope: Construct, id: string, props: ResearchGatewayToolsProps) {
    super(scope, id);

    const { gateway, runtimes } = props;
    const stack = Stack.of(this);
    const identityArn = (resource: string) =>
      `arn:${stack.partition}:bedrock-agentcore:${stack.region}:${stack.account}:${resource}`;

    const toolsFunction = new NodejsFunction(this, 'Function', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(TOOLS_DIR, 'handler.ts'),
      projectRoot: TOOLS_DIR,
      depsLockFilePath: path.join(TOOLS_DIR, 'package-lock.json'),
      timeout: Duration.seconds(60),
      memorySize: 512,
      // pg loads pg-native only when asked to
      bundling: { externalModules: ['pg-native'] },
    });

    // The gateway invokes the targets with its own role
    toolsFunction.addPermission('GatewayInvoke', {
      principal: new iam.ArnPrincipal(gateway.roleArn),
    });

    const toolsTarget = new agentcore.CfnGatewayTarget(this, 'ToolsTarget', {
      gatewayIdentifier: gateway.id,
      name: TARGETS.tools,
      description: 'The research agent tools',
      targetConfiguration: {
        mcp: {
          lambda: {
            lambdaArn: toolsFunction.functionArn,
            toolSchema: {
              inlinePayload: JSON.parse(fs.readFileSync(path.join(TOOLS_DIR, 'tool_schema.json'), 'utf8')),
            },
          },
        },
      },
      credentialProviderConfigurations: [{ credentialProviderType: 'GATEWAY_IAM_ROLE' }],
    });
    // The target is checked on creation, so the permission (a child of the function) comes first
    toolsTarget.node.addDependency(toolsFunction);

    // The gateway reads the GitHub token from AgentCore Identity with its role,
    // which the console created without these permissions
    const gatewayRole = iam.Role.fromRoleArn(this, 'GatewayRole', gateway.roleArn);
    const githubKeyAccess = new iam.Policy(this, 'GatewayGithubKeyAccess', {
      roles: [gatewayRole],
      statements: [
        new iam.PolicyStatement({
          actions: ['bedrock-agentcore:GetWorkloadAccessToken', 'bedrock-agentcore:GetResourceApiKey'],
          resources: [
            identityArn('workload-identity-directory/default'),
            identityArn('workload-identity-directory/default/workload-identity/*'),
            identityArn('token-vault/default'),
            gateway.githubApiKeyProviderArn,
          ],
        }),
        new iam.PolicyStatement({
          actions: ['secretsmanager:GetSecretValue'],
          resources: [`arn:${stack.partition}:secretsmanager:${stack.region}:${stack.account}:secret:bedrock-agentcore-identity!*`],
        }),
      ],
    });

    const githubTarget = new agentcore.CfnGatewayTarget(this, 'GithubTarget', {
      gatewayIdentifier: gateway.id,
      name: TARGETS.github,
      description: "GitHub's remote MCP server: repositories, issues, pull requests and code",
      targetConfiguration: { mcp: { mcpServer: { endpoint: GITHUB_MCP_URL } } },
      credentialProviderConfigurations: [
        {
          credentialProviderType: 'API_KEY',
          credentialProvider: {
            apiKeyCredentialProvider: {
              providerArn: gateway.githubApiKeyProviderArn,
              credentialLocation: 'HEADER',
              credentialParameterName: 'Authorization',
              credentialPrefix: 'Bearer',
            },
          },
        },
      ],
    });
    // Creating the target lists GitHub's tools, which needs the token
    githubTarget.node.addDependency(githubKeyAccess);

    // The identity the agents fetch the gateway's machine-to-machine token as
    const workload = new agentcore.CfnWorkloadIdentity(this, 'WorkloadIdentity', {
      name: 'research-gateway-client',
    });

    for (const runtime of runtimes) {
      runtime.addEnvironmentVariable('RESEARCH_GATEWAY_URL', gateway.url);
      runtime.addEnvironmentVariable('RESEARCH_GATEWAY_TARGETS', Object.values(TARGETS).join(','));
      runtime.addEnvironmentVariable('RESEARCH_GATEWAY_WORKLOAD', workload.name);
      runtime.addEnvironmentVariable('RESEARCH_GATEWAY_CREDENTIAL_PROVIDER', gateway.credentialProvider);
      runtime.addEnvironmentVariable('RESEARCH_GATEWAY_SCOPES', gateway.scopes.join(','));
      runtime.grantCredentialAccess();
      runtime.role.addToPrincipalPolicy(
        new iam.PolicyStatement({
          actions: ['bedrock-agentcore:GetWorkloadAccessToken'],
          resources: [identityArn('workload-identity-directory/default'), workload.attrWorkloadIdentityArn],
        })
      );
    }
  }
}

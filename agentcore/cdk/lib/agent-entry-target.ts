import { CfnOutput, Stack, aws_bedrockagentcore as agentcore } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * The agents' entry gateway: no protocol type, IAM (SigV4) inbound. It's
 * shared by the agents and created outside this project, so the stack only
 * adds the agent's target to it.
 */
export interface AgentEntryGatewayContext {
  id: string;
  roleArn: string;
}

export interface AgentEntryTargetProps {
  gateway: AgentEntryGatewayContext;
  /** The agent runtime every request goes through the gateway to */
  runtimeArn: string;
  /** The target's name, the path the agent is invoked at */
  targetName: string;
  /**
   * Roles that may still invoke the runtime directly, without the gateway:
   * the AgentCore console's agent test page calls the runtime itself
   */
  directInvokeRoleArns?: string[];
}

/**
 * Makes the entry gateway the only way in to the agent: the agent's target on
 * the gateway, the gateway role's permission to invoke the agent, and a
 * resource policy on the runtime that denies every other caller. Callers sign
 * their requests with IAM (SigV4) and call {gateway URL}/{target}/invocations.
 */
export class AgentEntryTarget extends Construct {
  constructor(scope: Construct, id: string, props: AgentEntryTargetProps) {
    super(scope, id);

    const { gateway, runtimeArn, targetName, directInvokeRoleArns = [] } = props;
    const stack = Stack.of(this);

    const gatewayInvoke = new iam.Policy(this, 'GatewayInvoke', {
      roles: [iam.Role.fromRoleArn(this, 'GatewayRole', gateway.roleArn)],
      statements: [
        new iam.PolicyStatement({
          actions: ['bedrock-agentcore:InvokeAgentRuntime'],
          resources: [runtimeArn, `${runtimeArn}/runtime-endpoint/*`],
        }),
      ],
    });

    const target = new agentcore.CfnGatewayTarget(this, 'Target', {
      gatewayIdentifier: gateway.id,
      name: targetName,
      description: 'The agent runtime',
      targetConfiguration: { http: { agentcoreRuntime: { arn: runtimeArn, qualifier: 'DEFAULT' } } },
      credentialProviderConfigurations: [{ credentialProviderType: 'GATEWAY_IAM_ROLE' }],
    });
    target.node.addDependency(gatewayInvoke);

    // Only the gateway's role, and the roles allowed to invoke directly, may
    // invoke the runtime: the deny overrides any identity policy that allows
    // another principal
    new agentcore.CfnResourcePolicy(this, 'RuntimeOnlyThroughGateway', {
      resourceArn: runtimeArn,
      policy: stack.toJsonString({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'AllowOnlyGatewayRole',
            Effect: 'Allow',
            Principal: { AWS: gateway.roleArn },
            Action: 'bedrock-agentcore:InvokeAgentRuntime',
            Resource: runtimeArn,
          },
          {
            Sid: 'DenyOtherPrincipals',
            Effect: 'Deny',
            Principal: { AWS: '*' },
            Action: 'bedrock-agentcore:InvokeAgentRuntime',
            Resource: runtimeArn,
            Condition: { ArnNotEquals: { 'aws:PrincipalArn': [gateway.roleArn, ...directInvokeRoleArns] } },
          },
        ],
      }),
    });

    new CfnOutput(this, 'InvocationUrl', {
      description: 'Where the agent is invoked, with IAM (SigV4)',
      value: `https://${gateway.id}.gateway.bedrock-agentcore.${stack.region}.amazonaws.com/${targetName}/invocations`,
    });
  }
}

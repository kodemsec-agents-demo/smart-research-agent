#!/usr/bin/env bash
# Sends a prompt to an agent through its AgentCore entry gateway, the way in for
# everyone but the administrators, who may also call the runtime directly (the
# AgentCore console's test page does). Prints the agent's answer when it's done.
#
#   ./invoke.sh "What does the repository aws/bedrock-agentcore-sdk-python do?"
#   SESSION_ID=<id printed by an earlier call> ./invoke.sh "And how do I install it?"
#   AGENT=triage-agent ./invoke.sh "Run a full triage"
#
# Environment:
#   AWS_PROFILE  the AWS profile to sign with (default: poc-external)
#   GATEWAY_URL  the entry gateway's URL (default: the agents-entry gateway)
#   AGENT        the agent's target on the gateway (default: research-agent)
#   SESSION_ID   continues an earlier conversation (default: a new one)
set -euo pipefail

export AWS_PROFILE=${AWS_PROFILE:-poc-external}
GATEWAY_URL=${GATEWAY_URL:-https://agents-entry-dxtmfwqite.gateway.bedrock-agentcore.us-east-1.amazonaws.com}
AGENT=${AGENT:-research-agent}

if [[ $# -ne 1 || -z $1 ]]; then
  echo "Usage: [AWS_PROFILE=…] [GATEWAY_URL=…] [AGENT=…] [SESSION_ID=…] $0 \"<prompt>\"" >&2
  exit 1
fi

gateway_url_pattern='^https://([a-z0-9-]+)\.gateway\.bedrock-agentcore\.([a-z0-9-]+)\.amazonaws\.com/?$'
if [[ ! $GATEWAY_URL =~ $gateway_url_pattern ]]; then
  echo "GATEWAY_URL is not a gateway URL: $GATEWAY_URL" >&2
  echo "Expected https://<gateway-id>.gateway.bedrock-agentcore.<region>.amazonaws.com" >&2
  exit 1
fi
gateway_id=${BASH_REMATCH[1]}
region=${BASH_REMATCH[2]}

# The CLI needs the runtime's ARN: the one the agent's target on the gateway invokes
target_id=$(aws bedrock-agentcore-control list-gateway-targets \
  --region "$region" --gateway-identifier "$gateway_id" \
  --query "items[?name=='$AGENT'].targetId | [0]" --output text)
if [[ $target_id == None ]]; then
  echo "Gateway $gateway_id has no target named $AGENT" >&2
  exit 1
fi
runtime_arn=$(aws bedrock-agentcore-control get-gateway-target \
  --region "$region" --gateway-identifier "$gateway_id" --target-id "$target_id" \
  --query targetConfiguration.http.agentcoreRuntime.arn --output text)
if [[ $runtime_arn == None ]]; then
  echo "Target $AGENT on gateway $gateway_id is not an agent runtime" >&2
  exit 1
fi
# AgentCore requires session ids of at least 33 characters
session_id=${SESSION_ID:-invoke-$(date +%s)-$(uuidgen | tr -d -)}
payload=$(jq -n --arg prompt "$1" '{prompt: $prompt}')
response=$(mktemp)
trap 'rm -f "$response"' EXIT

echo "Agent: $AGENT, session: $session_id" >&2
status=$(aws bedrock-agentcore invoke-agent-runtime \
  --region "$region" \
  --endpoint-url "${GATEWAY_URL%/}/$AGENT" \
  --agent-runtime-arn "$runtime_arn" \
  --runtime-session-id "$session_id" \
  --content-type application/json \
  --accept "application/json, text/event-stream" \
  --payload "$payload" \
  --cli-binary-format raw-in-base64-out \
  --query statusCode --output text \
  "$response")

if [[ $status != 200 ]]; then
  echo "The gateway answered with status $status:" >&2
  cat "$response" >&2
  exit 1
fi

# The answer is a server-sent event stream: print the text and name the tools
# used. Strands agents send model events, other agents their text as strings
sed -n 's/^data: //p' "$response" | jq -Rrj '
  fromjson?
  | if type == "string" then .
    elif .event.contentBlockDelta.delta.text then .event.contentBlockDelta.delta.text
    elif .event.contentBlockStart.start.toolUse then "\n[tool: \(.event.contentBlockStart.start.toolUse.name)]\n"
    else empty end'
echo

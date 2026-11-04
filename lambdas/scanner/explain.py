"""Turns a raw finding into a short 'ghost story' using Amazon Bedrock.
Falls back to a deterministic story so the app never breaks (and demos never fail)."""
import json
import os
import re

import boto3

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-micro-v1:0")
_bedrock = None


def _client():
    global _bedrock
    if _bedrock is None:
        _bedrock = boto3.client("bedrock-runtime")
    return _bedrock


def _fallback(f: dict) -> dict:
    risk = "LOW" if f["type"] in ("EBS_VOLUME", "ELASTIC_IP") else "MEDIUM"
    story = (
        f"{f['type'].replace('_', ' ').title()} {f['resource_id']} has been haunting your bill "
        f"for about {f['age_days']} days, costing roughly ${f['monthly_cost']}/month while doing nothing."
    )
    return {"story": story, "risk": risk}


def explain_finding(f: dict) -> dict:
    prompt = (
        "You are a FinOps assistant with a spooky voice. Given this wasted AWS resource, reply with ONLY "
        'JSON: {"story": "<2 sentences, plain language, say why it is likely dead and what it costs>", '
        '"risk": "LOW|MEDIUM|HIGH"} where risk is the danger of deleting it (HIGH = may hold needed data).\n'
        f"Resource: {json.dumps(f, default=str)}"
    )
    try:
        resp = _client().converse(
            modelId=MODEL_ID,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 200, "temperature": 0.4},
        )
        text = resp["output"]["message"]["content"][0]["text"]
        match = re.search(r"\{.*\}", text, re.S)
        data = json.loads(match.group(0))
        risk = str(data.get("risk", "MEDIUM")).upper()
        if risk not in ("LOW", "MEDIUM", "HIGH"):
            risk = "MEDIUM"
        return {"story": str(data["story"])[:400], "risk": risk}
    except Exception as exc:  # model access missing, throttling, bad JSON...
        print(f"Bedrock explain failed, using fallback: {exc}")
        return _fallback(f)

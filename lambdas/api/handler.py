"""Exorcist.exe API: GET /findings (?demo=1 = seeded data), POST /scan, POST /exorcise/{id}."""
import json
import os
from decimal import Decimal

import boto3

TABLE = os.environ["TABLE_NAME"]
ALLOW_REAL = os.environ.get("ALLOW_REAL_EXORCISM", "false").lower() == "true"
table = boto3.resource("dynamodb").Table(TABLE)
ec2 = boto3.client("ec2")
lam = boto3.client("lambda")
SCANNER = os.environ.get("SCANNER_NAME", "")

HERE = os.path.dirname(__file__)
with open(os.path.join(HERE, "seed_findings.json")) as fh:
    SEED = json.load(fh)


def _json(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError


def _resp(code, body):
    return {
        "statusCode": code,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body, default=_json),
    }


def list_findings(demo: bool):
    items = SEED if demo else table.scan().get("Items", [])
    items = sorted(items, key=lambda x: float(x["monthly_cost"]), reverse=True)
    haunting = [i for i in items if i["status"] == "HAUNTING"]
    return {
        "demo": demo,
        "findings": items,
        "summary": {
            "ghosts": len(haunting),
            "monthly_waste": round(sum(float(i["monthly_cost"]) for i in haunting), 2),
        },
    }


def exorcise(rid: str, demo: bool):
    if demo:
        return 200, {"id": rid, "status": "EXORCISED", "mode": "demo", "note": "Simulated, nothing deleted."}
    item = table.get_item(Key={"id": rid}).get("Item")
    if not item:
        return 404, {"error": "Unknown ghost"}
    if item["type"] == "STOPPED_EC2":
        return 400, {"error": "Stopped instances need manual review. Snapshot and terminate yourself."}
    if not ALLOW_REAL:
        return 200, {"id": rid, "status": "DRY_RUN", "note": "Real exorcism disabled (allowRealExorcism=false)."}
    if item["type"] == "EBS_VOLUME":
        vols = ec2.describe_volumes(VolumeIds=[rid])["Volumes"]
        if not vols or vols[0]["State"] != "available":
            return 409, {"error": "This volume is attached or changed state. Refusing to delete."}
        snap = ec2.create_snapshot(VolumeId=rid, Description="Exorcist.exe pre-delete backup")
        ec2.delete_volume(VolumeId=rid)
        note = f"Snapshot {snap['SnapshotId']} created, volume deleted."
    else:  # ELASTIC_IP
        ec2.release_address(AllocationId=rid)
        note = "Address released."
    table.update_item(
        Key={"id": rid},
        UpdateExpression="SET #s = :s",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "EXORCISED"},
    )
    return 200, {"id": rid, "status": "EXORCISED", "note": note}


def handler(event, context):
    route = event.get("routeKey", "")
    qs = event.get("queryStringParameters") or {}
    demo = qs.get("demo") == "1"
    try:
        if route == "GET /findings":
            return _resp(200, list_findings(demo))
        if route == "POST /scan":
            lam.invoke(FunctionName=SCANNER, InvocationType="Event")
            return _resp(202, {"status": "SCAN_STARTED"})
        if route == "POST /exorcise/{id}":
            code, body = exorcise(event["pathParameters"]["id"], demo)
            return _resp(code, body)
        return _resp(404, {"error": "Not found"})
    except Exception as exc:
        print(f"error: {exc}")
        return _resp(500, {"error": "The spirits are restless. Try again."})

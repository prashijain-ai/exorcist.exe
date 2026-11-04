"""Exorcist.exe scanner: finds zombie AWS resources and records them with a ghost story."""
import os
import re
from datetime import datetime, timezone
from decimal import Decimal

import boto3

from explain import explain_finding
from pricing import EIP_MONTH, ebs_monthly

TABLE = os.environ["TABLE_NAME"]
ec2 = boto3.client("ec2")
table = boto3.resource("dynamodb").Table(TABLE)
REGION = os.environ.get("AWS_REGION", "us-east-1")


def _age_days(dt) -> int:
    return max(0, (datetime.now(timezone.utc) - dt).days)


def scan_volumes():
    out = []
    pages = ec2.get_paginator("describe_volumes").paginate(
        Filters=[{"Name": "status", "Values": ["available"]}]
    )
    for page in pages:
        for v in page["Volumes"]:
            out.append({
                "id": v["VolumeId"], "type": "EBS_VOLUME", "resource_id": v["VolumeId"],
                "monthly_cost": ebs_monthly(v["Size"], v["VolumeType"]),
                "age_days": _age_days(v["CreateTime"]),
                "details": f"{v['Size']} GiB {v['VolumeType']}, unattached",
            })
    return out


def scan_eips():
    out = []
    for a in ec2.describe_addresses()["Addresses"]:
        if "AssociationId" not in a and "InstanceId" not in a:
            rid = a.get("AllocationId", a.get("PublicIp"))
            out.append({
                "id": rid, "type": "ELASTIC_IP", "resource_id": rid,
                "monthly_cost": round(EIP_MONTH, 2), "age_days": 0,
                "details": f"{a.get('PublicIp')} not associated with any instance",
            })
    return out


def scan_stopped_instances():
    out = []
    pages = ec2.get_paginator("describe_instances").paginate(
        Filters=[{"Name": "instance-state-name", "Values": ["stopped"]}]
    )
    for page in pages:
        for r in page["Reservations"]:
            for i in r["Instances"]:
                vol_ids = [
                    m["Ebs"]["VolumeId"] for m in i.get("BlockDeviceMappings", []) if "Ebs" in m
                ]
                cost = 0.0
                if vol_ids:
                    for v in ec2.describe_volumes(VolumeIds=vol_ids)["Volumes"]:
                        cost += ebs_monthly(v["Size"], v["VolumeType"])
                m = re.search(r"\((\d{4}-\d{2}-\d{2})", i.get("StateTransitionReason", ""))
                age = 0
                if m:
                    age = _age_days(datetime.strptime(m.group(1), "%Y-%m-%d").replace(tzinfo=timezone.utc))
                out.append({
                    "id": i["InstanceId"], "type": "STOPPED_EC2", "resource_id": i["InstanceId"],
                    "monthly_cost": round(cost, 2), "age_days": age,
                    "details": f"{i['InstanceType']} stopped; still paying for {len(vol_ids)} attached volume(s)",
                })
    return out


def handler(event, context):
    findings = scan_volumes() + scan_eips() + scan_stopped_instances()
    now = datetime.now(timezone.utc).isoformat()
    for f in findings:
        info = explain_finding(f)
        item = {
            **f,
            "monthly_cost": Decimal(str(f["monthly_cost"])),
            "region": REGION,
            "status": "HAUNTING",
            "ghost_story": info["story"],
            "risk": info["risk"],
            "detected_at": now,
        }
        table.put_item(Item=item)
    total = round(sum(f["monthly_cost"] for f in findings), 2)
    print(f"Found {len(findings)} ghosts costing ~${total}/month")
    return {"found": len(findings), "monthly_cost": total}

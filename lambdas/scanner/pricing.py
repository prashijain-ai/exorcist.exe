"""Static, approximate us-east-1 prices (USD). Estimates only, shown as such in the UI."""

EBS_GB_MONTH = {
    "gp3": 0.08, "gp2": 0.10, "io1": 0.125, "io2": 0.125,
    "st1": 0.045, "sc1": 0.015, "standard": 0.05,
}
EIP_MONTH = 0.005 * 730  # public IPv4 address, per hour * hours/month


def ebs_monthly(size_gb: int, vol_type: str) -> float:
    return round(size_gb * EBS_GB_MONTH.get(vol_type, 0.10), 2)

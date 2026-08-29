#!/usr/bin/env python3
"""
AgriPod serial bridge (Python / pyserial) — USB phase.

Reads the pod's EXISTING Serial Monitor output (no Arduino changes) and forwards
each reading to the AgriPod backend. Run it on the laptop the pod is plugged into.

    pip install pyserial
    python pod_bridge.py COM5
        Windows:      "COM5"   (Arduino IDE -> Tools -> Port)
        macOS/Linux:  "/dev/tty.usbserial-XXXX"  or  "/dev/ttyUSB0"

Optional:
    python pod_bridge.py COM5 <POD_KEY> <API_BASE>

IMPORTANT: close the Arduino IDE Serial Monitor first — only one program can
hold the serial port at a time.
"""

import json
import re
import sys
import time
import urllib.error
import urllib.request

import serial
import serial.tools.list_ports

POD_KEY = "pod_demo_a1b2c3d4e5f60718293a4b5c"
API_BASE = "https://agripod-backend.onrender.com"
BAUD = 115200
MIN_INTERVAL_S = 5.0

# Lines the friend's sketch already prints:
#   Moisture       : 0%
#   pH             : 13.32
#   Temperature    : 31.31 °C        (or "Temperature    : SENSOR ERROR")
RE_MOIST = re.compile(r"^Moisture\s*:\s*(-?\d+(?:\.\d+)?)\s*%", re.I)
RE_PH = re.compile(r"^pH\s*:\s*(-?\d+(?:\.\d+)?)\s*$", re.I)
RE_TEMP = re.compile(r"^Temp(?:erature)?\s*:\s*(-?\d+(?:\.\d+)?)", re.I)
RE_TEMP_ERR = re.compile(r"^Temp(?:erature)?\s*:\s*SENSOR ERROR", re.I)
RE_ONELINE = re.compile(r"^AGRIPOD,(.+)$")


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def post(url, key, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={"Content-Type": "application/json", "X-Pod-Key": key},
    )
    ts = time.strftime("%H:%M:%S")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(f"{ts}  sent  {json.dumps(body)}  -> {r.status}")
    except urllib.error.HTTPError as e:
        print(f"{ts}  FAIL  {e.code}  {e.read()[:200].decode(errors='replace')}")
    except Exception as e:
        print(f"{ts}  ERROR {e}")


def main():
    if len(sys.argv) < 2:
        print("usage: python pod_bridge.py <serial-port> [POD_KEY] [API_BASE]")
        ports = list(serial.tools.list_ports.comports())
        if ports:
            print("\nports on this machine:")
            for p in ports:
                print(f"  {p.device}  {p.description}")
        sys.exit(1)

    port_name = sys.argv[1]
    key = sys.argv[2] if len(sys.argv) > 2 else POD_KEY
    api_base = sys.argv[3] if len(sys.argv) > 3 else API_BASE
    url = api_base.rstrip("/") + "/api/pod/readings"

    try:
        ser = serial.Serial(port_name, BAUD, timeout=2)
    except serial.SerialException as e:
        print(f"could not open {port_name}: {e}")
        print("(is the Arduino Serial Monitor still open? close it and retry)")
        sys.exit(1)

    print(f"bridge: {port_name} @ {BAUD}  ->  {url}")
    print(f"bridge: pod key {key[:12]}...   Ctrl+C to stop\n")

    acc = {}
    last_sent = 0.0

    def flush():
        nonlocal acc, last_sent
        now = time.time()
        if now - last_sent < MIN_INTERVAL_S:
            acc = {}
            return
        body = {}
        if "soil" in acc:
            body["soilMoisture"] = clamp(acc["soil"], 0, 100)
        if "ph" in acc:
            body["ph"] = clamp(acc["ph"], 0, 14)
        if "temp" in acc and acc["temp"] > -100:
            body["temperature"] = clamp(acc["temp"], -40, 90)
        acc = {}
        if not body:
            return
        last_sent = now
        post(url, key, body)

    try:
        while True:
            raw = ser.readline()
            if not raw:
                continue
            line = raw.decode(errors="replace").strip()

            one = RE_ONELINE.match(line)
            if one:
                for pair in one.group(1).split(","):
                    k, _, v = pair.partition("=")
                    try:
                        n = float(v)
                    except ValueError:
                        continue
                    if k == "soil":
                        acc["soil"] = n
                    elif k == "ph":
                        acc["ph"] = n
                    elif k == "temp":
                        acc["temp"] = n
                flush()
                continue

            m = RE_MOIST.match(line)
            if m:
                acc["soil"] = float(m.group(1))
                continue
            m = RE_PH.match(line)
            if m:
                acc["ph"] = float(m.group(1))
                continue
            m = RE_TEMP.match(line)
            if m:
                acc["temp"] = float(m.group(1))
                flush()  # Temperature is the last line of a cycle
                continue
            if RE_TEMP_ERR.match(line):
                flush()
    except KeyboardInterrupt:
        print("\nstopped.")
    finally:
        ser.close()


if __name__ == "__main__":
    main()

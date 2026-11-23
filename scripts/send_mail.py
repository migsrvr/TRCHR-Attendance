#!/usr/bin/env python3
"""
Zero-dependency Python 3 stdlib SMTP mailer for TRCHR.

Reads a JSON object on stdin:
  {"to": "...", "subject": "...", "text": "...", "html": "... (optional)"}

Reads SMTP settings from environment variables:
  SMTP_HOST      (required)
  SMTP_PORT      (default: 587 for starttls, 465 for ssl, 25 for none)
  SMTP_USER      (optional)
  SMTP_PASS      (optional)
  SMTP_FROM      (required)
  SMTP_SECURITY  (starttls | ssl | none; default: starttls)
"""

from __future__ import annotations

from email.message import EmailMessage
from email.utils import make_msgid
import json
import os
import smtplib
import ssl
import sys


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read())
    except json.JSONDecodeError as exc:
        sys.stderr.write(f"Invalid JSON input: {exc}\n")
        return 2

    to_addr = str(payload.get("to", "")).strip()
    subject = str(payload.get("subject", "")).strip()
    text_body = str(payload.get("text", ""))
    html_body = payload.get("html")

    if not to_addr or not subject:
        sys.stderr.write("Missing required fields: to, subject\n")
        return 2

    host = os.environ.get("SMTP_HOST", "").strip()
    sender = os.environ.get("SMTP_FROM", "").strip()
    security = os.environ.get("SMTP_SECURITY", "starttls").strip().lower()
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASS", "")

    if not host or not sender:
        sys.stderr.write("SMTP_HOST and SMTP_FROM must be set\n")
        return 2

    default_port = 465 if security == "ssl" else (25 if security == "none" else 587)
    port_raw = os.environ.get("SMTP_PORT", "").strip()
    port = int(port_raw) if port_raw else default_port

    message = EmailMessage()
    message_id = make_msgid()
    message["Message-ID"] = message_id
    message["From"] = sender
    message["To"] = to_addr
    message["Subject"] = subject
    message.set_content(text_body)
    if isinstance(html_body, str) and html_body.strip():
        message.add_alternative(html_body, subtype="html")

    tls_context = ssl.create_default_context()

    if security == "ssl":
        with smtplib.SMTP_SSL(host, port, timeout=10, context=tls_context) as client:
            if user:
                client.login(user, password)
            client.send_message(message)
    else:
        with smtplib.SMTP(host, port, timeout=10) as client:
            client.ehlo()
            if security == "starttls":
                client.starttls(context=tls_context)
                client.ehlo()
            if user:
                client.login(user, password)
            client.send_message(message)

    sys.stdout.write(json.dumps({"delivered": True, "messageId": message_id}) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

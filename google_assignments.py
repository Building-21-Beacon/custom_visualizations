from flask import Flask, request, session, redirect, Response, render_template_string
import uuid, time, hmac, hashlib, base64, urllib.parse
# ------------------------------------------------------------------
# ▶️ 1.  YOUR TOOL CREDENTIALS  (from Google Admin > Integrations)
# ------------------------------------------------------------------
CONSUMER_KEY    = "b574fd18-90ee-472d-8312-9b5965681eba"
CONSUMER_SECRET = "M004mswcFA0E"
LAUNCH_URL      = "https://assignments.google.com/lti/a"
ASSIGNMENTS = {
    "Assignment 1": "assign-001",
    "Assignment 2": "assign-002",
    "Assignment 3": "assign-003"
}
# ------------------------------------------------------------------
# ▶️ 2.  FLASK APP SHELL
# ------------------------------------------------------------------
app = Flask(__name__)

@app.route("/")
def index() -> str:
    return render_template_string('''
        <h2>Launch Google Assignments</h2>
        <form action="/launch" method="post">
            <label>Your role:
                <select name="roles">
                    <option value="Instructor">Instructor</option>
                    <option value="Learner">Learner</option>
                </select>
            </label><br><br>
            <label>Select Assignment:
                <select name="assignment">
                    {% for name, aid in assignments.items() %}
                        <option value="{{ aid }}">{{ name }}</option>
                    {% endfor %}
                </select>
            </label><br><br>
            <button type="submit">Launch</button>
        </form>
        <h2>Test Grade Submission</h2>
        <form action="/test-grade" method="post">
            <label>Score (0.0 to 1.0): <input type="number" name="score" step="0.01" value="1.0"></label><br><br>
            <button type="submit">Send Test Grade</button>
        </form>
    ''', assignments=ASSIGNMENTS)


@app.route("/launch", methods=["POST"])
def launch() -> Response:        # GET → build form → auto‑post (browser redirects)
    resource_link_id = request.form["assignment"]
    roles = request.form["roles"]
    lti_params = build_lti_request("eliana@b-21.org",roles,"course‑123",resource_link_id)
    sourcedid = request.form.get("lis_result_sourcedid")
    service_url = request.form.get("lis_outcome_service_url")
    print(request.form)
    print(f"   ➤ lis_outcome_service_url = {service_url}")

    if sourcedid and service_url:
        print(f"   ➤ lis_result_sourcedid = {sourcedid}")
        print(f"   ➤ lis_outcome_service_url = {service_url}")
        # Store in session or a DB (you could use a dictionary or file)
        session["lis_result_sourcedid"] = sourcedid
        session["lis_outcome_service_url"] = service_url
    else:
        print(f"ℹ️ No grade return fields present (probably Instructor launch)")


    hidden_inputs = "\n".join(
        f'<input type="hidden" name="{k}" value="{v}">'
        for k, v in lti_params.items()
    )

    html = f"""<!doctype html>
<html><body onload="document.forms[0].submit()">
  <form action="{LAUNCH_URL}" method="POST" enctype="application/x-www-form-urlencoded">
    {hidden_inputs}
    <noscript><button type="submit">Continue</button></noscript>
  </form>
</body></html>"""

    # Explicit content‑type keeps some LMS proxies happy
    return Response(html, mimetype="text/html")

# ------------------------------------------------------------------
# ▶️ 3.  BUILD & SIGN THE LTI 1.1 REQUEST
# ------------------------------------------------------------------
def build_lti_request(
        user_id,
        roles,          # or "Instructor/Learner"
        context_id,
        resource_link_id) -> dict:
    """
    Assemble the standard LTI 1.1 launch parameters,
    then compute oauth_signature (HMAC‑SHA1).
    """
    # Mandatory LTI core fields (IMS 1.1 spec §3.1) :contentReference[oaicite:0]{index=0}
    params = {
        "lti_version":       "LTI-1p0",
        "lti_message_type":  "basic-lti-launch-request",
        "resource_link_id":  resource_link_id,  # unique per link
        "user_id":           user_id,
        "roles":             roles,
        "context_id":        context_id,
        "oauth_consumer_key":   CONSUMER_KEY,
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp":       str(int(time.time())),
        "oauth_nonce":           uuid.uuid4().hex,
        "oauth_version":         "1.0",
        "context_title": "Intro to Psychology",
        "context_label": "PSY101",
        "lis_result_sourcedid": "abc123",
        "lis_outcome_service_url": "https://assignments.google.com/lti/outcome_service"
    }

    # 1️⃣  Normalise parameters (RFC 5849 §3.4.1.3)
    encoded = urllib.parse.urlencode(
        sorted(params.items()),
        quote_via=urllib.parse.quote,
        safe='~'
    )

    # 2️⃣  Create the signature base string
    base_string = "POST&" + urllib.parse.quote(LAUNCH_URL, safe='') + "&" + urllib.parse.quote(encoded, safe='~')

    # 3️⃣  HMAC‑SHA1 using consumer_secret + "&"
    signing_key = urllib.parse.quote(CONSUMER_SECRET, safe='') + "&"
    hashed = hmac.new(signing_key.encode(), base_string.encode(), hashlib.sha1)
    params["oauth_signature"] = base64.b64encode(hashed.digest()).decode()

    return params

@app.route("/grade", methods=["POST"])
def grade():
    user_id = session.get("user_id")
    resource_link_id = session.get("resource_link_id")
    score = request.form.get("score", type=float)

    entry = gradebook.get((user_id, resource_link_id))
    if not entry:
        return "No grade data available for this user and assignment.", 400

    sourcedid = entry["sourcedid"]
    service_url = entry["service_url"]

    return send_grade(sourcedid, service_url, score)

# ------------------------------------------------------------------
@app.route("/test-grade", methods=["POST"])
def test_grade():
    score = request.form.get("score", type=float)
    sourcedid = "abc123"
    service_url = "https://assignments.google.com/lti/outcome_service"
    return send_grade(sourcedid, service_url, score)

def send_grade(sourcedid, service_url, score):
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
  <imsx_POXHeader>
    <imsx_POXRequestHeaderInfo>
      <imsx_version>V1.0</imsx_version>
      <imsx_messageIdentifier>{uuid.uuid4()}</imsx_messageIdentifier>
    </imsx_POXRequestHeaderInfo>
  </imsx_POXHeader>
  <imsx_POXBody>
    <replaceResultRequest>
      <resultRecord>
        <sourcedGUID><sourcedId>{sourcedid}</sourcedId></sourcedGUID>
        <result>
          <resultScore>
            <language>en</language>
            <textString>{score}</textString>
          </resultScore>
        </result>
      </resultRecord>
    </replaceResultRequest>
  </imsx_POXBody>
</imsx_POXEnvelopeRequest>'''

    client = Client(CONSUMER_KEY, client_secret=CONSUMER_SECRET, signature_method='HMAC-SHA1')
    uri, headers, _ = client.sign(service_url, http_method="POST", body=xml, headers={"Content-Type": "application/xml"})

    response = requests.post(uri, headers=headers, data=xml)
    return f"<pre>Status: {response.status_code}\n\n{response.text}</pre>"


# ------------------------------------------------------------------
# ▶️ 4.  START THE LOCAL SERVER
# ------------------------------------------------------------------
if __name__ == "__main__":
    # Production: use gunicorn/uwsgi + HTTPS behind a reverse proxy.
    app.run(host="127.0.0.1", port=5000, debug=True)

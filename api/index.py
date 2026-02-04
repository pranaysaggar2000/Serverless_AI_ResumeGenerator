from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import json
import io
import base64
from functools import wraps
from time import time
from collections import defaultdict

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import (
    extract_text_from_pdf, 
    parse_job_description, 
    tailor_resume, 
    analyze_resume_with_jd,
    extract_base_resume_info
)
from resume_builder import create_resume_pdf

app = Flask(__name__)

# CORS: Allow only Chrome extension origins
CORS(app, resources={
    r"/api/*": {
        "origins": ["chrome-extension://*"],
        "methods": ["GET", "POST"],
        "allow_headers": ["Content-Type"]
    }
})

# Rate limiting (in-memory, resets on deployment)
rate_limit_store = defaultdict(list)
MAX_REQUESTS_PER_MINUTE = 30

# Input size limits (in characters)
MAX_TEXT_SIZE = 50000  # ~50KB
MAX_JSON_SIZE = 100000  # ~100KB

def validate_text_size(text, max_size=MAX_TEXT_SIZE):
    """Validate text input size."""
    if not text:
        return False, "Text cannot be empty"
    if len(str(text)) > max_size:
        return False, f"Input too large (max {max_size} characters)"
    return True, None

def validate_json_size(data, max_size=MAX_JSON_SIZE):
    """Validate JSON data size."""
    if not data:
        return False, "Data cannot be empty"
    json_str = json.dumps(data)
    if len(json_str) > max_size:
        return False, f"Data too large (max {max_size} characters)"
    return True, None

def rate_limit(f):
    """Simple rate limiting decorator."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Use IP address for rate limiting
        client_ip = request.remote_addr or 'unknown'
        current_time = time()
        
        # Clean old requests (older than 1 minute)
        rate_limit_store[client_ip] = [
            req_time for req_time in rate_limit_store[client_ip]
            if current_time - req_time < 60
        ]
        
        # Check rate limit
        if len(rate_limit_store[client_ip]) >= MAX_REQUESTS_PER_MINUTE:
            return jsonify({"error": "Rate limit exceeded. Please try again later."}), 429
        
        # Add current request
        rate_limit_store[client_ip].append(current_time)
        
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/extract_text', methods=['POST'])
def extract_text():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
            
        text = extract_text_from_pdf(file)
        return jsonify({"text": text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tailor_resume', methods=['POST'])
@rate_limit
def api_tailor_resume():
    try:
        data = request.json
        base_resume = data.get('base_resume')
        jd_text = data.get('jd_text')
        api_key = data.get('api_key')
        provider = data.get('provider', 'gemini')
        
        if not base_resume or not jd_text or not api_key:
            return jsonify({"error": "Missing required fields: base_resume, jd_text, or api_key"}), 400
        
        # Validate input sizes
        valid, error = validate_text_size(jd_text)
        if not valid:
            return jsonify({"error": error}), 400
        
        valid, error = validate_json_size(base_resume)
        if not valid:
            return jsonify({"error": error}), 400
            
        # 1. Parse JD
        jd_analysis = parse_job_description(jd_text, provider=provider, api_key=api_key)
        
        # 2. Tailor Resume
        tailored_resume = tailor_resume(base_resume, jd_analysis, provider=provider, api_key=api_key)
        
        return jsonify({
            "tailored_resume": tailored_resume,
            "jd_analysis": jd_analysis
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate_pdf', methods=['POST'])
@rate_limit
def api_generate_pdf():
    try:
        data = request.json
        resume_data = data.get('resume_data')
        
        if not resume_data:
            return jsonify({"error": "Missing resume_data"}), 400
        
        # Validate input size
        valid, error = validate_json_size(resume_data)
        if not valid:
            return jsonify({"error": error}), 400
            
        # Generate PDF in-memory
        buffer = io.BytesIO()
        create_resume_pdf(resume_data, buffer)
        buffer.seek(0)
        
        # Encode to Base64
        pdf_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return jsonify({"pdf_base64": pdf_base64})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/analyze', methods=['POST'])
@rate_limit
def analyze():
    try:
        data = request.json
        resume_data = data.get('resume_data')
        jd_text = data.get('jd_text')
        api_key = data.get('api_key')
        provider = data.get('provider', 'gemini') # Default to gemini if not sent
        
        if not resume_data or not jd_text or not api_key:
            return jsonify({"error": "Missing required fields"}), 400
            
        # Validate input sizes
        valid, error = validate_text_size(jd_text)
        if not valid:
            return jsonify({"error": error}), 400
        
        valid, error = validate_json_size(resume_data)
        if not valid:
            return jsonify({"error": error}), 400
            
        
        analysis = analyze_resume_with_jd(resume_data, jd_text, provider=provider, api_key=api_key)
        
        return jsonify(analysis)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/extract_base_profile', methods=['POST'])
@rate_limit
def api_extract_base_profile():
    try:
        data = request.json
        text = data.get('text')
        api_key = data.get('api_key')
        provider = data.get('provider', 'gemini')
        
        if not text or not api_key:
            return jsonify({"error": "Missing text or api_key"}), 400
        
        # Validate input size
        valid, error = validate_text_size(text)
        if not valid:
            return jsonify({"error": error}), 400
            
        profile_data = extract_base_resume_info(text, provider=provider, api_key=api_key)
        return jsonify(profile_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/ask', methods=['POST'])
@rate_limit
def api_ask():
    try:
        data = request.json
        question = data.get('question')
        resume_data = data.get('resume_data')
        jd_text = data.get('jd_text')
        api_key = data.get('api_key')
        provider = data.get('provider', 'gemini')
        
        if not question or not resume_data or not jd_text or not api_key:
            return jsonify({"error": "Missing required fields"}), 400
        
        # Validate input sizes
        valid, error = validate_text_size(question, max_size=5000)
        if not valid:
            return jsonify({"error": error}), 400
        
        valid, error = validate_text_size(jd_text)
        if not valid:
            return jsonify({"error": error}), 400
        
        valid, error = validate_json_size(resume_data)
        if not valid:
            return jsonify({"error": error}), 400
        
        from main import answer_question_with_context
        result = answer_question_with_context(question, resume_data, jd_text, provider=provider, api_key=api_key)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Health check
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "version": "2.0.0"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)

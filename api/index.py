from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import json
import io
import base64

# Add the parent directory to sys.path to import modules
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
# Allow CORS from the Chrome Extension
CORS(app, resources={r"/api/*": {"origins": "*"}}) # Relaxed for development, restrict in production if needed

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
def api_tailor_resume():
    try:
        data = request.json
        base_resume = data.get('base_resume')
        jd_text = data.get('jd_text')
        api_key = data.get('api_key')
        
        if not base_resume or not jd_text or not api_key:
            return jsonify({"error": "Missing required fields: base_resume, jd_text, or api_key"}), 400
            
        # 1. Parse JD
        jd_analysis = parse_job_description(jd_text, api_key=api_key)
        
        # 2. Tailor Resume
        tailored_resume = tailor_resume(base_resume, jd_analysis, api_key=api_key)
        
        return jsonify({
            "tailored_resume": tailored_resume,
            "jd_analysis": jd_analysis
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate_pdf', methods=['POST'])
def api_generate_pdf():
    try:
        data = request.json
        resume_data = data.get('resume_data')
        
        if not resume_data:
            return jsonify({"error": "Missing resume_data"}), 400
            
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
def analyze():
    try:
        data = request.json
        resume_data = data.get('resume_data')
        jd_text = data.get('jd_text')
        api_key = data.get('api_key')
        
        if not resume_data or not jd_text or not api_key:
            return jsonify({"error": "Missing required fields"}), 400
            
        analysis = analyze_resume_with_jd(resume_data, jd_text, api_key=api_key)
        
        return jsonify(analysis)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/extract_base_profile', methods=['POST'])
def api_extract_base_profile():
    try:
        data = request.json
        text = data.get('text')
        api_key = data.get('api_key')
        
        if not text or not api_key:
            return jsonify({"error": "Missing text or api_key"}), 400
            
        profile_data = extract_base_resume_info(text, api_key=api_key)
        return jsonify(profile_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Health check
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "version": "2.0.0"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)

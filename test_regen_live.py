
import json
import sys
import os
import time

# Ensure we can import main
sys.path.append(os.getcwd())

import main

def load_env():
    """Load environment variables from .env file"""
    if os.path.exists('.env'):
        print("📂 Loading .env file...")
        with open('.env') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ[k] = v.strip('"\'')
    else:
        print("⚠️ No .env file found!")

def test_live_regeneration():
    print("🚀 Starting LIVE Integration Test (Groq)...")
    
    # 0. Load Credentials
    load_env()
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("❌ Error: GROQ_API_KEY not found in .env")
        return

    # 1. Setup Data (Simple Resume)
    base_resume = {
        'name': 'Live Tester',
        'contact': {'email': 'test@example.com', 'location': 'Remote', 'linkedin_url': 'linkedin.com/in/test'},
        'skills': {'Languages': 'Python, JavaScript, SQL', 'Cloud': 'AWS'},
        'experience': [
            {
                'role': 'Senior Software Engineer (Legacy Constant)', 
                'company': 'Tech Giant', 
                'bullets': [
                    "Designed scalable microservices handling 10k RPS.",
                    "Led a team of 5 engineers to deliver Q4 roadmap.",
                    "Optimized database queries reducing latency by 40%.",
                    "Implemented CI/CD pipelines using Jenkins and Docker.",
                    "Mentored junior developers and conducted code reviews."
                ]
            }
        ],
        'projects': [],
        'leadership': []
    }
    
    jd_analysis = {
        "role": "Senior Backend Engineer", 
        "domain_context": "High Scale Systems", 
        "location": "Remote",
        "tech_stack": ["Python", "AWS", "Microservices"]
    }
    
    # Request REDUCTION to 2 bullets
    bullet_counts = {
        'experience': [2] 
    }
    
    print("\n📋 Configuration:")
    print(f"   Input Bullets: {len(base_resume['experience'][0]['bullets'])}")
    print(f"   Requested: {bullet_counts['experience'][0]}")
    print("   Provider: Groq")

    # 2. Call API
    print("\n⚡ Sending request to Groq (this may take a few seconds)...")
    start_time = time.time()
    
    try:
        result = main.tailor_resume(
            base_resume=base_resume, 
            jd_analysis=jd_analysis, 
            bullet_counts=bullet_counts,
            provider="groq",
            api_key=api_key
        )
        duration = time.time() - start_time
        print(f"   ✅ Response received in {duration:.2f}s")
        
        # 3. Analyze Result
        if 'experience' in result and len(result['experience']) > 0:
            item = result['experience'][0]
            actual_count = len(item.get('bullets', []))
            
            print(f"\n🔍 Result Analysis:")
            print(f"   Role: {item.get('role')}")
            print(f"   Bullets Generated: {actual_count}")
            print("   Content:")
            for b in item.get('bullets', []):
                print(f"   - {b}")
                
            # Validation
            if actual_count == 2:
                print("\n✅ PASS: Exactly 2 bullets returned.")
            else:
                print(f"\n❌ FAIL: Expected 2, got {actual_count}.")
                
        else:
            print("\n❌ Error: Experience section missing in response.")
            print(json.dumps(result, indent=2))
            
    except Exception as e:
        print(f"\n❌ Exception during test: {e}")

if __name__ == "__main__":
    test_live_regeneration()

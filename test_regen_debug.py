
import json
import sys
import os
from unittest.mock import patch, MagicMock

# Ensure we can import main
sys.path.append(os.getcwd())

import main

def test_regeneration_logic():
    print("🚀 Starting Logic Verification Test...")
    
    # 1. Setup Data
    base_resume = {
        'name': 'Test User',
        'contact': {'email': 'test@example.com', 'location': 'Remote', 'linkedin_url': 'linkedin.com/in/test'},
        'skills': {'Languages': 'Python, Java'}, # String format to match prompt
        'experience': [
            {
                'role': 'Senior Developer', 
                'company': 'Tech Corp', 
                'bullets': ['Original 1', 'Original 2', 'Original 3', 'Original 4', 'Original 5']
            },
            {
                'role': 'Junior Developer',
                'company': 'Startup Inc',
                'bullets': ['Original A', 'Original B']
            }
        ],
        'projects': [],
        'leadership': []
    }
    
    jd_analysis = {"role": "Senior Engineer", "domain_context": "Tech", "location": "Remote"}
    
    # User wants:
    # Item 1: 2 bullets (Reduction)
    # Item 2: 4 bullets (Expansion)
    bullet_counts = {
        'experience': [2, 4] 
    }
    
    print("\n📋 Requested Configuration:")
    print(f"   Experience Item 1: {bullet_counts['experience'][0]} bullets")
    print(f"   Experience Item 2: {bullet_counts['experience'][1]} bullets")

    # 2. Mock AI Response
    # Simulate an AI that ignores instructions and returns MORE bullets than asked for Item 1
    # and matches count for Item 2.
    mock_ai_output = base_resume.copy()
    mock_ai_output['experience'] = [
        {
            'role': 'Senior Developer',
            'company': 'Tech Corp',
            'bullets': ['AI Gen 1', 'AI Gen 2', 'AI Gen 3', 'AI Gen 4', 'AI Gen 5'] # 5 bullets (Excess!)
        },
        {
            'role': 'Junior Developer',
            'company': 'Startup Inc',
            'bullets': ['AI Gen A', 'AI Gen B', 'AI Gen C', 'AI Gen D'] # 4 bullets (Match)
        }
    ]
    
    # 3. Patch and Execute
    with patch('main.query_provider') as mock_query:
        mock_query.return_value = json.dumps(mock_ai_output)
        
        print("\n⚙️ Running tailor_resume()...")
        result = main.tailor_resume(
            base_resume=base_resume, 
            jd_analysis=jd_analysis, 
            bullet_counts=bullet_counts
        )
        
        # 4. Verify Prompt Construction (Dynamic Logic)
        print("\n🔍 Verifying Prompt Construction...")
        call_args = mock_query.call_args[0]
        sent_prompt = call_args[0]
        
        # Check Item 1 Instruction
        if "ACTION: Rewrite these bullets into EXACTLY 2" in sent_prompt:
            print("   ✅ Item 1 Instruction Found: 'EXACTLY 2'")
        else:
            print("   ❌ Item 1 Instruction MISSING or Wrong!")
            
        # Check Item 2 Instruction
        if "ACTION: Rewrite these bullets into EXACTLY 4" in sent_prompt:
             print("   ✅ Item 2 Instruction Found: 'EXACTLY 4'")
        else:
             print("   ❌ Item 2 Instruction MISSING!")

        # 5. Verify Post-Processing Enforcement
        print("\n🔍 Verifying Post-Processing (Trimming)...")
        
        # Item 1 Check
        item1_bullets = result['experience'][0]['bullets']
        print(f"   Item 1 Actual Count: {len(item1_bullets)}")
        if len(item1_bullets) == 2:
            print("   ✅ Enforcement SUCCESS: Trimmed 5 -> 2")
        else:
            print(f"   ❌ Enforcement FAILED: Expected 2, got {len(item1_bullets)}")
            
        # Item 2 Check
        item2_bullets = result['experience'][1]['bullets']
        print(f"   Item 2 Actual Count: {len(item2_bullets)}")
        if len(item2_bullets) == 4:
             print("   ✅ Enforcement SUCCESS: Matches 4")
        else:
             print(f"   ❌ Enforcement FAILED: Expected 4, got {len(item2_bullets)}")
             
        # Check Content Integrity
        if item1_bullets == ['AI Gen 1', 'AI Gen 2']:
            print("   ✅ Content Preserved (Top 2 kept)")
        else:
            print("   ⚠️ Content Mismatch (Check logic)")

if __name__ == "__main__":
    test_regeneration_logic()

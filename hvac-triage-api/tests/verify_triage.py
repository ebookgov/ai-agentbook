import sys
import os
from fastapi.testclient import TestClient

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app

client = TestClient(app)

# Global counters for test results
passed_tests = 0
failed_tests = 0

def run_test(name, endpoint, payload, expected_status=200, check_func=None):
    global passed_tests, failed_tests
    print(f"Testing {name}...", end=" ")
    try:
        response = client.post(endpoint, json=payload)
        if response.status_code != expected_status:
            print(f"[FAIL] Status {response.status_code} (Expected {expected_status})")
            failed_tests += 1
            return False
        
        data = response.json()
        if check_func and not check_func(data):
            print(f"[FAIL] Content Mismatch: {data}")
            failed_tests += 1
            return False
            
        print("[PASS]")
        passed_tests += 1
        return True
    except Exception as e:
        print(f"[FAIL] Error: {e}")
        failed_tests += 1
        return False

def verify_triage_logic():
    print("\n--- Verifying Triage Logic ---")
    
    # 1. Test EMERGENCY (Gas Leak)
    run_test(
        "Emergency: Gas Leak", 
        "/triage", 
        {"transcript": "I smell gas in the basement"}, 
        check_func=lambda d: d["status"] == "EMERGENCY"
    )

    # 2. Test EMERGENCY (Water Leak)
    run_test(
        "Emergency: Water Leak", 
        "/triage", 
        {"transcript": "Water is leaking from the ceiling"}, 
        check_func=lambda d: d["status"] == "EMERGENCY"
    )

    # 3. Test ROUTINE (Tune-up)
    run_test(
        "Routine: Tune-up", 
        "/triage", 
        {"transcript": "I need to schedule a spring tune up for my AC"}, 
        check_func=lambda d: d["status"] == "ROUTINE"
    )

    # 4. Test URGENT (Ambiguous No Heat)
    run_test(
        "Urgent: Ambiguous No Heat", 
        "/triage", 
        {"transcript": "My heater isn't working"}, 
        check_func=lambda d: d["status"] == "URGENT"
    )

def verify_webhook_logic():
    print("\n--- Verifying Webhook Logic ---")
    
    # 5. Test SMS Webhook
    run_test(
        "Webhook: Send SMS", 
        "/webhook/sms", 
        {"phone_number": "+15550001234", "message": "This is a test message. Reply STOP to opt out."}, 
        check_func=lambda d: d["status"] == "sent" and d["provider"] == "twilio-mock"
    )

if __name__ == "__main__":
    verify_triage_logic()
    verify_webhook_logic()

    print(f"\n--- Test Summary ---")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {failed_tests}")

    if failed_tests > 0:
        sys.exit(1)

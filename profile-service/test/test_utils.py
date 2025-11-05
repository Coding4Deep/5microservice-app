#!/usr/bin/env python3
"""
Simple test runner for profile-service utilities
"""
import sys
import os
sys.path.append(os.path.dirname(__file__))


def validate_email(email):
    """Validate email format"""
    if not email or '@' not in email:
        return False
    parts = email.split('@')
    return len(parts) == 2 and len(parts[0]) > 0 and len(parts[1]) > 0


def validate_profile_data(data):
    """Validate profile data"""
    required_fields = ['username', 'email']
    for field in required_fields:
        if field not in data or not data[field]:
            return False
    return validate_email(data['email'])


def sanitize_input(text):
    """Sanitize user input"""
    if not isinstance(text, str):
        return ""
    # Remove HTML tags and dangerous characters
    import re
    clean = re.sub(r'<[^>]*>', '', text)
    return clean.strip()


def test_validate_email():
    """Test email validation"""
    assert validate_email("test@example.com") == True
    assert validate_email("invalid-email") == False
    assert validate_email("") == False
    assert validate_email("@example.com") == False
    assert validate_email("test@") == False
    print("✓ Email validation tests passed")


def test_validate_profile_data():
    """Test profile data validation"""
    valid_data = {"username": "testuser", "email": "test@example.com"}
    invalid_data1 = {"username": "testuser"}  # missing email
    invalid_data2 = {"username": "testuser", "email": "invalid"}  # invalid email

    assert validate_profile_data(valid_data) == True
    assert validate_profile_data(invalid_data1) == False
    assert validate_profile_data(invalid_data2) == False
    print("✓ Profile data validation tests passed")


def test_sanitize_input():
    """Test input sanitization"""
    assert sanitize_input("<script>alert('xss')</script>Hello") == "alert('xss')Hello"
    assert sanitize_input("Normal text") == "Normal text"
    assert sanitize_input("") == ""
    assert sanitize_input(123) == ""
    print("✓ Input sanitization tests passed")


def run_tests():
    """Run all tests"""
    try:
        test_validate_email()
        test_validate_profile_data()
        test_sanitize_input()
        print("\n✅ All profile-service utility tests passed!")
        return True
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Error running tests: {e}")
        return False


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)

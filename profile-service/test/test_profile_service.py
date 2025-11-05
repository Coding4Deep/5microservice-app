from app.profile_service import ProfileService
import pytest
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))


class TestProfileService:
    def setup_method(self):
        """Setup for each test method"""
        self.service = ProfileService()

    def test_health_check(self):
        """Test health check endpoint"""
        result = self.service.health_check()
        assert result["status"] == "OK"
        assert result["service"] == "profile-service"
        assert "profiles_count" in result

    def test_create_profile(self):
        """Test creating a new profile"""
        profile = self.service.create_profile("testuser", "Test bio")

        assert profile["username"] == "testuser"
        assert profile["bio"] == "Test bio"
        assert profile["profile_picture"] is None
        assert "created_at" in profile
        assert "updated_at" in profile

    def test_create_duplicate_profile(self):
        """Test creating duplicate profile raises error"""
        self.service.create_profile("testuser")

        with pytest.raises(ValueError, match="Profile already exists"):
            self.service.create_profile("testuser")

    def test_get_profile(self):
        """Test getting existing profile"""
        self.service.create_profile("testuser", "Test bio")
        profile = self.service.get_profile("testuser")

        assert profile is not None
        assert profile["username"] == "testuser"
        assert profile["bio"] == "Test bio"

    def test_get_nonexistent_profile(self):
        """Test getting non-existent profile returns None"""
        profile = self.service.get_profile("nonexistent")
        assert profile is None

    def test_update_profile(self):
        """Test updating existing profile"""
        self.service.create_profile("testuser", "Original bio")

        updated = self.service.update_profile(
            "testuser", bio="Updated bio", profile_picture="pic.jpg")

        assert updated is not None
        assert updated["bio"] == "Updated bio"
        assert updated["profile_picture"] == "pic.jpg"
        assert updated["username"] == "testuser"

    def test_update_nonexistent_profile(self):
        """Test updating non-existent profile returns None"""
        result = self.service.update_profile("nonexistent", bio="New bio")
        assert result is None

    def test_delete_profile(self):
        """Test deleting existing profile"""
        self.service.create_profile("testuser")

        result = self.service.delete_profile("testuser")
        assert result is True

        # Verify profile is deleted
        profile = self.service.get_profile("testuser")
        assert profile is None

    def test_delete_nonexistent_profile(self):
        """Test deleting non-existent profile returns False"""
        result = self.service.delete_profile("nonexistent")
        assert result is False

    def test_get_all_profiles(self):
        """Test getting all profiles"""
        self.service.create_profile("user1", "Bio 1")
        self.service.create_profile("user2", "Bio 2")

        all_profiles = self.service.get_all_profiles()

        assert len(all_profiles) == 2
        assert "user1" in all_profiles
        assert "user2" in all_profiles
        assert all_profiles["user1"]["bio"] == "Bio 1"
        assert all_profiles["user2"]["bio"] == "Bio 2"

    def test_profile_timestamps(self):
        """Test that timestamps are properly set"""
        profile = self.service.create_profile("testuser")
        created_at = profile["created_at"]
        updated_at = profile["updated_at"]

        # Update profile
        updated_profile = self.service.update_profile("testuser", bio="New bio")

        # Created timestamp should remain the same
        assert updated_profile["created_at"] == created_at
        # Updated timestamp should be different
        assert updated_profile["updated_at"] != updated_at

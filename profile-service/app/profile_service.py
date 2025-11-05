from typing import Dict, Optional
import json
from datetime import datetime


class ProfileService:
    def __init__(self):
        self.profiles = {}

    def create_profile(self, username: str, bio: str = "", profile_picture: str = None) -> Dict:
        """Create a new user profile"""
        if username in self.profiles:
            raise ValueError("Profile already exists")

        profile = {
            "username": username,
            "bio": bio,
            "profile_picture": profile_picture,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        self.profiles[username] = profile
        return profile

    def get_profile(self, username: str) -> Optional[Dict]:
        """Get user profile by username"""
        return self.profiles.get(username)

    def update_profile(self, username: str, bio: str = None, profile_picture: str = None) -> Optional[Dict]:
        """Update user profile"""
        if username not in self.profiles:
            return None

        profile = self.profiles[username]
        if bio is not None:
            profile["bio"] = bio
        if profile_picture is not None:
            profile["profile_picture"] = profile_picture
        profile["updated_at"] = datetime.now().isoformat()

        return profile

    def delete_profile(self, username: str) -> bool:
        """Delete user profile"""
        if username in self.profiles:
            del self.profiles[username]
            return True
        return False

    def get_all_profiles(self) -> Dict:
        """Get all profiles"""
        return self.profiles

    def health_check(self) -> Dict:
        """Health check endpoint"""
        return {
            "status": "OK",
            "service": "profile-service",
            "profiles_count": len(self.profiles)
        }

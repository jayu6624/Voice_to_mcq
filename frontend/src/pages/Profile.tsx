import React, { useState } from 'react';
import { HiPhotograph } from 'react-icons/hi';

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle profile update
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Profile Settings</h2>

      <div className="bg-gray-800/50 rounded-lg p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="h-20 w-20 rounded-full bg-gray-700 flex items-center justify-center">
            <HiPhotograph className="h-8 w-8 text-gray-400" />
          </div>
          <button className="text-blue-400 hover:text-blue-300">
            Change Photo
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">First Name</label>
              <input
                type="text"
                className="w-full bg-gray-700 rounded px-3 py-2"
                value={profile.firstName}
                onChange={(e) => setProfile({...profile, firstName: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name</label>
              <input
                type="text"
                className="w-full bg-gray-700 rounded px-3 py-2"
                value={profile.lastName}
                onChange={(e) => setProfile({...profile, lastName: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              className="w-full bg-gray-700 rounded px-3 py-2"
              value={profile.email}
              onChange={(e) => setProfile({...profile, email: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              type="tel"
              className="w-full bg-gray-700 rounded px-3 py-2"
              value={profile.phone}
              onChange={(e) => setProfile({...profile, phone: e.target.value})}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 py-2 rounded"
          >
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;

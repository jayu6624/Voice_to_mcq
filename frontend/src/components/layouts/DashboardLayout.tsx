import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { 
  Upload, 
  BookOpen, 
  CheckCircle, 
  User, 
  LogOut, 
  Menu, 
  X, 
  Bell, 
  Search, 
  Settings,
  ChevronDown,
  FileText // Add FileText icon
} from 'lucide-react';
import { getProfile } from '../../lib/api';

interface UserData {
  user: {
    id: string;
    fullname: {
      firstname: string;
      lastname: string;
    };
    email: string;
    phonenumber?: string;
  };
}

export default function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const navigation = [
    { name: 'Upload', to: '/dashboard/upload', icon: Upload },
    { name: 'Transcription', to: '/dashboard/transcription', icon: FileText }, // Add Transcription item
    { name: 'Quiz', to: '/dashboard/quiz', icon: BookOpen },
    { name: 'Review', to: '/dashboard/review', icon: CheckCircle },
  ];

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setError(null);
        const response = await getProfile();
        setUserData(response as unknown as UserData);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        setError(error instanceof Error ? error.message : 'Failed to load profile');
        // Handle token expiration
        if (error instanceof Error && error.message.includes('401')) {
          handleLogout();
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error loading dashboard</p>
          <button 
            onClick={() => navigate('/login')}
            className="text-purple-600 hover:text-purple-700"
          >
            Return to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/95">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white transform transition-transform duration-300 ease-in-out shadow-lg ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 bg-gradient-to-r">
            <h1 className="text-xl font-bold text-white flex items-center space-x-2">
              <span className="w-10h-10bg-white/20 rounded-lg flex items-center justify-center">
                <img src="/logo.png" alt="Shiksha.ai Logo" className="h-8" />  
              </span>
              <span className='text-black cursor-pointer' onClick={()=>navigate('/dashbaord')}>Shiksha.ai</span>
            </h1>
          </div>


          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-purple-50 text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:bg-purple-50/50 hover:text-purple-600'
                  }`
                }
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className={`lg:pl-72 transition-all duration-300 ${isSidebarOpen ? 'pl-72' : 'pl-0'}`}>
        {/* Top Bar */}
        <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-100">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            {/* Left side with menu button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-gray-500 hover:text-gray-600 lg:hidden"
            >
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Search */}
            <div className="flex-1 max-w-xl ml-4 lg:ml-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 transition-all bg-gray-50/50"
                />
              </div>
            </div>

            {/* Right section */}
            <div className="flex items-center space-x-4">
              <button className="p-2 text-black hover:text-purple-600 rounded-lg hover:bg-purple-50 transition-colors bg-transparent">
                <Bell size={20} />
              </button>
              <button className="p-2 text-black hover:text-purple-600 rounded-lg hover:bg-purple-50 transition-colors bg-transparent">
                <Settings size={20} />
              </button>
              <div className="relative">
                <button 
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="p-2 text-black hover:text-purple-600 rounded-lg hover:bg-purple-50 transition-colors bg-transparent flex items-center space-x-3"
                >
                  <div className=" h-9 w-9 rounded-full bg-purple-600 text-white flex items-center justify-center font-medium relative ring-2 ring-purple-600/20">
                    {userData?.user?.fullname ? (
                      `${userData.user.fullname.firstname[0]}${userData.user.fullname.lastname[0]}`
                    ) : (
                      <User size={20} />
                    )}
                  </div>
                  <span className="hidden md:inline-flex items-center text-sm font-medium text-gray-700">
                    {isLoading ? (
                      'Loading...'
                    ) : userData?.user?.fullname ? (
                      `${userData.user.fullname.firstname} ${userData.user.fullname.lastname}`
                    ) : (
                      'User'
                    )}
                    <ChevronDown size={16} className="ml-2" />
                  </span>
                </button>

                {/* Profile Dropdown */}
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg py-1 border border-gray-100">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">
                        {userData?.user?.fullname ? 
                          `${userData.user.fullname.firstname} ${userData.user.fullname.lastname}` 
                          : 'User'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {userData?.user?.email || ''}
                      </p>
                    </div>
                    <div className="py-1">
                      <div className="grid grid-cols-1">
                      <Link
                        to="/dashboard/profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <User className="w-4 h-4 mr-3" />
                        Profile Settings
                      </Link>
                        <button
                        onClick={() => {
                          handleLogout();
                          setIsProfileOpen(false);
                        }}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:text-purple-600 text-left"
                        >
                        <LogOut className="w-4 h-4 mr-3" />
                        Logout
                        </button>
                      </div>
                    </div>
                    </div>
                  
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

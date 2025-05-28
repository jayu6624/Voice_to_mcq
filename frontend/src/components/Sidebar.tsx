import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Upload, FileText, Settings, Menu, ChevronLeft, HelpCircle, FileType } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const location = useLocation();
  
  const menuItems = [
    { path: '/', name: 'Dashboard', icon: <Home size={20} /> },
    { path: '/upload', name: 'Upload', icon: <Upload size={20} /> },
    { path: '/transcription', name: 'Transcription', icon: <FileType size={20} /> },
    { path: '/transcripts', name: 'Transcripts & MCQs', icon: <FileText size={20} /> },
    { path: '/quiz', name: 'Quiz', icon: <HelpCircle size={20} /> },
    { path: '/settings', name: 'Settings', icon: <Settings size={20} /> },
  ];
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };
  
  return (
    <>
      {/* Mobile header with menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
        <h1 className="font-bold text-lg text-gray-800">Voice to MCQ</h1>
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-100"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
      </div>
      
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`fixed top-0 bottom-0 lg:left-0 z-40 w-64 bg-white border-r border-gray-200 pt-5 pb-10 transition-all duration-300 ease-in-out overflow-y-auto
          ${isOpen ? 'left-0' : '-left-64'} 
          lg:translate-x-0`}
      >
        <div className="px-4 mb-6 flex items-center justify-between">
          <h1 className="font-bold text-xl text-gray-800">Voice to MCQ</h1>
          <button 
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={toggleSidebar}
          >
            <ChevronLeft size={20} />
          </button>
        </div>
        
        <nav>
          <ul>
            {menuItems.map((item) => (
              <li key={item.path} className="mb-1 px-2">
                <Link
                  to={item.path}
                  className={`flex items-center px-4 py-3 rounded-lg group transition-colors ${
                    isActive(item.path)
                      ? 'bg-purple-100 text-purple-800'
                      : 'hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      toggleSidebar();
                    }
                  }}
                >
                  <span 
                    className={`mr-3 transition-colors ${
                      isActive(item.path)
                        ? 'text-purple-600'
                        : 'text-gray-500 group-hover:text-gray-700'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;

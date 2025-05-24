import { useNavigate } from 'react-router-dom';
import { 
  HiUpload, HiQuestionMarkCircle, HiStar, 
  HiUser, HiLogout, HiMenuAlt2 
} from 'react-icons/hi';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate();
  
  const menuItems = [
    { icon: HiUpload, label: 'Upload Video', path: '/dashboard/upload' },
    { icon: HiQuestionMarkCircle, label: 'MCQ Quiz', path: '/dashboard/quiz' },
    { icon: HiStar, label: 'Review', path: '/dashboard/review' },
    { icon: HiUser, label: 'Profile', path: '/dashboard/profile' },
  ];

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-64'} 
      transition-width duration-300 bg-gradient-to-b from-gray-800 to-gray-900 
      text-white p-4 flex flex-col`}>
      <button onClick={onToggle} className="mb-8">
        <HiMenuAlt2 size={24} />
      </button>
      
      <nav className="flex-1">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex items-center w-full p-3 mb-2 rounded-lg
              hover:bg-gray-700 transition-colors"
          >
            <item.icon size={24} />
            {!isCollapsed && (
              <span className="ml-3">{item.label}</span>
            )}
          </button>
        ))}
      </nav>

      <button 
        onClick={() => {/* handle logout */}}
        className="flex items-center w-full p-3 rounded-lg
          hover:bg-gray-700 transition-colors mt-auto"
      >
        <HiLogout size={24} />
        {!isCollapsed && <span className="ml-3">Logout</span>}
      </button>
    </aside>
  );
}

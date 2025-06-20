
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import {
  Home,
  Search,
  Heart,
  Send,
  Bell,
  User,
  Settings,
  PlusSquare,
  Film,
  Bookmark,
  Menu
} from 'lucide-react';

const navigationItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Search, label: 'Search', path: '/search' },
  { icon: Heart, label: 'Activity', path: '/activity' },
  { icon: Send, label: 'Messages', path: '/messages' },
  { icon: Bell, label: 'Notifications', path: '/notifications' },
  { icon: PlusSquare, label: 'Create', path: '/create' },
  { icon: Film, label: 'Stories', path: '/stories' },
  { icon: User, label: 'Profile', path: '/profile' },
  { icon: Bookmark, label: 'Saved', path: '/saved' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-background border-r border-border p-4 z-40">
      <div className="mb-8">
        <Link to="/" className="text-2xl font-bold text-primary">
          SocialConnect
        </Link>
      </div>

      <nav className="space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Button
              key={item.path}
              variant={isActive ? "secondary" : "ghost"}
              className="w-full justify-start px-3 py-6 text-left"
              asChild
            >
              <Link to={item.path}>
                <Icon className="mr-3 h-6 w-6" />
                <span className="text-base">{item.label}</span>
              </Link>
            </Button>
          );
        })}
      </nav>

      {user && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user.user_metadata?.full_name || user.email}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                @{user.user_metadata?.username || user.email?.split('@')[0]}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;


import React from 'react';
import InstagramMessages from '@/components/messaging/InstagramMessages';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const Messages = () => {
  return (
    <div className="relative">
      {/* Theme Toggle positioned in top right */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <InstagramMessages />
    </div>
  );
};

export default Messages;

import React from 'react';
import { sanitizeBannerUrl } from '../../utils/sanitizeUrl';

interface ProfileBannerProps {
  bannerUrl?: string | null;
}

export const ProfileBanner: React.FC<ProfileBannerProps> = ({ bannerUrl }) => {
  const safeBannerUrl = sanitizeBannerUrl(bannerUrl);

  return (
    <div className="w-full h-48 bg-gray-200 relative overflow-hidden rounded-lg">
      {safeBannerUrl ? (
        <img
          src={safeBannerUrl}
          alt="Profile Banner"
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback gracefully if image loading fails or is blocked
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gradient-to-r from-gray-100 to-gray-300">
          <span>No Banner Set</span>
        </div>
      )}
    </div>
  );
};